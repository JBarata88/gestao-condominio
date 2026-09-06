import { NextResponse, type NextRequest } from "next/server";
import { carregarCategorias, carregarFracoes, perfilAtual } from "@/lib/dados";
import { clienteServidor } from "@/lib/supabase/servidor";
import { lerExtrato } from "@/lib/extratos/ler-ficheiro";
import { sugerir, type RegraSimples } from "@/lib/extratos/conciliar";
import type { RegraConciliacao } from "@/lib/tipos-bd";

export const runtime = "nodejs";

/** 8 MB chega para qualquer extrato de um ano e trava ficheiros absurdos. */
const TAMANHO_MAXIMO = 8 * 1024 * 1024;

/**
 * Lê o ficheiro e devolve as linhas com sugestões. Não grava nada.
 * A gravação acontece só depois da revisão, em /api/extratos/confirmar.
 */
export async function POST(pedido: NextRequest) {
  const perfil = await perfilAtual();
  if (perfil?.papel !== "admin") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const dados = await pedido.formData();
  const ficheiro = dados.get("ficheiro");
  if (!(ficheiro instanceof File)) {
    return NextResponse.json(
      { erro: "Não foi enviado nenhum ficheiro." },
      { status: 400 },
    );
  }
  if (ficheiro.size > TAMANHO_MAXIMO) {
    return NextResponse.json(
      { erro: "O ficheiro é demasiado grande (máximo 8 MB)." },
      { status: 400 },
    );
  }

  let leitura;
  try {
    leitura = await lerExtrato(await ficheiro.arrayBuffer(), ficheiro.name);
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const [categorias, fracoes, { data: regrasBrutas }, { data: jaImportadas }] =
    await Promise.all([
      carregarCategorias(),
      carregarFracoes(),
      supabase.from("regras_conciliacao").select("*").eq("ativo", true),
      supabase
        .from("extrato_linhas")
        .select("impressao_digital")
        .in(
          "impressao_digital",
          leitura.linhas.map((l) => l.impressaoDigital),
        ),
    ]);

  const conhecidas = new Set(
    ((jaImportadas ?? []) as { impressao_digital: string }[]).map(
      (l) => l.impressao_digital,
    ),
  );

  const regras: RegraSimples[] = ((regrasBrutas ?? []) as RegraConciliacao[]).map(
    (r) => ({
      padrao: r.padrao,
      categoriaId: r.categoria_id,
      fracaoId: r.fracao_id,
      fornecedorId: r.fornecedor_id,
      prioridade: r.prioridade,
    }),
  );

  const categoriaQuotas =
    categorias.find((c) => c.nome === "Quotizações")?.id ?? null;

  const linhas = leitura.linhas.map((linha) => {
    const duplicada = conhecidas.has(linha.impressaoDigital);
    const sugestao = sugerir({
      descricao: linha.descricao,
      valor: linha.valor,
      dataMov: linha.dataMov,
      regras,
      fracoes: fracoes.map((f) => ({
        id: f.id,
        letra: f.letra,
        condominoNome: f.condomino_nome,
        quotaMensal: Number(f.quota_mensal),
      })),
      categoriaQuotasId: categoriaQuotas,
    });

    return { ...linha, duplicada, sugestao };
  });

  return NextResponse.json({
    formato: leitura.formato,
    aviso: leitura.aviso,
    nomeFicheiro: ficheiro.name,
    total: linhas.length,
    duplicadas: linhas.filter((l) => l.duplicada).length,
    linhas,
    categorias: categorias
      .filter((c) => c.ativo)
      .map((c) => ({ id: c.id, nome: c.nome, natureza: c.natureza })),
    fracoes: fracoes.map((f) => ({
      id: f.id,
      letra: f.letra,
      andar: f.andar,
    })),
  });
}
