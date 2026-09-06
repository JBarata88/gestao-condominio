"use client";

import { useState } from "react";
import { MESES } from "@/lib/formatos";

/** "" ou "AAAA-MM". */
export type ValorMesQuota = { de: string; ate: string };

export const MES_QUOTA_VAZIO: ValorMesQuota = { de: "", ate: "" };

const CLASSE_CAMPO =
  "w-full rounded-lg border border-pergaminho-300 bg-white px-3 py-2 text-sm text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

/**
 * Escolha do mês, ou intervalo de meses, a que um pagamento de quota respeita.
 *
 * É só uma anotação: a grelha de Quotas não depende disto para calcular quem
 * está em dia, soma o total pago e distribui pelos meses sozinha. Isto serve
 * para deixar escrito, no próprio movimento, a que meses uma transferência em
 * concreto respeitava, tal como a folha antiga escrevia "QUOTA JAN-JUL".
 *
 * Controlado pelo componente-pai, que é quem decide o que fazer com o valor
 * (normalmente, colocá-lo em dois campos escondidos de um formulário).
 */
export default function SeletorMesQuota({
  idPrefix,
  ano,
  valor,
  aoMudar,
}: {
  idPrefix: string;
  ano: number;
  valor: ValorMesQuota;
  aoMudar: (novo: ValorMesQuota) => void;
}) {
  const [modo, setModo] = useState<"unico" | "intervalo">(
    valor.ate && valor.ate !== valor.de ? "intervalo" : "unico",
  );

  const opcoes = MESES.map((nome, i) => ({
    valor: `${ano}-${String(i + 1).padStart(2, "0")}`,
    rotulo: `${nome} de ${ano}`,
  }));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {(
          [
            ["unico", "Mês único"],
            ["intervalo", "Intervalo de meses"],
          ] as const
        ).map(([m, rotulo]) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setModo(m);
              if (m === "unico") aoMudar({ de: valor.de, ate: "" });
            }}
            className={`rounded-md px-2 py-1 text-xs transition-colors duration-150 ${
              modo === m
                ? "bg-verdete-700 font-medium text-pergaminho-50"
                : "bg-pergaminho-100 text-pergaminho-600 hover:bg-pergaminho-200"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          id={`${idPrefix}-de`}
          aria-label={modo === "intervalo" ? "A partir de" : "Mês da quota"}
          value={valor.de}
          onChange={(e) => {
            const de = e.target.value;
            // Se o fim ficou antes do novo início, arrasta-o também.
            const ate = valor.ate && valor.ate < de ? de : valor.ate;
            aoMudar({ de, ate: modo === "intervalo" ? ate : "" });
          }}
          className={CLASSE_CAMPO}
        >
          <option value="">{modo === "intervalo" ? "De…" : "Sem mês"}</option>
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>

        {modo === "intervalo" && (
          <select
            id={`${idPrefix}-ate`}
            aria-label="Até"
            value={valor.ate}
            onChange={(e) => aoMudar({ ...valor, ate: e.target.value })}
            className={CLASSE_CAMPO}
          >
            <option value="">até…</option>
            {opcoes
              .filter((o) => !valor.de || o.valor >= valor.de)
              .map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
          </select>
        )}
      </div>
    </div>
  );
}

// Mantido aqui como reexportação: o texto e a expansão de um intervalo de
// meses vivem em @/lib/formatos, para poderem ser usados também no servidor
// (por exemplo, na geração dos recibos), sem depender deste módulo de cliente.
export { textoIntervaloQuota as textoIntervalo } from "@/lib/formatos";
