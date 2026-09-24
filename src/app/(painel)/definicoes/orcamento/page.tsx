import type { Metadata } from "next";
import { Painel } from "@/components/ui";
import FormularioAccao from "@/components/formulario-accao";
import {
  anoDeExercicio,
  carregarCategorias,
  carregarDisponibilidadesOrcamento,
  carregarOrcamentoDoAno,
} from "@/lib/dados";
import { euros } from "@/lib/formatos";
import { guardarOrcamentoDoAno } from "../accoes";
import { exigirAdminOuRedirecionar } from "../exigir-admin";

export const metadata: Metadata = { title: "Orçamento · Definições" };

const CLASSE_CAMPO =
  "w-32 rounded-lg border border-pergaminho-300 bg-white px-3 py-2 text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

export default async function PaginaDefinicoesOrcamento({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  await exigirAdminOuRedirecionar();

  const { ano: anoParam } = await searchParams;
  const ano = await anoDeExercicio(anoParam);

  const [categorias, valoresPorCategoria, disponibilidades] = await Promise.all([
    carregarCategorias(),
    carregarOrcamentoDoAno(ano),
    carregarDisponibilidadesOrcamento(ano),
  ]);

  const receitas = categorias.filter((c) => c.natureza === "receita" && c.ativo);
  const despesas = categorias.filter((c) => c.natureza === "despesa" && c.ativo);

  const linhaCategoria = (c: (typeof categorias)[number]) => {
    const valor = valoresPorCategoria.get(c.id);
    return (
      <tr key={c.id} className="border-b border-pergaminho-100 last:border-0">
        <th
          scope="row"
          className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-verdete-900"
        >
          {c.nome}
        </th>
        <td className="px-3 py-2.5">
          <label className="sr-only" htmlFor={`categoria-${c.id}`}>
            Valor orçamentado de {c.nome}
          </label>
          <input
            id={`categoria-${c.id}`}
            name={`categoria-${c.id}`}
            inputMode="decimal"
            defaultValue={valor === undefined ? "" : valor.toFixed(2).replace(".", ",")}
            placeholder="0,00"
            className={CLASSE_CAMPO}
          />
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Painel
        titulo={`Orçamento de ${ano}`}
        descricao="O valor aprovado em assembleia para cada categoria. Uma categoria em branco conta como não orçamentada (zero) no relatório de Orçamento vs Realizado, em Relatórios."
      >
        <FormularioAccao accao={guardarOrcamentoDoAno}>
          <input type="hidden" name="ano" value={ano} />

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="overflow-x-auto">
              <h3 className="mb-3 font-display text-base font-semibold text-verdete-900">
                Origem de fundos
              </h3>
              <table className="w-full min-w-[20rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-pergaminho-200 text-left">
                    <th className="px-3 py-2.5 font-medium text-verdete-800">
                      Categoria
                    </th>
                    <th className="px-3 py-2.5 font-medium text-verdete-800">
                      Orçamentado
                    </th>
                  </tr>
                </thead>
                <tbody>{receitas.map(linhaCategoria)}</tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <h3 className="mb-3 font-display text-base font-semibold text-verdete-900">
                Aplicação de fundos — Despesas
              </h3>
              <table className="w-full min-w-[20rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-pergaminho-200 text-left">
                    <th className="px-3 py-2.5 font-medium text-verdete-800">
                      Categoria
                    </th>
                    <th className="px-3 py-2.5 font-medium text-verdete-800">
                      Orçamentado
                    </th>
                  </tr>
                </thead>
                <tbody>{despesas.map(linhaCategoria)}</tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 border-t border-pergaminho-200 pt-6">
            <h3 className="mb-1 font-display text-base font-semibold text-verdete-900">
              Disponibilidades previstas no fim de {ano}
            </h3>
            <p className="mb-4 text-sm text-pergaminho-600">
              Correspondem à secção &quot;Disponibilidades&quot; do mapa. O
              total devia bater com a origem de fundos menos as despesas, mas
              a app não obriga — o relatório mostra a diferença na célula de
              controlo, tal como faz com o realizado.
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["disp_caixa", "Caixa", disponibilidades.caixa],
                  ["disp_deposito_ordem", "Depósitos à ordem", disponibilidades.depositoOrdem],
                  ["disp_deposito_prazo", "Depósitos a prazo", disponibilidades.depositoPrazo],
                  ["disp_conta_poupanca", "Conta poupança", disponibilidades.contaPoupanca],
                ] as const
              ).map(([nome, etiqueta, valor]) => (
                <div key={nome} className="flex flex-col gap-2">
                  <label htmlFor={nome} className="text-sm font-medium text-verdete-800">
                    {etiqueta}
                  </label>
                  <input
                    id={nome}
                    name={nome}
                    inputMode="decimal"
                    defaultValue={valor === 0 ? "" : valor.toFixed(2).replace(".", ",")}
                    placeholder={euros(0)}
                    className={`${CLASSE_CAMPO} w-full`}
                  />
                </div>
              ))}
            </div>
          </div>
        </FormularioAccao>
      </Painel>
    </div>
  );
}
