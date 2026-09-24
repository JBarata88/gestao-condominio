"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Campo } from "@/components/formulario-accao";
import type { Fracao } from "@/lib/tipos-bd";
import { guardarFracao, type Resultado } from "../accoes";

const CLASSE_SELECT =
  "rounded-lg border border-pergaminho-300 bg-white px-3 py-2.5 text-verdete-950 transition-colors duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

function BotaoGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-verdete-700 px-4 py-2 text-sm font-medium text-pergaminho-50 shadow-[var(--shadow-baixo)] transition-[transform,background-color] duration-200 ease-[var(--ease-mola)] hover:-translate-y-0.5 hover:bg-verdete-600 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0"
    >
      {pending ? "A guardar…" : "Guardar"}
    </button>
  );
}

/**
 * Uma fração, em duas linhas de tabela: a de leitura, sempre visível, e a de
 * edição, que só aparece depois de "Editar" e ocupa a largura toda — o mesmo
 * padrão da tabela de Movimentos.
 */
export default function LinhaFracao({
  fracao,
  ano,
  administrador,
}: {
  fracao: Fracao;
  /** Ano do exercício em consulta: a administração é associada a este ano. */
  ano: number;
  /** Se esta fração administra o condomínio no ano em consulta. */
  administrador: boolean;
}) {
  const [aEditar, setAEditar] = useState(false);
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    guardarFracao,
    null,
  );

  useEffect(() => {
    if (estado?.ok) setAEditar(false);
  }, [estado]);

  if (!aEditar) {
    return (
      <tr className="border-b border-pergaminho-100 transition-colors duration-150 hover:bg-pergaminho-50">
        <th
          scope="row"
          className="px-4 py-2.5 text-left font-medium whitespace-nowrap text-verdete-900"
        >
          {fracao.letra}
          <span className="ml-2 font-normal text-pergaminho-500">
            {fracao.andar}
          </span>
        </th>
        <td className="px-4 py-2.5 text-verdete-900">
          {fracao.condomino_nome ?? "—"}
        </td>
        <td className="px-4 py-2.5 text-pergaminho-600">
          {fracao.email ?? fracao.telefone ? (
            <>
              {fracao.email && <div>{fracao.email}</div>}
              {fracao.telefone && <div>{fracao.telefone}</div>}
            </>
          ) : (
            "—"
          )}
        </td>
        <td className="px-4 py-2.5">
          {fracao.ativo ? (
            <span className="text-[#2f5c3b]">Activa</span>
          ) : (
            <span className="text-pergaminho-400">Inactiva</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          {administrador ? (
            <span className="text-ocre-700">Sim</span>
          ) : (
            <span className="text-pergaminho-400">—</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-right">
          <button
            type="button"
            onClick={() => setAEditar(true)}
            className="rounded-md px-3 py-2 text-xs text-pergaminho-600 transition-colors duration-150 hover:bg-verdete-700/8 hover:text-verdete-800"
          >
            Editar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-pergaminho-100 bg-ocre-50/40">
      <td colSpan={6} className="px-4 py-4">
        <form action={despachar} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={fracao.id} />
          <input type="hidden" name="ordem" value={fracao.ordem} />
          <input type="hidden" name="ano" value={ano} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo nome="letra" etiqueta="Fração" valor={fracao.letra} obrigatorio />
            <Campo nome="andar" etiqueta="Andar" valor={fracao.andar} obrigatorio />
            <Campo
              nome="condomino_nome"
              etiqueta="Nome do condómino"
              valor={fracao.condomino_nome}
            />
            <Campo nome="email" etiqueta="Email" tipo="email" valor={fracao.email} />
            <Campo nome="telefone" etiqueta="Telefone" valor={fracao.telefone} />
            <Campo nome="permilagem" etiqueta="Permilagem" valor={fracao.permilagem} />

            <div className="flex flex-col gap-2">
              <label
                htmlFor={`tratamento-${fracao.id}`}
                className="text-sm font-medium text-verdete-800"
              >
                Tratamento nos recibos
              </label>
              <select
                id={`tratamento-${fracao.id}`}
                name="tratamento"
                defaultValue={fracao.tratamento}
                className={CLASSE_SELECT}
              >
                <option value="masculino">do condómino</option>
                <option value="feminino">da condómina</option>
              </select>
            </div>

            <label className="flex items-center gap-3 self-end pb-2.5 text-sm text-verdete-800">
              <input
                type="checkbox"
                name="ativo"
                defaultChecked={fracao.ativo}
                className="size-4 accent-[#274a43]"
              />
              Fração activa
            </label>

            <label className="flex items-start gap-3 self-end rounded-lg border border-pergaminho-200 bg-pergaminho-50 p-3 text-sm text-verdete-800">
              <input
                type="checkbox"
                name="administracao"
                defaultChecked={administrador}
                className="mt-0.5 size-4 accent-[#274a43]"
              />
              <span>
                <span className="font-medium">Administra o condomínio em {ano}</span>
                <span className="block text-pergaminho-600">
                  Só informativo: aparece em Painel, Quotas e Relatórios. Não
                  dá acesso na aplicação — isso define-se em Contas.
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <BotaoGuardar />
            <button
              type="button"
              onClick={() => setAEditar(false)}
              className="rounded-lg border border-pergaminho-300 bg-white px-4 py-2 text-sm text-verdete-800 transition-colors duration-150 hover:border-pergaminho-400"
            >
              Cancelar
            </button>
            {estado && !estado.ok && (
              <p role="alert" className="text-sm text-[#a63a2b]">
                {estado.mensagem}
              </p>
            )}
          </div>
        </form>
      </td>
    </tr>
  );
}
