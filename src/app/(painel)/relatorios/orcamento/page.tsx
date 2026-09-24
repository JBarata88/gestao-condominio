import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import BotaoImprimir from "@/components/botao-imprimir";
import { CabecalhoPagina, Painel } from "@/components/ui";
import AdministracaoCondominio from "@/components/administracao-condominio";
import { construirMapa } from "@/lib/contas";
import {
  anoDeExercicio,
  carregarAdministradoresDoAno,
  carregarCategorias,
  carregarDisponibilidadesOrcamento,
  carregarMovimentos,
  carregarOrcamentoDoAno,
  carregarSaldosIniciais,
  limitesDoAno,
  paraCalculo,
  perfilAtual,
} from "@/lib/dados";
import { dataCurta, euros } from "@/lib/formatos";
import { construirMapaOrcamento, type LinhaOrcamento } from "@/lib/orcamento";

export const metadata: Metadata = { title: "Orçamento vs Realizado · Relatórios" };

export default async function PaginaRelatoriosOrcamento({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const perfil = await perfilAtual();
  const admin = perfil?.admin === true;

  const { ano: anoParam } = await searchParams;
  const ano = await anoDeExercicio(anoParam);
  const [inicio, fim] = limitesDoAno(ano);

  const [movimentos, abertura, categorias, administradores, orcamentoPorCategoria, disponibilidadesOrcamento] =
    await Promise.all([
      carregarMovimentos(inicio, fim),
      carregarSaldosIniciais(ano),
      carregarCategorias(),
      carregarAdministradoresDoAno(ano),
      carregarOrcamentoDoAno(ano),
      carregarDisponibilidadesOrcamento(ano),
    ]);

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
  const mapa = construirMapaOrcamento({
    mapaReal,
    orcamentoReceitas: rotuloOrcamento(categoriasReceita),
    orcamentoDespesas: rotuloOrcamento(categoriasDespesa),
    disponibilidadesOrcamento,
  });

  const descarregar = `/api/relatorios/moaf-orcamento?ano=${ano}&inicio=${inicio}&fim=${fim}`;

  return (
    <div className="mx-auto max-w-5xl print:max-w-none">
      <style>{"@media print { @page { size: A4 landscape; } }"}</style>

      <CabecalhoPagina
        sobretitulo={`Exercício de ${ano}`}
        titulo="Orçamento vs Realizado"
        descricao="Compara o orçamento aprovado em assembleia com os valores reais do exercício."
        accao={<BotaoImprimir />}
      />

      <div className="-mt-6 mb-6 flex flex-wrap items-center justify-between gap-3 print:-mt-3 print:mb-3">
        <AdministracaoCondominio administradores={administradores} ano={ano} />
        <Link
          href={`/relatorios?ano=${ano}`}
          className="text-sm text-pergaminho-500 underline-offset-4 transition-colors duration-150 hover:text-verdete-700 hover:underline print:hidden"
        >
          ← Voltar ao mapa de fundos
        </Link>
      </div>

      <p className="mb-6 hidden text-sm text-pergaminho-600 print:block">
        Período: {dataCurta(inicio)} a {dataCurta(fim)}
      </p>

      {orcamentoPorCategoria.size === 0 && (
        <p className="mb-6 rounded-lg border border-ocre-200 bg-ocre-50 px-4 py-3 text-sm leading-relaxed text-ocre-800 print:hidden">
          Ainda não há orçamento definido para {ano}. Todos os valores
          orçamentados aparecem a zero.
        </p>
      )}

      <div className="flex flex-col gap-6">
        <Painel titulo="Origem de fundos" className="print:border-0 print:p-0 print:shadow-none">
          <TabelaOrcamento
            grupos={[
              { titulo: "A — Administração anterior", linhas: mapa.origem.anterior, subtotal: mapa.origem.anteriorSubtotal },
              { titulo: "B — Administração actual", linhas: mapa.origem.atual, subtotal: mapa.origem.atualSubtotal },
            ]}
            total={mapa.origem.total}
          />
        </Painel>

        <Painel titulo="Aplicação de fundos" className="print:border-0 print:p-0 print:shadow-none">
          <TabelaOrcamento
            grupos={[
              { titulo: "A — Despesas", linhas: mapa.aplicacao.despesas, subtotal: mapa.aplicacao.despesasSubtotal },
              { titulo: "B — Disponibilidades", linhas: mapa.aplicacao.disponibilidades, subtotal: mapa.aplicacao.disponibilidadesSubtotal },
            ]}
            total={mapa.aplicacao.total}
          />
        </Painel>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 print:mt-3 print:gap-2">
        <div className="rounded-xl border border-pergaminho-200 bg-white p-4 shadow-[var(--shadow-baixo)] sm:p-6 print:border-0 print:p-2 print:shadow-none">
          <p className="text-sm text-pergaminho-600">Variação das disponibilidades</p>
          <LinhaValores linha={mapa.variacao} forte />
        </div>

        <div className="rounded-xl border border-pergaminho-200 bg-white p-4 shadow-[var(--shadow-baixo)] sm:p-6 print:border-0 print:p-2 print:shadow-none">
          <p className="text-sm text-pergaminho-600">Célula de controlo</p>
          <div className="mt-1 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-pergaminho-500">Orçamentado</p>
              <p
                className={`tabular font-display text-xl font-semibold ${mapa.controloOrcamentado === 0 ? "text-[#3f7a4e]" : "text-[#a63a2b]"}`}
              >
                {euros(mapa.controloOrcamentado)}
              </p>
            </div>
            <div>
              <p className="text-xs text-pergaminho-500">Realizado</p>
              <p
                className={`tabular font-display text-xl font-semibold ${mapa.controloRealizado === 0 ? "text-[#3f7a4e]" : "text-[#a63a2b]"}`}
              >
                {euros(mapa.controloRealizado)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {admin && (
        <div className="mt-6 flex justify-end print:hidden">
          <a
            href={descarregar}
            className="inline-flex items-center justify-center rounded-lg bg-verdete-700 px-5 py-3 text-sm font-medium text-pergaminho-50 shadow-[var(--shadow-medio)] transition-[transform,background-color,box-shadow] duration-200 ease-[var(--ease-mola)] hover:-translate-y-0.5 hover:bg-verdete-600 hover:shadow-[var(--shadow-alto)] active:translate-y-0 active:bg-verdete-800"
          >
            Descarregar em Excel
          </a>
        </div>
      )}
    </div>
  );
}

function TabelaOrcamento({
  grupos,
  total,
}: {
  grupos: { titulo: string; linhas: LinhaOrcamento[]; subtotal: LinhaOrcamento }[];
  total: LinhaOrcamento;
}) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[36rem] border-collapse text-sm print:text-[9pt]">
        <thead>
          <tr className="border-b border-pergaminho-200 text-left">
            <th className="py-2 pr-3 font-medium text-verdete-800">Rubrica</th>
            <th className="py-2 pr-3 text-right font-medium text-pergaminho-600">Orçamentado</th>
            <th className="py-2 pr-3 text-right font-medium text-pergaminho-600">Realizado</th>
            <th className="py-2 text-right font-medium text-pergaminho-600">Desvio</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <Fragment key={grupo.titulo}>
              <tr>
                <td colSpan={4} className="pt-3 pb-1 text-xs font-medium tracking-wide text-pergaminho-500 uppercase">
                  {grupo.titulo}
                </td>
              </tr>
              {grupo.linhas.map((l) => (
                <LinhaTabela key={l.rotulo} linha={l} />
              ))}
              <LinhaTabela linha={grupo.subtotal} forte />
            </Fragment>
          ))}
          <LinhaTabela linha={total} forte destaque />
        </tbody>
      </table>
    </div>
  );
}

