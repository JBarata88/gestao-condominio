"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Botao } from "./ui";

export type Resultado = { ok: boolean; mensagem: string };

function BotaoSubmeter({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "A guardar…" : rotulo}
    </Botao>
  );
}

/**
 * Formulário ligado a uma acção de servidor, com mensagem de resultado.
 *
 * A mensagem é anunciada com role="status" para que um leitor de ecrã saiba
 * que a gravação terminou, já que visualmente nada mais muda.
 */
export default function FormularioAccao({
  accao,
  rotulo = "Guardar",
  children,
}: {
  accao: (
    anterior: Resultado | null,
    dados: FormData,
  ) => Promise<Resultado>;
  rotulo?: string;
  children: ReactNode;
}) {
  const [estado, despachar] = useActionState(accao, null);

  return (
    <form action={despachar} className="flex flex-col gap-5">
      {children}

      <div className="flex flex-wrap items-center gap-4">
        <BotaoSubmeter rotulo={rotulo} />
        {estado && (
          <p
            role="status"
            className={`text-sm ${
              estado.ok ? "text-[#2f5c3b]" : "text-[#a63a2b]"
            }`}
          >
            {estado.mensagem}
          </p>
        )}
      </div>
    </form>
  );
}

/** Campo de texto com etiqueta, usado por todos os formulários de definições. */
export function Campo({
  nome,
  etiqueta,
  valor,
  tipo = "text",
  obrigatorio,
  dica,
  ...resto
}: {
  nome: string;
  etiqueta: string;
  valor?: string | number | null;
  tipo?: string;
  obrigatorio?: boolean;
  dica?: string;
} & Omit<React.ComponentProps<"input">, "name" | "type" | "defaultValue">) {
  const id = `campo-${nome}`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-verdete-800">
        {etiqueta}
        {obrigatorio && <span className="text-ocre-600"> *</span>}
      </label>
      <input
        {...resto}
        id={id}
        name={nome}
        type={tipo}
        required={obrigatorio}
        defaultValue={valor ?? ""}
        aria-describedby={dica ? `${id}-dica` : undefined}
        className="rounded-lg border border-pergaminho-300 bg-white px-3 py-2.5 text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none"
      />
      {dica && (
        <p id={`${id}-dica`} className="text-sm text-pergaminho-500">
          {dica}
        </p>
      )}
    </div>
  );
}
