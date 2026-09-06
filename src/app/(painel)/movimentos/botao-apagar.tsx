"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { apagarMovimento, type Resultado } from "./accoes";

function Confirmar({ aoCancelar }: { aoCancelar: () => void }) {
  const { pending } = useFormStatus();
  return (
    <span className="flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[#a63a2b]/40 bg-[#a63a2b]/10 px-2 py-1 text-xs font-medium text-[#7d2c20] transition-colors duration-150 hover:bg-[#a63a2b]/18 disabled:opacity-60"
      >
        {pending ? "A apagar…" : "Confirmar"}
      </button>
      <button
        type="button"
        onClick={aoCancelar}
        disabled={pending}
        className="rounded-md px-2 py-1 text-xs text-pergaminho-600 transition-colors duration-150 hover:text-verdete-800"
      >
        Não
      </button>
    </span>
  );
}

/**
 * Apaga um movimento lançado à mão, com confirmação em dois passos.
 *
 * Um clique isolado numa tabela densa é fácil de dar por engano, e apagar um
 * movimento muda saldos e relatórios.
 */
export default function BotaoApagar({
  id,
  descricao,
}: {
  id: string;
  descricao: string;
}) {
  const [aConfirmar, setAConfirmar] = useState(false);
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    apagarMovimento,
    null,
  );

  if (estado && !estado.ok) {
    return (
      <span className="text-xs text-[#a63a2b]" role="alert">
        {estado.mensagem}
      </span>
    );
  }

  return (
    <form action={despachar} className="flex justify-end">
      <input type="hidden" name="id" value={id} />
      {aConfirmar ? (
        <Confirmar aoCancelar={() => setAConfirmar(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAConfirmar(true)}
          aria-label={`Apagar movimento ${descricao}`}
          className="rounded-md px-2 py-1 text-xs text-pergaminho-500 transition-colors duration-150 hover:bg-[#a63a2b]/10 hover:text-[#7d2c20] focus-visible:text-[#7d2c20]"
        >
          Apagar
        </button>
      )}
    </form>
  );
}
