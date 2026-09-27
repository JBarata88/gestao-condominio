"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Botao } from "@/components/ui";
import { criarActa, type Resultado } from "../accoes";

const CLASSE_CAMPO =
  "rounded-lg border border-pergaminho-300 bg-white px-3 py-2 text-sm text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

function Submeter() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "A criar…" : "Nova Assembleia"}
    </Botao>
  );
}

/** Cria a acta em rascunho e abre-a no editor (a acção redirecciona). */
export default function FormularioNovaActa({
  numeroSugerido,
  hoje,
}: {
  numeroSugerido: number;
  hoje: string;
}) {
  const [estado, despachar] = useActionState<Resultado | null, FormData>(criarActa, null);

  return (
    <form action={despachar} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="nova-acta-numero" className="text-xs font-medium text-verdete-800">
            Número
          </label>
          <input
            id="nova-acta-numero"
            name="numero"
            type="number"
            min={1}
            required
            defaultValue={numeroSugerido}
            className={`${CLASSE_CAMPO} w-24`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="nova-acta-data" className="text-xs font-medium text-verdete-800">
            Data da assembleia
          </label>
          <input
            id="nova-acta-data"
            name="data"
            type="date"
            required
            defaultValue={hoje}
            className={CLASSE_CAMPO}
          />
        </div>
        <Submeter />
      </div>
      {estado && !estado.ok && (
        <p role="alert" className="text-sm text-[#a63a2b]">
          {estado.mensagem}
        </p>
      )}
    </form>
  );
}
