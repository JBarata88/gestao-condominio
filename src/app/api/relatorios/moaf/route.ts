import { NextResponse, type NextRequest } from "next/server";
import { construirMapa } from "@/lib/contas";
import {
  carregarCategorias,
  carregarCondominio,
  carregarMovimentos,
  carregarSaldosIniciais,
  paraCalculo,
  perfilAtual,
} from "@/lib/dados";
import { gerarMoaf, type CabecalhoCondominio } from "@/lib/relatorios/moaf";

export const runtime = "nodejs";

/** Mapa de origem e aplicação de fundos, em Excel. */
export async function GET(pedido: NextRequest) {
  const perfil = await perfilAtual();
  if (perfil?.papel !== "admin") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const params = pedido.nextUrl.searchParams;
  const ano = Number(params.get("ano") ?? new Date().getFullYear());
  if (!Number.isInteger(ano) || ano < 1900 || ano > 2200) {
    return NextResponse.json({ erro: "Ano inválido." }, { status: 400 });
  }

  const inicio = params.get("inicio") ?? `${ano}-01-01`;
  const fim = params.get("fim") ?? `${ano}-12-31`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    return NextResponse.json({ erro: "Datas inválidas." }, { status: 400 });
  }

  const [movimentos, abertura, categorias, condominio] = await Promise.all([
    carregarMovimentos(inicio, fim),
    carregarSaldosIniciais(ano),
    carregarCategorias(),
    carregarCondominio(),
  ]);

  if (!condominio) {
    return NextResponse.json(
      { erro: "Falta preencher os dados do condomínio em Definições." },
      { status: 400 },
    );
  }

  // Passar todos os rótulos activos garante que o mapa mantém sempre a mesma
  // forma, com as categorias sem movimento a aparecer a zero.
  const rotulosFixos = {
    receitas: categorias
      .filter((c) => c.natureza === "receita" && c.ativo)
      .map((c) => c.linha_moaf ?? c.nome),
    despesas: categorias
      .filter((c) => c.natureza === "despesa" && c.ativo)
      .map((c) => c.linha_moaf ?? c.nome),
  };

  const mapa = construirMapa(paraCalculo(movimentos), abertura, rotulosFixos);

  const cabecalho: CabecalhoCondominio = {
    nome: condominio.nome,
    morada: condominio.morada,
    codigoPostal: condominio.codigo_postal,
    localidade: condominio.localidade,
    nif: condominio.nif,
  };

  const ficheiro = await gerarMoaf({
    mapa,
    condominio: cabecalho,
    inicio,
    fim,
    ano,
  });

  const nome = `MOAF${ano}${String(new Date().getMonth() + 1).padStart(2, "0")}.xlsx`;

  return new NextResponse(new Uint8Array(ficheiro), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
