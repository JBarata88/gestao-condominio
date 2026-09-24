import { NextResponse, type NextRequest } from "next/server";
import { construirMapa } from "@/lib/contas";
import {
  anoDeExercicio,
  anoValido,
  carregarCategorias,
  carregarCondominio,
  carregarDisponibilidadesOrcamento,
  carregarMovimentos,
  carregarOrcamentoDoAno,
  carregarSaldosIniciais,
  paraCalculo,
  perfilAtual,
} from "@/lib/dados";
import { construirMapaOrcamento } from "@/lib/orcamento";
import { gerarMoafOrcamento } from "@/lib/relatorios/moaf-orcamento";

export const runtime = "nodejs";

/** Mapa de origem e aplicação de fundos vs. orçamento aprovado, em Excel. */
export async function GET(pedido: NextRequest) {
  const perfil = await perfilAtual();
  if (!perfil?.admin) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const params = pedido.nextUrl.searchParams;
  const anoParam = params.get("ano");
  if (anoParam !== null && !anoValido(anoParam)) {
    return NextResponse.json({ erro: "Ano inválido." }, { status: 400 });
  }
  const ano = await anoDeExercicio(anoParam ?? undefined);

  const inicio = params.get("inicio") ?? `${ano}-01-01`;
  const fim = params.get("fim") ?? `${ano}-12-31`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    return NextResponse.json({ erro: "Datas inválidas." }, { status: 400 });
  }

  const [movimentos, abertura, categorias, condominio, orcamentoPorCategoria, disponibilidadesOrcamento] =
    await Promise.all([
      carregarMovimentos(inicio, fim),
      carregarSaldosIniciais(ano),
      carregarCategorias(),
      carregarCondominio(),
      carregarOrcamentoDoAno(ano),
      carregarDisponibilidadesOrcamento(ano),
    ]);

  if (!condominio) {
    return NextResponse.json(
      { erro: "Falta preencher os dados do condomínio em Definições." },
      { status: 400 },
    );
  }

  const categoriasReceita = categorias.filter((c) => c.natureza === "receita" && c.ativo);
  const categoriasDespesa = categorias.filter((c) => c.natureza === "despesa" && c.ativo);

  const rotulosFixos = {
    receitas: categoriasReceita.map((c) => c.linha_moaf ?? c.nome),
    despesas: categoriasDespesa.map((c) => c.linha_moaf ?? c.nome),
  };

  const rotuloOrcamento = (lista: typeof categoriasReceita) => {
    const mapa = new Map<string, number>();
    for (const c of lista) {
      const rotulo = c.linha_moaf ?? c.nome;
      const valor = orcamentoPorCategoria.get(c.id) ?? 0;
      mapa.set(rotulo, (mapa.get(rotulo) ?? 0) + valor);
    }
    return mapa;
  };

  const mapaReal = construirMapa(paraCalculo(movimentos), abertura, rotulosFixos);
  const mapaOrcamento = construirMapaOrcamento({
    mapaReal,
    orcamentoReceitas: rotuloOrcamento(categoriasReceita),
    orcamentoDespesas: rotuloOrcamento(categoriasDespesa),
    disponibilidadesOrcamento,
  });

  const cabecalho = {
    nome: condominio.nome,
    morada: condominio.morada,
    codigoPostal: condominio.codigo_postal,
    localidade: condominio.localidade,
    nif: condominio.nif,
  };

  const ficheiro = await gerarMoafOrcamento({
    mapa: mapaOrcamento,
    condominio: cabecalho,
    inicio,
    fim,
    ano,
  });

  const nome = `MOAFORCAMENTO${ano}.xlsx`;

  return new NextResponse(new Uint8Array(ficheiro), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
