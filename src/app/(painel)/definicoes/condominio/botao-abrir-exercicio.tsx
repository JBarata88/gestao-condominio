"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { abrirExercicio, type Resultado } from "../accoes";

function Submeter() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-sm text-verdete-700 underline-offset-4 transition-colors duration-150 hover:text-verdete-900 hover:underline disabled:opacity-60"
    >
      {pending ? "A abrir…" : "Abrir"}
    </button>
  );
}

/**
 * Abre um exercício sem saldos de abertura, transportando o fecho do ano
 * anterior — a mesma acção do painel "Abrir o exercício" mais abaixo, mas
 * por linha na tabela, para qualquer ano, não só o que está a ser
 * consultado no seletor do topo.
 */
export default function BotaoAbrirExercicio({ ano }: { ano: number }) {
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    abrirExercicio,
    null,
  );

  if (estado && !estado.ok) {
    return (
      <p role="alert" className="text-xs text-[#a63a2b]">
        {estado.mensagem}
      </p>
    );
  }

  return (
    <form action={despachar}>
      <input type="hidden" name="ano" value={ano} />
      <Submeter />
    </form>
  );
}
