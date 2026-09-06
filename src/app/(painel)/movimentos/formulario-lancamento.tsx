"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Botao } from "@/components/ui";
import { adicionarMovimento, type Resultado } from "./accoes";
import SeletorMesQuota, {
  MES_QUOTA_VAZIO,
  type ValorMesQuota,
} from "./seletor-mes-quota";

export type CategoriaEscolha = {
  id: string;
  nome: string;
  natureza: "receita" | "despesa" | "transferencia";
};

export type FracaoEscolha = { id: string; letra: string; andar: string };

const CLASSE_CAMPO =
  "w-full rounded-lg border border-pergaminho-300 bg-white px-3 py-2.5 text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

function BotaoSubmeter() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "A lançar…" : "Lançar movimento"}
    </Botao>
  );
}

/**
 * Lançamento manual de um movimento.
 *
 * Os movimentos bancários entram pela importação do extrato. Os de caixa não
 * têm extrato nenhum de onde vir, por isso é aqui que são registados.
 */
export default function FormularioLancamento({
  conta,
  categorias,
  fracoes,
  ano,
}: {
  conta: "caixa" | "banco";
  categorias: CategoriaEscolha[];
  fracoes: FracaoEscolha[];
  ano: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    adicionarMovimento,
    null,
  );

  const [sentido, setSentido] = useState<"receita" | "despesa">("despesa");
  const [categoriaId, setCategoriaId] = useState("");
  const [mesQuota, setMesQuota] = useState<ValorMesQuota>(MES_QUOTA_VAZIO);

  const categoriaEscolhida = categorias.find((c) => c.id === categoriaId);
  const eQuota = categoriaEscolhida?.nome === "Quotizações";

  // Uma categoria de receita não deve poder ser lançada como despesa.
  const compativeis = categorias.filter(
    (c) => c.natureza === sentido || c.natureza === "transferencia",
  );

  if (!aberto) {
    return (
      <div className="border-t border-pergaminho-200 px-6 py-4">
        <Botao variante="secundario" onClick={() => setAberto(true)}>
          Lançar movimento à mão
        </Botao>
        {estado?.ok && (
          <p role="status" className="mt-3 text-sm text-[#2f5c3b]">
            {estado.mensagem}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-pergaminho-200 bg-pergaminho-50/50 px-6 py-5">
      <h3 className="mb-4 font-display text-lg font-semibold text-verdete-900">
        Novo movimento de {conta === "caixa" ? "caixa" : "banco"}
      </h3>

      <form action={despachar} className="flex flex-col gap-5">
        <input type="hidden" name="conta" value={conta} />

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-verdete-800">
            Sentido
          </legend>
          <div className="flex gap-2">
            {(
              [
                ["despesa", "Saída"],
                ["receita", "Entrada"],
              ] as const
            ).map(([valor, rotulo]) => (
              <label
                key={valor}
                className={`cursor-pointer rounded-lg border px-4 py-2 text-sm transition-[background-color,border-color] duration-150 ${
                  sentido === valor
                    ? valor === "receita"
                      ? "border-[#3f7a4e] bg-[#3f7a4e]/12 font-medium text-[#2f5c3b]"
                      : "border-[#a63a2b] bg-[#a63a2b]/10 font-medium text-[#7d2c20]"
                    : "border-pergaminho-300 bg-white text-verdete-800 hover:border-pergaminho-400"
                }`}
              >
                <input
                  type="radio"
                  name="sentido"
                  value={valor}
                  checked={sentido === valor}
                  onChange={() => {
                    setSentido(valor);
                    setCategoriaId("");
                  }}
                  className="sr-only"
                />
                {rotulo}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor={`data-${conta}`} className="text-sm font-medium text-verdete-800">
              Data
            </label>
            <input
              id={`data-${conta}`}
              name="data"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={CLASSE_CAMPO}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={`valor-${conta}`} className="text-sm font-medium text-verdete-800">
              Valor
            </label>
            <input
              id={`valor-${conta}`}
              name="valor"
              required
              inputMode="decimal"
              placeholder="120,00"
              className={CLASSE_CAMPO}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={`categoria-${conta}`} className="text-sm font-medium text-verdete-800">
              Categoria
            </label>
            <select
              id={`categoria-${conta}`}
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

          <div className="flex flex-col gap-2">
            <label htmlFor={`descricao-${conta}`} className="text-sm font-medium text-verdete-800">
              Descrição
            </label>
            <input
              id={`descricao-${conta}`}
              name="descricao"
              placeholder="Limpeza do prédio JAN 2026"
              className={CLASSE_CAMPO}
            />
          </div>
        </div>

        {/* A fração e o mês só aparecem quando são úteis, para não encher o
            formulário de campos que ficam quase sempre vazios. */}
        {eQuota && sentido === "receita" && (
          <div className="grid gap-5 rounded-lg border border-ocre-200 bg-ocre-50/60 p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor={`fracao-${conta}`} className="text-sm font-medium text-verdete-800">
                Fração
              </label>
              <select
                id={`fracao-${conta}`}
                name="fracao_id"
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

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-verdete-800">
                Mês da quota
              </span>
              <input type="hidden" name="quota_mes" value={mesQuota.de} />
              <input type="hidden" name="quota_mes_fim" value={mesQuota.ate} />
              <SeletorMesQuota
                idPrefix={`mes-${conta}`}
                ano={ano}
                valor={mesQuota}
                aoMudar={setMesQuota}
              />
            </div>

            <p className="text-sm text-ocre-800 sm:col-span-2">
              Basta indicar a fração para este pagamento entrar na conta
              corrente da fração. O mês é só uma anotação, para ficar escrito
              a que período esta transferência respeitava.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <BotaoSubmeter />
          <Botao
            type="button"
            variante="secundario"
            onClick={() => setAberto(false)}
          >
            Fechar
          </Botao>
          {estado && (
            <p
              role="status"
              className={`text-sm ${estado.ok ? "text-[#2f5c3b]" : "text-[#a63a2b]"}`}
            >
              {estado.mensagem}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
