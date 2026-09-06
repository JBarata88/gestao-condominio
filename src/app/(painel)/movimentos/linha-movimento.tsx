"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { dataCurta, euros } from "@/lib/formatos";
import type { LinhaConta } from "./seccao-conta";
import { editarMovimento, type Resultado } from "./accoes";
import BotaoApagar from "./botao-apagar";
import SeletorMesQuota, {
  textoIntervalo,
  type ValorMesQuota,
} from "./seletor-mes-quota";

export type CategoriaEscolha = {
  id: string;
  nome: string;
  natureza: "receita" | "despesa" | "transferencia";
};
export type FracaoEscolha = { id: string; letra: string; andar: string };

const CLASSE_CAMPO =
  "w-full rounded-lg border border-pergaminho-300 bg-white px-3 py-2 text-sm text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

function BotaoGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-verdete-700 px-4 py-2 text-sm font-medium text-pergaminho-50 shadow-[var(--shadow-baixo)] transition-[transform,background-color] duration-200 ease-[var(--ease-mola)] hover:-translate-y-0.5 hover:bg-verdete-600 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0"
    >
      {pending ? "A guardar…" : "Guardar"}
    </button>
  );
}

/**
 * Uma linha de movimento, com edição pela administração.
 *
 * Fica sempre em duas linhas de tabela: a de leitura, que existe sempre, e a
 * de edição, que só aparece depois de clicar em "Editar" e ocupa a largura
 * inteira da tabela num só formulário, em vez de transformar cada célula num
 * campo separado.
 */
