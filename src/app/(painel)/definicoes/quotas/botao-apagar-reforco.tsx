"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { eliminarReforco, type Resultado } from "../accoes";

function Confirmar({
  descricao,
  aoCancelar,
}: {
  descricao: string;
  aoCancelar: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <span className="flex items-center justify-end gap-3">
      <span className="text-sm text-verdete-800">Eliminar &quot;{descricao}&quot;?</span>
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
 * Elimina um reforço, com confirmação em dois passos. Os movimentos ligados
 * a ele não são apagados, só deixam de o estar (ver eliminarReforco).
 */
export default function BotaoApagarReforco({
  id,
  descricao,
}: {
  id: string;
  descricao: string;
}) {
  const [aConfirmar, setAConfirmar] = useState(false);
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    eliminarReforco,
    null,
  );

  if (estado) {
    return (
      <p
        role={estado.ok ? "status" : "alert"}
        className={`text-sm ${estado.ok ? "text-[#2f5c3b]" : "text-[#a63a2b]"}`}
      >
        {estado.mensagem}
      </p>
    );
  }

  return (
    <form action={despachar} className="flex justify-end">
      <input type="hidden" name="id" value={id} />
      {aConfirmar ? (
        <Confirmar descricao={descricao} aoCancelar={() => setAConfirmar(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAConfirmar(true)}
          aria-label={`Eliminar reforço "${descricao}"`}
          className="text-sm text-pergaminho-500 underline-offset-4 transition-colors duration-150 hover:text-[#7d2c20] hover:underline"
        >
          Eliminar
        </button>
      )}
    </form>
  );
}
