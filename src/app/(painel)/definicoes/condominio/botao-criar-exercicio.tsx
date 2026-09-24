"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Botao } from "@/components/ui";
import { abrirExercicio, type Resultado } from "../accoes";

function Submeter() {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" variante="secundario" disabled={pending}>
      {pending ? "A criar…" : "Criar exercício"}
    </Botao>
  );
}

/**
 * Cria um exercício no ano escolhido — passado ou futuro, não assume que é
 * sempre o seguinte ao mais recente —, transportando o fecho do ano anterior
 * e as quotas em vigor. Fica "futuro" (ou "inactivo", se for um ano
 * passado) até alguém o tornar activo.
 */
export default function BotaoCriarExercicio({
  anoSugerido,
}: {
  anoSugerido: number;
}) {
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    abrirExercicio,
    null,
  );

  return (
    <form action={despachar} className="flex flex-col items-end gap-2">
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="ano-criar-exercicio"
            className="text-xs font-medium text-verdete-800"
          >
            Ano a criar
          </label>
          <input
            id="ano-criar-exercicio"
            name="ano"
            type="number"
            defaultValue={anoSugerido}
            required
            className="w-28 rounded-lg border border-pergaminho-300 bg-white px-3 py-2 text-sm text-verdete-950 transition-colors duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none"
          />
        </div>
        <Submeter />
      </div>
      {estado && (
        <p
          role={estado.ok ? "status" : "alert"}
          className={`text-sm ${estado.ok ? "text-[#2f5c3b]" : "text-[#a63a2b]"}`}
        >
          {estado.mensagem}
        </p>
      )}
    </form>
  );
}