export default function LinhaMovimento({
  l,
  saldo,
  colunas,
  categorias,
  fracoes,
  ano,
}: {
  l: LinhaConta;
  /** Saldo real da conta depois deste movimento. */
  saldo: number;
  /** Número de colunas da tabela, para a linha de edição ocupar a largura toda. */
  colunas: number;
  categorias: CategoriaEscolha[];
  fracoes: FracaoEscolha[];
  ano: number;
}) {
  const [aEditar, setAEditar] = useState(false);
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    editarMovimento,
    null,
  );

  const [sentido, setSentido] = useState<"receita" | "despesa">(
    l.despesa > 0 ? "despesa" : "receita",
  );
  const [categoriaId, setCategoriaId] = useState(l.categoria_id);

  // Fecha o formulário sozinho quando a gravação é bem sucedida, sem exigir
  // um segundo clique em "Fechar".
  useEffect(() => {
    if (estado?.ok) setAEditar(false);
  }, [estado]);

  const categoriaEscolhida = categorias.find((c) => c.id === categoriaId);
  const eQuota = categoriaEscolhida?.nome === "Quotizações";
  const compativeis = categorias.filter(
    (c) => c.natureza === sentido || c.natureza === "transferencia",
  );

  const valorAtual = l.despesa > 0 ? l.despesa : l.receita;

  // Quando ainda não há mês atribuído a uma quota, sugere o mês da própria
  // data do movimento, tal como o ecrã de importação já faz. É só um ponto de
  // partida: continua editável, e o administrador pode sempre trocar para
  // outro mês, escolher um intervalo, ou deixar em branco.
  const [mesQuota, setMesQuota] = useState<ValorMesQuota>({
    de: l.quota_mes
      ? l.quota_mes.slice(0, 7)
      : eQuota && sentido === "receita"
        ? l.data.slice(0, 7)
        : "",
    ate: l.quota_mes_fim ? l.quota_mes_fim.slice(0, 7) : "",
  });

  if (!aEditar) {
    return (
      <tr className="border-b border-pergaminho-100 transition-colors duration-150 hover:bg-pergaminho-50">
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
              ({l.fracoes.letra}
              {textoIntervalo(l.quota_mes, l.quota_mes_fim) && (
                <> · {textoIntervalo(l.quota_mes, l.quota_mes_fim)}</>
              )}
              )
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
          {euros(saldo)}
        </td>
        <td className="px-4 py-2.5 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={() => setAEditar(true)}
            className="rounded-md px-2 py-1 text-xs text-pergaminho-600 transition-colors duration-150 hover:bg-verdete-700/8 hover:text-verdete-800"
          >
            Editar
          </button>
          {l.extrato_linha_id ? (
            <span
              className="ml-1 text-xs text-pergaminho-400"
              title="Importado de um extrato bancário. Pode editar-se, mas não apagar-se aqui."
            >
              extrato
            </span>
          ) : (
            <span className="ml-1">
              <BotaoApagar id={l.id} descricao={l.descricao ?? dataCurta(l.data)} />
            </span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-pergaminho-100 bg-ocre-50/40">
      <td colSpan={colunas} className="px-4 py-4">
        <form action={despachar} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={l.id} />

          {l.extrato_linha_id && (
            <p className="rounded-lg border border-ocre-200 bg-ocre-50 px-3 py-2 text-xs text-ocre-800">
              Este movimento veio de um extrato bancário. Corrigir a categoria,
              a fração ou o mês da quota é seguro. Mudar a data ou o valor faz
              esta linha deixar de bater com o extrato do banco.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`data-${l.id}`}
                className="text-xs font-medium tracking-wide text-pergaminho-600 uppercase"
              >
                Data
              </label>
              <input
                id={`data-${l.id}`}
                name="data"
                type="date"
                required
                defaultValue={l.data}
                className={CLASSE_CAMPO}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`sentido-${l.id}`}
                className="text-xs font-medium tracking-wide text-pergaminho-600 uppercase"
              >
                Sentido
              </label>
              <select
                id={`sentido-${l.id}`}
                name="sentido"
                value={sentido}
                onChange={(e) => {
                  const novo = e.target.value as "receita" | "despesa";
                  setSentido(novo);
                  // Uma categoria de despesa não pode ficar escolhida ao
                  // mudar para receita, e vice-versa.
                  if (categoriaEscolhida && categoriaEscolhida.natureza !== novo) {
                    setCategoriaId("");
                  }
                }}
                className={CLASSE_CAMPO}
              >
                <option value="despesa">Saída</option>
                <option value="receita">Entrada</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`valor-${l.id}`}
                className="text-xs font-medium tracking-wide text-pergaminho-600 uppercase"
              >
                Valor
              </label>
              <input
                id={`valor-${l.id}`}
                name="valor"
                required
                inputMode="decimal"
                defaultValue={valorAtual.toFixed(2).replace(".", ",")}
                className={CLASSE_CAMPO}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`categoria-${l.id}`}
                className="text-xs font-medium tracking-wide text-pergaminho-600 uppercase"
              >
                Categoria
              </label>
              <select
                id={`categoria-${l.id}`}
                name="categoria_id"
                required
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className={CLASSE_CAMPO}
              >
                <option value="">Escolher…</option>
                {compativeis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 lg:col-span-2">
              <label
                htmlFor={`descricao-${l.id}`}
                className="text-xs font-medium tracking-wide text-pergaminho-600 uppercase"
              >
                Descrição
              </label>
              <input
                id={`descricao-${l.id}`}
                name="descricao"
                defaultValue={l.descricao ?? ""}
                className={CLASSE_CAMPO}
              />
            </div>

            {/* A fração e o mês só interessam a receitas de Quotizações: é o
                que faz o pagamento aparecer na matriz de Quotas. */}
            {eQuota && sentido === "receita" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`fracao-${l.id}`}
                    className="text-xs font-medium tracking-wide text-pergaminho-600 uppercase"
                  >
                    Fração
                  </label>
                  <select
                    id={`fracao-${l.id}`}
                    name="fracao_id"
                    defaultValue={l.fracao_id ?? ""}
                    className={CLASSE_CAMPO}
                  >
                    <option value="">Sem fração</option>
                    {fracoes.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.letra} · {f.andar}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-2">
                  <span className="text-xs font-medium tracking-wide text-pergaminho-600 uppercase">
                    Mês da quota
                  </span>
                  <input type="hidden" name="quota_mes" value={mesQuota.de} />
                  <input type="hidden" name="quota_mes_fim" value={mesQuota.ate} />
                  <SeletorMesQuota
                    idPrefix={`mes-${l.id}`}
                    ano={ano}
                    valor={mesQuota}
                    aoMudar={setMesQuota}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <BotaoGuardar />
            <button
              type="button"
              onClick={() => setAEditar(false)}
              className="rounded-lg border border-pergaminho-300 bg-white px-4 py-2 text-sm text-verdete-800 transition-colors duration-150 hover:border-pergaminho-400"
            >
              Cancelar
            </button>
            {estado && !estado.ok && (
              <p role="alert" className="text-sm text-[#a63a2b]">
                {estado.mensagem}
              </p>
            )}
          </div>
        </form>
      </td>
    </tr>
  );
}
