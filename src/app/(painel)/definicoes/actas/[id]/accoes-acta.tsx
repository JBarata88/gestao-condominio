"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Botao } from "@/components/ui";
import type { EstadoActa } from "@/lib/tipos-bd";
import { apagarActa, mudarEstadoActa, type Resultado } from "../../accoes";

function SubmeterEstado({ publicar }: { publicar: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" variante={publicar ? "acento" : "secundario"} disabled={pending}>
      {pending ? "A guardar…" : publicar ? "Publicar ata" : "Voltar a rascunho"}
    </Botao>
  );
}

/** Publica ou retira a acta da secção Assembleia de Condóminos. */
export function BotaoEstadoActa({ id, estado }: { id: string; estado: EstadoActa }) {
  const [resultado, despachar] = useActionState<Resultado | null, FormData>(mudarEstadoActa, null);
  const publicar = estado === "rascunho";

  return (
    <form action={despachar} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={publicar ? "publicada" : "rascunho"} />
      <SubmeterEstado publicar={publicar} />
      {resultado && (
        <p role={resultado.ok ? "status" : "alert"}
          className={`text-sm ${resultado.ok ? "text-[#2f5c3b]" : "text-[#a63a2b]"}`}>
          {resultado.mensagem}
        </p>
      )}
    </form>
  );
}

function Confirmar({ aoCancelar }: { aoCancelar: () => void }) {
  const { pending } = useFormStatus();
  return (
    <span className="flex items-center gap-3">
      <span className="text-sm text-verdete-800">Eliminar esta ata?</span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[#a63a2b]/40 bg-[#a63a2b]/10 px-3 py-1.5 text-xs font-medium text-[#7d2c20] transition-colors duration-150 hover:bg-[#a63a2b]/18 focus-visible:outline-2 focus-visible:outline-[#a63a2b] active:bg-[#a63a2b]/25 disabled:opacity-60"
      >
        {pending ? "A eliminar…" : "Confirmar"}
      </button>
      <button
        type="button"
        onClick={aoCancelar}
        disabled={pending}
        className="text-xs text-pergaminho-600 transition-colors duration-150 hover:text-verdete-800 focus-visible:outline-2 focus-visible:outline-verdete-500 active:text-verdete-950"
      >
        Não
      </button>
    </span>
  );
}

/** Elimina a acta, com confirmação em dois passos. */
export function BotaoApagarActa({ id }: { id: string }) {
  const [aConfirmar, setAConfirmar] = useState(false);
  const [estado, despachar] = useActionState<Resultado | null, FormData>(apagarActa, null);

  if (estado && !estado.ok) {
    return (
      <p role="alert" className="text-sm text-[#a63a2b]">
        {estado.mensagem}
      </p>
    );
  }

  return (
    <form action={despachar}>
      <input type="hidden" name="id" value={id} />
      {aConfirmar ? (
        <Confirmar aoCancelar={() => setAConfirmar(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAConfirmar(true)}
          className="text-sm text-pergaminho-500 underline-offset-4 transition-colors duration-150 hover:text-[#7d2c20] hover:underline focus-visible:outline-2 focus-visible:outline-verdete-500 active:text-[#a63a2b]"
        >
          Eliminar ata
        </button>
      )}
    </form>
  );
}
