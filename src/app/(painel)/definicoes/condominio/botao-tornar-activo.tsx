"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { definirExercicioActivo, type Resultado } from "../accoes";

function Submeter() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-sm text-pergaminho-500 underline-offset-4 transition-colors duration-150 hover:text-verdete-700 hover:underline disabled:opacity-60"
    >
      {pending ? "A activar…" : "Tornar activo"}
    </button>
  );
}

/**
 * Torna um exercício já aberto no exercício activo. Ao ter sucesso, a linha
 * passa a "activo" e este botão desaparece sozinho — não precisa de mensagem
 * de confirmação própria.
 */
export default function BotaoTornarActivo({ ano }: { ano: number }) {
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    definirExercicioActivo,
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
