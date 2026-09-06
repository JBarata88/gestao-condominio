"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { eliminarExercicio, type Resultado } from "../accoes";

function Confirmar({
  ano,
  aoCancelar,
}: {
  ano: number;
  aoCancelar: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <span className="flex items-center justify-end gap-3">
      <span className="text-sm text-verdete-800">Eliminar {ano}?</span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[#a63a2b]/40 bg-[#a63a2b]/10 px-3 py-1.5 text-xs font-medium text-[#7d2c20] transition-colors duration-150 hover:bg-[#a63a2b]/18 disabled:opacity-60"
      >
        {pending ? "A eliminar…" : "Confirmar"}
      </button>
      <button
        type="button"
        onClick={aoCancelar}
        disabled={pending}
        className="text-xs text-pergaminho-600 transition-colors duration-150 hover:text-verdete-800"
      >
        Não
      </button>
    </span>
  );
}

/**
 * Elimina um exercício (saldos de abertura e quotas do ano), com confirmação em
 * dois passos. Quando o ano não pode ser eliminado, mostra o motivo em vez do
 * botão. Os movimentos nunca são apagados por aqui.
 */
export default function BotaoApagarExercicio({
  ano,
  bloqueado,
  motivo,
}: {
  ano: number;
  bloqueado: boolean;
  motivo?: string;
}) {
  const [aConfirmar, setAConfirmar] = useState(false);
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    eliminarExercicio,
    null,
  );

  if (estado && !estado.ok) {
    return (
      <p role="alert" className="text-sm text-[#a63a2b]">
        {estado.mensagem}
      </p>
    );
  }
  if (estado?.ok) {
    return (
      <p role="status" className="text-sm text-[#2f5c3b]">
        {estado.mensagem}
      </p>
    );
  }
  if (bloqueado) {
    return <span className="text-xs text-pergaminho-400">{motivo}</span>;
  }

  return (
    <form action={despachar} className="flex justify-end">
      <input type="hidden" name="ano" value={ano} />
      {aConfirmar ? (
        <Confirmar ano={ano} aoCancelar={() => setAConfirmar(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAConfirmar(true)}
          aria-label={`Eliminar exercício de ${ano}`}
          className="text-sm text-pergaminho-500 underline-offset-4 transition-colors duration-150 hover:text-[#7d2c20] hover:underline"
        >
          Eliminar
        </button>
      )}
    </form>
  );
}
