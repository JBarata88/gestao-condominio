"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Botao } from "@/components/ui";
import { alterarPropriaPalavraPasse, type Resultado } from "./accoes";

const CLASSE_CAMPO =
  "rounded-lg border border-pergaminho-300 bg-white px-3 py-2.5 text-verdete-950 transition-colors duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

function BotaoSubmeter() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "A guardar…" : "Alterar palavra-passe"}
    </Botao>
  );
}

export default function FormularioPalavraPasse() {
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    alterarPropriaPalavraPasse,
    null,
  );
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok) formulario.current?.reset();
  }, [estado]);

  return (
    <form ref={formulario} action={despachar} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="nova-palavra-passe" className="text-sm font-medium text-verdete-800">
            Nova palavra-passe
          </label>
          <input
            id="nova-palavra-passe"
            name="palavra_passe"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={CLASSE_CAMPO}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="confirmar-palavra-passe" className="text-sm font-medium text-verdete-800">
            Confirmar palavra-passe
          </label>
          <input
            id="confirmar-palavra-passe"
            name="confirmacao"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={CLASSE_CAMPO}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <BotaoSubmeter />
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
  );
}
