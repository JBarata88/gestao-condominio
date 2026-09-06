import type { ReactNode } from "react";
import { Etiqueta } from "@/components/ui";
import { somar } from "@/lib/formatos";
import { dataCurta, euros } from "@/lib/formatos";
import type { TipoConta } from "@/lib/tipos-bd";
import LinhaMovimento, {
  type CategoriaEscolha,
  type FracaoEscolha,
} from "./linha-movimento";

export type LinhaConta = {
  id: string;
  data: string;
  conta: TipoConta;
  receita: number;
  despesa: number;
  descricao: string | null;
  doc: string | null;
  /** Preenchido quando o movimento veio da importação de um extrato. */
  extrato_linha_id: string | null;
  categoria_id: string;
  fracao_id: string | null;
  quota_mes: string | null;
  quota_mes_fim: string | null;
  saldoBanco: number;
  saldoCaixa: number;
  categorias: { nome: string } | null;
  fracoes: { letra: string } | null;
};

/**
 * Um bloco de movimentos de uma só conta, com saldo de arrastamento.
 *
 * Corresponde a metade de uma folha mensal do ficheiro original, que tinha os
 * movimentos bancários à esquerda e a caixa à direita, cada um com a sua
 * coluna de saldo.
 */
export default function SeccaoConta({
  titulo,
  conta,
  visiveis,
  transporte,
  saldoFinal,
  rotuloTransporte,
  podeGerir = false,
  formulario,
  filtrado = false,
  categorias = [],
  fracoes = [],
  ano,
}: {
  titulo: string;
  conta: TipoConta;
  /** As linhas desta conta que passam nos filtros em vigor. */
  visiveis: LinhaConta[];
  /** Saldo real da conta à entrada do período, ignorando filtros de conteúdo. */
  transporte: number;
  /** Saldo real da conta à saída do período, ignorando filtros de conteúdo. */
  saldoFinal: number;
  rotuloTransporte: string;
  /** Mostra a coluna de acções e permite editar/apagar, só para a administração. */
  podeGerir?: boolean;
  /** Formulário de lançamento manual, quando esta conta o permite. */
  formulario?: ReactNode;
  /**
   * Há um filtro de categoria ou fração activo. Nesse caso os totais do
   * rodapé descrevem só as linhas visíveis, e não a variação real da conta,
   * por isso o texto tem de dizer isso.
   */
  filtrado?: boolean;
  /** Necessárias para o formulário de edição, quando podeGerir é true. */
  categorias?: CategoriaEscolha[];
  fracoes?: FracaoEscolha[];
  ano?: number;
}) {
  const saldoDe = (l: LinhaConta) =>
    conta === "banco" ? l.saldoBanco : l.saldoCaixa;

  const receita = somar(visiveis.map((l) => l.receita));
  const despesa = somar(visiveis.map((l) => l.despesa));

  return (
    <section
      aria-labelledby={`seccao-${conta}`}
      className="rounded-xl border border-pergaminho-200 bg-white shadow-[var(--shadow-baixo)]"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-pergaminho-200 px-6 py-4">
        <h2
          id={`seccao-${conta}`}
          className="font-display text-xl font-semibold text-verdete-900"
        >
          {titulo}
        </h2>
        <p className="tabular text-sm text-pergaminho-600">
          Saldo{" "}
          <span className="font-display text-lg font-semibold text-verdete-950">
            {euros(saldoFinal)}
          </span>
        </p>
      </header>

      {visiveis.length === 0 ? (
        <p className="px-6 py-8 text-center leading-relaxed text-pergaminho-600">
          {filtrado
            ? "Nenhum movimento corresponde ao filtro nesta conta."
            : "Sem movimentos neste período."}{" "}
          O saldo transitado é de{" "}
          <span className="tabular">{euros(transporte)}</span>.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <caption className="sr-only">
              {titulo}, com saldo de arrastamento
            </caption>
            <thead>
              <tr className="border-b border-pergaminho-200">
                <th scope="col" className="px-4 py-2.5 text-left font-medium text-verdete-800">
                  Data
                </th>
                <th scope="col" className="px-4 py-2.5 text-left font-medium text-verdete-800">
                  Categoria
                </th>
                <th scope="col" className="px-4 py-2.5 text-left font-medium text-verdete-800">
                  Descrição
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium text-verdete-800">
                  Receita
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium text-verdete-800">
                  Despesa
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium text-verdete-800">
                  Saldo
                </th>
                {podeGerir && (
                  <th scope="col" className="px-4 py-2.5 text-right font-medium text-verdete-800">
                    <span className="sr-only">Acções</span>
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {/* Linha de transporte, como no cabeçalho das folhas mensais. */}
              <tr className="border-b border-pergaminho-100 bg-pergaminho-50/60">
                <td className="px-4 py-2.5 text-pergaminho-500">—</td>
                <td className="px-4 py-2.5 text-pergaminho-500">—</td>
                <td
                  colSpan={3}
                  className="px-4 py-2.5 text-pergaminho-600 italic"
                >
                  {rotuloTransporte}
                </td>
                <td className="tabular px-4 py-2.5 text-right text-pergaminho-700">
                  {euros(transporte)}
                </td>
                {podeGerir && <td />}
              </tr>

              {visiveis.map((l) =>
                podeGerir ? (
                  <LinhaMovimento
                    key={l.id}
                    l={l}
                    saldo={saldoDe(l)}
                    colunas={7}
                    categorias={categorias}
                    fracoes={fracoes}
                    ano={ano ?? new Date().getFullYear()}
                  />
                ) : (
                  <tr
                    key={l.id}
                    className="border-b border-pergaminho-100 transition-colors duration-150 hover:bg-pergaminho-50"
                  >
                    <td className="tabular px-4 py-2.5 whitespace-nowrap text-pergaminho-700">
                      {dataCurta(l.data)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-verdete-900">
                      {l.categorias?.nome ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-pergaminho-700">
                      {l.descricao ?? "—"}
                      {l.fracoes && (
                        <span className="ml-2 text-pergaminho-500">
                          ({l.fracoes.letra})
                        </span>
                      )}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right text-[#2f5c3b]">
                      {l.receita > 0 ? euros(l.receita) : ""}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right text-[#7d2c20]">
                      {l.despesa > 0 ? euros(l.despesa) : ""}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right font-medium text-verdete-950">
                      {euros(saldoDe(l))}
                    </td>
                  </tr>
                ),
              )}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-pergaminho-300 bg-pergaminho-50/60">
                <td colSpan={3} className="px-4 py-3 font-medium text-verdete-900">
                  {filtrado ? "Totais do que está à vista" : "Totais do período"}
                </td>
                <td className="tabular px-4 py-3 text-right font-medium text-[#2f5c3b]">
                  {euros(receita)}
                </td>
                <td className="tabular px-4 py-3 text-right font-medium text-[#7d2c20]">
                  {euros(despesa)}
                </td>
                <td className="tabular px-4 py-3 text-right font-medium text-verdete-950">
                  {filtrado ? "—" : euros(saldoFinal)}
                </td>
                {podeGerir && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <footer className="flex flex-wrap items-center gap-3 border-t border-pergaminho-200 px-6 py-3">
        <Etiqueta tom="neutro">
          {visiveis.length} movimento{visiveis.length === 1 ? "" : "s"}
        </Etiqueta>
        <span className="tabular text-sm text-pergaminho-600">
          {filtrado ? "Variação do que está à vista" : "Variação no período"}:{" "}
          {euros(somar([receita, -despesa]))}
        </span>
      </footer>

      {formulario}
    </section>
  );
}
