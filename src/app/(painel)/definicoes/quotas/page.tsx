import type { Metadata } from "next";
import { Painel } from "@/components/ui";
import FormularioAccao from "@/components/formulario-accao";
import {
  anoDeExercicio,
  carregarFracoes,
  carregarQuotasDoAno,
} from "@/lib/dados";
import { euros } from "@/lib/formatos";
import { guardarQuotasDoAno } from "../accoes";

export const metadata: Metadata = { title: "Quotas do ano · Definições" };

export default async function PaginaDefinicoesQuotas() {
  const ano = await anoDeExercicio();
  const [fracoes, quotasDoAno] = await Promise.all([
    carregarFracoes(),
    carregarQuotasDoAno(ano),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Painel
        titulo={`Quotas mensais de ${ano}`}
        descricao="Cada exercício tem as suas quotas. Muda o ano no seletor no topo da página. Um campo em branco faz a fração usar a quota base indicada em Frações."
      >
        <FormularioAccao accao={guardarQuotasDoAno}>
          <input type="hidden" name="ano" value={ano} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-pergaminho-200 text-left">
                  <th className="px-3 py-2.5 font-medium text-verdete-800">
                    Fração
                  </th>
                  <th className="px-3 py-2.5 font-medium text-pergaminho-600">
                    Quota base
                  </th>
                  <th className="px-3 py-2.5 font-medium text-verdete-800">
                    Quota de {ano}
                  </th>
                </tr>
              </thead>
              <tbody>
                {fracoes.map((f) => {
                  const base = Number(f.quota_mensal);
                  const doAno = quotasDoAno.get(f.id);
                  return (
                    <tr
                      key={f.id}
                      className="border-b border-pergaminho-100 last:border-0"
                    >
                      <th
                        scope="row"
                        className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-verdete-900"
                      >
                        {f.letra}
                        <span className="ml-2 font-normal text-pergaminho-500">
                          {f.andar}
                        </span>
                        {!f.ativo && (
                          <span className="ml-2 text-xs font-normal text-pergaminho-400">
                            (inactiva)
                          </span>
                        )}
                      </th>
                      <td className="tabular px-3 py-2.5 text-pergaminho-500">
                        {euros(base)}
                      </td>
                      <td className="px-3 py-2.5">
                        <label className="sr-only" htmlFor={`quota-${f.id}`}>
                          Quota de {f.letra} em {ano}
                        </label>
                        <input
                          id={`quota-${f.id}`}
                          name={`quota-${f.id}`}
                          inputMode="decimal"
                          defaultValue={
                            doAno === undefined
                              ? ""
                              : doAno.toFixed(2).replace(".", ",")
                          }
                          placeholder={base.toFixed(2).replace(".", ",")}
                          className="w-32 rounded-lg border border-pergaminho-300 bg-white px-3 py-2 text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FormularioAccao>
      </Painel>
    </div>
  );
}
