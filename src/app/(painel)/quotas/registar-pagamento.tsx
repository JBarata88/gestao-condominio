"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Botao } from "@/components/ui";
import {
  adicionarMovimento,
  type Resultado,
} from "@/app/(painel)/movimentos/accoes";
import SeletorMesQuota, {
  type ValorMesQuota,
} from "@/app/(painel)/movimentos/seletor-mes-quota";

export type FracaoEscolha = {
  id: string;
  letra: string;
  andar: string;
  quotaMensal: number;
};

const CLASSE_CAMPO =
  "w-full rounded-lg border border-pergaminho-300 bg-white px-3 py-2.5 text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

function BotaoSubmeter() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "A registar…" : "Registar pagamento"}
    </Botao>
  );
}

/**
 * Regista o pagamento de uma quota directamente a partir da grelha de Quotas.
 *
 * É uma casca à volta da mesma acção usada em Movimentos: fixa a categoria em
 * "Quotizações" e o sentido em "receita", que é tudo o que uma quota alguma
 * vez é, e só pede o que muda de caso para caso: fração, mês, valor, conta e
 * data.
 */
export default function RegistarPagamento({
  fracoes,
  categoriaQuotasId,
  ano,
}: {
  fracoes: FracaoEscolha[];
  categoriaQuotasId: string;
  ano: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [fracaoId, setFracaoId] = useState("");
  const [mesQuota, setMesQuota] = useState<ValorMesQuota>({
    de: `${ano}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    ate: "",
  });
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    adicionarMovimento,
    null,
  );

  const fracao = fracoes.find((f) => f.id === fracaoId);

  if (!aberto) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Botao onClick={() => setAberto(true)}>Registar pagamento</Botao>
        {estado?.ok && (
          <p role="status" className="text-sm text-[#2f5c3b]">
            {estado.mensagem}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-pergaminho-200 bg-white p-5 shadow-[var(--shadow-baixo)]">
      <h2 className="mb-4 font-display text-lg font-semibold text-verdete-900">
        Registar pagamento de quota
      </h2>

      <form action={despachar} className="flex flex-col gap-5">
        <input type="hidden" name="categoria_id" value={categoriaQuotasId} />
        <input type="hidden" name="sentido" value="receita" />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="rp-fracao" className="text-sm font-medium text-verdete-800">
              Fração
            </label>
            <select
              id="rp-fracao"
              name="fracao_id"
              required
              value={fracaoId}
              onChange={(e) => setFracaoId(e.target.value)}
              className={CLASSE_CAMPO}
            >
              <option value="">Escolher…</option>
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
              idPrefix="rp-mes"
              ano={ano}
              valor={mesQuota}
              aoMudar={setMesQuota}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="rp-valor" className="text-sm font-medium text-verdete-800">
              Valor
            </label>
            <input
              id="rp-valor"
              name="valor"
              required
              inputMode="decimal"
              defaultValue={fracao ? fracao.quotaMensal.toFixed(2).replace(".", ",") : ""}
              key={fracaoId}
              className={CLASSE_CAMPO}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="rp-conta" className="text-sm font-medium text-verdete-800">
              Conta onde entrou
            </label>
            <select id="rp-conta" name="conta" required defaultValue="banco" className={CLASSE_CAMPO}>
              <option value="banco">Banco</option>
              <option value="caixa">Caixa</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="rp-data" className="text-sm font-medium text-verdete-800">
              Data do pagamento
            </label>
            <input
              id="rp-data"
              name="data"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={CLASSE_CAMPO}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="rp-descricao" className="text-sm font-medium text-verdete-800">
              Descrição
            </label>
            <input
              id="rp-descricao"
              name="descricao"
              placeholder="Quota de..."
              className={CLASSE_CAMPO}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <BotaoSubmeter />
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="rounded-lg border border-pergaminho-300 bg-white px-4 py-2.5 text-sm text-verdete-800 transition-colors duration-150 hover:border-pergaminho-400"
          >
            Fechar
          </button>
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