function LinhaTabela({
  linha,
  forte,
  destaque,
}: {
  linha: LinhaOrcamento;
  forte?: boolean;
  destaque?: boolean;
}) {
  return (
    <tr
      className={`${forte ? "border-t border-pergaminho-200 font-medium" : "border-b border-pergaminho-100"} ${
        destaque ? "text-verdete-950" : "text-pergaminho-700"
      }`}
    >
      <td className="py-1.5 pr-3">{linha.rotulo}</td>
      <td className="tabular py-1.5 pr-3 text-right">{euros(linha.orcamentado)}</td>
      <td className="tabular py-1.5 pr-3 text-right">{euros(linha.realizado)}</td>
      <td
        className={`tabular py-1.5 text-right ${
          linha.desvioValor > 0
            ? "text-[#2f5c3b]"
            : linha.desvioValor < 0
              ? "text-[#7d2c20]"
              : ""
        }`}
      >
        {euros(linha.desvioValor)}
        <span className="ml-1 text-xs text-pergaminho-400">
          ({linha.desvioPercentagem.toFixed(2).replace(".", ",")}%)
        </span>
      </td>
    </tr>
  );
}

function LinhaValores({ linha, forte }: { linha: LinhaOrcamento; forte?: boolean }) {
  return (
    <div className="mt-1 grid grid-cols-3 gap-4">
      <div>
        <p className="text-xs text-pergaminho-500">Orçamentado</p>
        <p className={`tabular ${forte ? "font-display text-xl font-semibold text-verdete-950" : ""}`}>
          {euros(linha.orcamentado)}
        </p>
      </div>
      <div>
        <p className="text-xs text-pergaminho-500">Realizado</p>
        <p className={`tabular ${forte ? "font-display text-xl font-semibold text-verdete-950" : ""}`}>
          {euros(linha.realizado)}
        </p>
      </div>
      <div>
        <p className="text-xs text-pergaminho-500">Desvio</p>
        <p className={`tabular ${forte ? "font-display text-xl font-semibold" : ""}`}>
          {euros(linha.desvioValor)}
        </p>
      </div>
    </div>
  );
}
