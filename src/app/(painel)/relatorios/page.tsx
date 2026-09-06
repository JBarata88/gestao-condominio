import type { Metadata } from "next";
import { CabecalhoPagina, Painel } from "@/components/ui";
import { construirMapa } from "@/lib/contas";
import {
  anoDeExercicio,
  carregarCategorias,
  carregarResumoExercicio,
  carregarSaldosIniciais,
  limitesDoAno,
  perfilAtual,
} from "@/lib/dados";
import { euros } from "@/lib/formatos";

export const metadata: Metadata = { title: "Relatórios" };

export default async function PaginaRelatorios({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; fim?: string; ano?: string }>;
}) {
  const perfil = await perfilAtual();
  const admin = perfil?.admin === true;

  const params = await searchParams;

  const ano = await anoDeExercicio(params.ano);
  const [inicioAno, fimAno] = limitesDoAno(ano);
  const inicio = /^\d{4}-\d{2}-\d{2}$/.test(params.inicio ?? "")
    ? params.inicio!
    : inicioAno;
  const fim = /^\d{4}-\d{2}-\d{2}$/.test(params.fim ?? "")
    ? params.fim!
    : fimAno;

  // O resumo passa por uma função agregada que o condómino também pode chamar:
  // devolve totais por linha do mapa, sem movimentos nem frações individuais.
  const [movimentos, abertura, categorias] = await Promise.all([
    carregarResumoExercicio(inicio, fim),
    carregarSaldosIniciais(ano),
    carregarCategorias(),
  ]);

  const rotulosFixos = {
    receitas: categorias
      .filter((c) => c.natureza === "receita" && c.ativo)
      .map((c) => c.linha_moaf ?? c.nome),
    despesas: categorias
      .filter((c) => c.natureza === "despesa" && c.ativo)
      .map((c) => c.linha_moaf ?? c.nome),
  };

  const mapa = construirMapa(movimentos, abertura, rotulosFixos);
  const descarregar = `/api/relatorios/moaf?ano=${ano}&inicio=${inicio}&fim=${fim}`;

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina
        sobretitulo={`Exercício de ${ano}`}
        titulo="Relatórios"
        descricao="Mapa de origem e aplicação de fundos, na mesma disposição do ficheiro que usavas."
      />

      <Painel
        titulo="Período"
        descricao={
          admin
            ? "Escolhe o intervalo e pré-visualiza os totais antes de descarregar."
            : "Escolhe o intervalo. Os totais são os do condomínio inteiro, em modo de consulta."
        }
      >
        <form method="get" className="flex flex-wrap items-end gap-4">
          <input type="hidden" name="ano" value={ano} />
          <div className="flex flex-col gap-2">
            <label htmlFor="inicio" className="text-sm font-medium text-verdete-800">
              Início
            </label>
            <input
              id="inicio"
              name="inicio"
              type="date"
              defaultValue={inicio}
              className="rounded-lg border border-pergaminho-300 bg-white px-3 py-2.5 text-verdete-950 transition-colors duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="fim" className="text-sm font-medium text-verdete-800">
              Fim
            </label>
            <input
              id="fim"
              name="fim"
              type="date"
              defaultValue={fim}
              className="rounded-lg border border-pergaminho-300 bg-white px-3 py-2.5 text-verdete-950 transition-colors duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-pergaminho-300 bg-white px-5 py-2.5 text-sm font-medium text-verdete-800 transition-[transform,border-color] duration-200 ease-[var(--ease-mola)] hover:-translate-y-0.5 hover:border-pergaminho-400 active:translate-y-0"
          >
            Actualizar
          </button>
        </form>
      </Painel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Painel titulo="Origem de fundos">
          <dl className="flex flex-col gap-2 text-sm">
            <Linha rotulo="Administração anterior" valor={mapa.origem.anterior.total} />
            <Linha rotulo="Administração actual" valor={mapa.origem.atual.subtotal} />
            <Linha rotulo="Total" valor={mapa.origem.total} forte />
          </dl>
        </Painel>

        <Painel titulo="Aplicação de fundos">
          <dl className="flex flex-col gap-2 text-sm">
            <Linha rotulo="Despesas" valor={mapa.aplicacao.despesas.subtotal} />
            <Linha
              rotulo="Disponibilidades"
              valor={mapa.aplicacao.disponibilidades.total}
            />
            <Linha rotulo="Total" valor={mapa.aplicacao.total} forte />
          </dl>
        </Painel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Painel titulo="Receitas por categoria">
          <dl className="flex flex-col gap-2 text-sm">
            {mapa.origem.atual.linhas.map((l) => (
              <Linha key={l.rotulo} rotulo={l.rotulo} valor={l.valor} />
            ))}
            <Linha
              rotulo="Total de receitas"
              valor={mapa.origem.atual.subtotal}
              forte
            />
          </dl>
        </Painel>

        <Painel titulo="Despesas por categoria">
          <dl className="flex flex-col gap-2 text-sm">
            {mapa.aplicacao.despesas.linhas.map((l) => (
              <Linha key={l.rotulo} rotulo={l.rotulo} valor={l.valor} />
            ))}
            <Linha
              rotulo="Total de despesas"
              valor={mapa.aplicacao.despesas.subtotal}
              forte
            />
          </dl>
        </Painel>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-pergaminho-200 bg-white p-6 shadow-[var(--shadow-baixo)]">
        <div>
          <p className="text-sm text-pergaminho-600">Célula de controlo</p>
          <p
            className={`tabular font-display text-2xl font-semibold ${
              mapa.controlo === 0 ? "text-[#3f7a4e]" : "text-[#a63a2b]"
            }`}
          >
            {euros(mapa.controlo)}
          </p>
          <p className="mt-1 text-sm text-pergaminho-600">
            {mapa.controlo === 0
              ? "O mapa fecha. Origem e aplicação coincidem."
              : "O mapa não fecha. Verifica os saldos de abertura."}
          </p>
        </div>

        {admin && (
          <a
            href={descarregar}
            className="inline-flex items-center justify-center rounded-lg bg-verdete-700 px-5 py-3 text-sm font-medium text-pergaminho-50 shadow-[var(--shadow-medio)] transition-[transform,background-color,box-shadow] duration-200 ease-[var(--ease-mola)] hover:-translate-y-0.5 hover:bg-verdete-600 hover:shadow-[var(--shadow-alto)] active:translate-y-0 active:bg-verdete-800"
          >
            Descarregar em Excel
          </a>
        )}
      </div>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  forte,
}: {
  rotulo: string;
  valor: number;
  forte?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${
        forte ? "border-t border-pergaminho-200 pt-2 font-medium" : ""
      }`}
    >
      <dt className="text-pergaminho-700">{rotulo}</dt>
      <dd className="tabular text-verdete-950">{euros(valor)}</dd>
    </div>
  );
}
