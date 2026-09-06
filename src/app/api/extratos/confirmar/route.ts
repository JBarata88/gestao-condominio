import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { perfilAtual } from "@/lib/dados";
import { clienteServidor } from "@/lib/supabase/servidor";
import { arredondar } from "@/lib/formatos";

export const runtime = "nodejs";

type LinhaConfirmada = {
  dataMov: string;
  dataValor: string | null;
  descricao: string;
  valor: number;
  saldo: number | null;
  impressaoDigital: string;
  linhaOrigem: number;
  categoriaId: string;
  fracaoId: string | null;
  quotaMes: string | null;
  quotaMesFim: string | null;
};

type Corpo = {
  nomeFicheiro: string;
  banco?: string;
  linhas: LinhaConfirmada[];
};

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Grava as linhas confirmadas como movimentos, dentro de um só extrato. */
export async function POST(pedido: NextRequest) {
  const perfil = await perfilAtual();
  if (perfil?.papel !== "admin") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  let corpo: Corpo;
  try {
    corpo = await pedido.json();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const linhas = (corpo.linhas ?? []).filter(
    (l) =>
      DATA_ISO.test(l.dataMov) &&
      typeof l.valor === "number" &&
      l.valor !== 0 &&
      l.categoriaId,
  );

  if (linhas.length === 0) {
    return NextResponse.json(
      { erro: "Não há linhas válidas para gravar. Falta escolher a categoria?" },
      { status: 400 },
    );
  }

  const supabase = await clienteServidor();

  const datas = linhas.map((l) => l.dataMov).sort();
  const { data: extrato, error: erroExtrato } = await supabase
    .from("extratos")
    .insert({
      nome_ficheiro: corpo.nomeFicheiro || "extrato",
      banco: corpo.banco ?? null,
      periodo_inicio: datas[0],
      periodo_fim: datas[datas.length - 1],
      total_linhas: linhas.length,
      importado_por: perfil.id,
    })
    .select("id")
    .single();

  if (erroExtrato || !extrato) {
    return NextResponse.json(
      { erro: erroExtrato?.message ?? "Não foi possível criar o extrato." },
      { status: 500 },
    );
  }

  // As linhas do extrato ficam gravadas primeiro, com a impressão digital
  // única, para que uma segunda importação do mesmo ficheiro seja recusada
  // pela base de dados e não apenas pelo ecrã de revisão.
  const { data: gravadas, error: erroLinhas } = await supabase
    .from("extrato_linhas")
    .insert(
      linhas.map((l) => ({
        extrato_id: extrato.id,
        linha_origem: l.linhaOrigem,
        data_mov: l.dataMov,
        data_valor: l.dataValor,
        descricao: l.descricao,
        valor: arredondar(l.valor),
        saldo: l.saldo,
        impressao_digital: l.impressaoDigital,
        estado: "conciliado" as const,
        sugestao_categoria_id: l.categoriaId,
        sugestao_fracao_id: l.fracaoId,
        sugestao_quota_mes: l.quotaMes,
      })),
    )
    .select("id, impressao_digital");

  if (erroLinhas) {
    // Desfaz o extrato para não deixar um registo órfão.
    await supabase.from("extratos").delete().eq("id", extrato.id);
    const duplicado = erroLinhas.code === "23505";
    return NextResponse.json(
      {
        erro: duplicado
          ? "Algumas destas linhas já tinham sido importadas antes. Desmarca as linhas assinaladas como repetidas."
          : erroLinhas.message,
      },
      { status: duplicado ? 409 : 500 },
    );
  }

  const idPorImpressao = new Map(
    (gravadas ?? []).map((g) => [g.impressao_digital, g.id]),
  );

  const { error: erroMovimentos } = await supabase.from("movimentos").insert(
    linhas.map((l) => {
      const valor = arredondar(l.valor);
      return {
        data: l.dataMov,
        categoria_id: l.categoriaId,
        descricao: l.descricao,
        // Um extrato bancário é sempre a conta do banco, nunca a caixa.
        conta: "banco" as const,
        receita: valor > 0 ? valor : 0,
        despesa: valor < 0 ? Math.abs(valor) : 0,
        fracao_id: l.fracaoId,
        quota_mes: l.quotaMes,
        quota_mes_fim: l.quotaMesFim,
        extrato_linha_id: idPorImpressao.get(l.impressaoDigital) ?? null,
        criado_por: perfil.id,
      };
    }),
  );

  if (erroMovimentos) {
    await supabase.from("extratos").delete().eq("id", extrato.id);
    return NextResponse.json({ erro: erroMovimentos.message }, { status: 500 });
  }

  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, gravadas: linhas.length });
}
