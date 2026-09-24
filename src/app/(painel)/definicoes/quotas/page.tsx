import type { Metadata } from "next";
import { Painel, Vazio } from "@/components/ui";
import FormularioAccao from "@/components/formulario-accao";
import {
  anoDeExercicio,
  carregarCategorias,
  carregarFracoes,
  carregarQuotasDoAno,
  carregarReforcosDoAno,
} from "@/lib/dados";
import { dataCurta, euros } from "@/lib/formatos";
import { criarReforco, guardarQuotasDoAno } from "../accoes";
import { exigirAdminOuRedirecionar } from "../exigir-admin";
import BotaoApagarReforco from "./botao-apagar-reforco";

export const metadata: Metadata = { title: "Quotas do ano · Definições" };

const CLASSE_CAMPO =
  "rounded-lg border border-pergaminho-300 bg-white px-3 py-2.5 text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

export default async function PaginaDefinicoesQuotas() {
  await exigirAdminOuRedirecionar();

  const ano = await anoDeExercicio();
  const [fracoes, quotasDoAno, reforcos, categorias] = await Promise.all([
    carregarFracoes(),
    carregarQuotasDoAno(ano),
    carregarReforcosDoAno(ano),
    carregarCategorias(),
  ]);

  // Quotizações fica de fora: já tem a sua própria lógica de mês a mês, e
  // escolhê-la aqui criaria ambiguidade com o formulário de lançamento.
  const categoriasReceita = categorias.filter(
    (c) => c.natureza === "receita" && c.ativo && c.nome !== "Quotizações",
  );
  const categoriaPorOmissao =
    categoriasReceita.find((c) => c.nome === "Reforço Fundos Obras")?.id ??
    categoriasReceita[0]?.id ??
    "";

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

      <Painel
        titulo={`Reforços extraordinários de ${ano}`}
        descricao='Um valor único por fração, com prazo próprio — por exemplo, 200€ por fração para obras. Ao contrário da quota, pode haver vários no mesmo ano.'
      >
        <div className="flex flex-col gap-5">
          {reforcos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-pergaminho-200 text-left">
                    <th className="px-3 py-2.5 font-medium text-verdete-800">
                      Descrição
                    </th>
                    <th className="px-3 py-2.5 font-medium text-pergaminho-600">
                      Categoria
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-pergaminho-600">
                      Valor por fração
                    </th>
                    <th className="px-3 py-2.5 font-medium text-pergaminho-600">
                      Prazo
                    </th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {reforcos.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-pergaminho-100 last:border-0"
                    >
                      <th
                        scope="row"
                        className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-verdete-900"
                      >
                        {r.descricao}
                      </th>
                      <td className="px-3 py-2.5 text-pergaminho-600">
                        {r.categorias?.nome ?? "—"}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-pergaminho-600">
                        {euros(Number(r.valor_fracao))}
                      </td>
                      <td className="tabular px-3 py-2.5 text-pergaminho-600">
                        {dataCurta(r.data_limite)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <BotaoApagarReforco id={r.id} descricao={r.descricao} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-pergaminho-200 pt-5">
            <h3 className="mb-4 font-display text-base font-semibold text-verdete-900">
              Criar novo reforço
            </h3>
            {categoriasReceita.length === 0 ? (
              <Vazio>
                Ainda não há nenhuma categoria de receita. Cria uma em
                Definições.
              </Vazio>
            ) : (
              <FormularioAccao accao={criarReforco} rotulo="Criar reforço">
                <input type="hidden" name="ano" value={ano} />
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label
                      htmlFor="reforco-descricao"
                      className="text-sm font-medium text-verdete-800"
                    >
                      Descrição
                      <span className="text-ocre-600"> *</span>
                    </label>
                    <input
                      id="reforco-descricao"
                      name="descricao"
                      required
                      placeholder="Ex.: Reforço para obras"
                      className={CLASSE_CAMPO}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="reforco-valor"
                      className="text-sm font-medium text-verdete-800"
                    >
                      Valor por fração
                      <span className="text-ocre-600"> *</span>
                    </label>
                    <input
                      id="reforco-valor"
                      name="valor_fracao"
                      inputMode="decimal"
                      required
                      placeholder="200,00"
                      className={CLASSE_CAMPO}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="reforco-prazo"
                      className="text-sm font-medium text-verdete-800"
                    >
                      Data limite de pagamento
                      <span className="text-ocre-600"> *</span>
                    </label>
                    <input
                      id="reforco-prazo"
                      name="data_limite"
                      type="date"
                      required
                      className={CLASSE_CAMPO}
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label
                      htmlFor="reforco-categoria"
                      className="text-sm font-medium text-verdete-800"
                    >
                      Categoria de receita
                      <span className="text-ocre-600"> *</span>
                    </label>
                    <select
                      id="reforco-categoria"
                      name="categoria_id"
                      required
                      defaultValue={categoriaPorOmissao}
                      className={CLASSE_CAMPO}
                    >
                      {categoriasReceita.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-pergaminho-500">
                      É a categoria em que os pagamentos deste reforço entram no
                      mapa de origem e aplicação de fundos.
                    </p>
                  </div>
                </div>
              </FormularioAccao>
            )}
          </div>
        </div>
      </Painel>
    </div>
  );
}
