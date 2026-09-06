"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Botao, Etiqueta, Painel, Vazio } from "@/components/ui";
import { Campo } from "@/components/formulario-accao";
import {
  apagarConta,
  atualizarConta,
  criarConta,
  type Resultado,
} from "./accoes";

export type FracaoOpcao = {
  id: string;
  letra: string;
  andar: string;
  administracao: boolean;
};

export type ContaVista = {
  id: string;
  email: string;
  nome: string | null;
  papel: "admin" | "condomino";
  fracaoId: string | null;
  euProprio: boolean;
};

const CLASSE_SELECT =
  "rounded-lg border border-pergaminho-300 bg-white px-3 py-2.5 text-verdete-950 transition-colors duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

function BotaoSubmeter({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <Botao type="submit" disabled={pending}>
      {pending ? "A guardar…" : rotulo}
    </Botao>
  );
}

function Mensagem({ estado }: { estado: Resultado | null }) {
  if (!estado) return null;
  return (
    <p
      role="status"
      className={`text-sm ${estado.ok ? "text-[#2f5c3b]" : "text-[#a63a2b]"}`}
    >
      {estado.mensagem}
    </p>
  );
}

function OpcoesFracao({ fracoes }: { fracoes: FracaoOpcao[] }) {
  return (
    <>
      <option value="">— sem fração —</option>
      {fracoes.map((f) => (
        <option key={f.id} value={f.id}>
          {f.letra} · {f.andar}
          {f.administracao ? " (administração)" : ""}
        </option>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Nova conta
// ---------------------------------------------------------------------------
function FormularioNovaConta({ fracoes }: { fracoes: FracaoOpcao[] }) {
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    criarConta,
    null,
  );

  return (
    <Painel
      titulo="Nova conta"
      descricao="A conta fica activa de imediato. Comunica o email e a palavra-passe ao condómino; ele pode mudá-la depois."
    >
      <form action={despachar} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo nome="nome" etiqueta="Nome" />
          <Campo nome="email" etiqueta="Email" tipo="email" obrigatorio />
          <Campo
            nome="palavra_passe"
            etiqueta="Palavra-passe"
            tipo="text"
            obrigatorio
            dica="Pelo menos 8 caracteres."
          />
          <div className="flex flex-col gap-2">
            <label
              htmlFor="nova-fracao"
              className="text-sm font-medium text-verdete-800"
            >
              Fração associada
            </label>
            <select
              id="nova-fracao"
              name="fracao_id"
              defaultValue=""
              className={CLASSE_SELECT}
            >
              <OpcoesFracao fracoes={fracoes} />
            </select>
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-pergaminho-200 bg-pergaminho-50 p-3 text-sm text-verdete-800">
          <input type="checkbox" name="admin" className="mt-0.5 size-4 accent-[#274a43]" />
          <span>
            <span className="font-medium">Acesso de administrador</span>
            <span className="block text-pergaminho-600">
              Vê e edita todas as secções. Deixa desmarcado para uma conta de
              condómino normal.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <BotaoSubmeter rotulo="Criar conta" />
          <Mensagem estado={estado} />
        </div>
      </form>
    </Painel>
  );
}

// ---------------------------------------------------------------------------
// Linha de uma conta existente
// ---------------------------------------------------------------------------
function LinhaConta({
  conta,
  fracoes,
}: {
  conta: ContaVista;
  fracoes: FracaoOpcao[];
}) {
  const [estado, despachar] = useActionState<Resultado | null, FormData>(
    atualizarConta,
    null,
  );
  const [apagarEstado, despacharApagar] = useActionState<
    Resultado | null,
    FormData
  >(apagarConta, null);
  const [aConfirmar, setAConfirmar] = useState(false);

  const fracaoLigada = fracoes.find((f) => f.id === conta.fracaoId);
  const adminPelaFracao = fracaoLigada?.administracao ?? false;

  return (
    <Painel>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium text-verdete-900">
            {conta.nome ?? conta.email}
          </p>
          <p className="text-sm text-pergaminho-600">{conta.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {conta.euProprio && <Etiqueta tom="neutro">a tua conta</Etiqueta>}
          {conta.papel === "admin" ? (
            <Etiqueta tom="positivo">administrador</Etiqueta>
          ) : adminPelaFracao ? (
            <Etiqueta tom="positivo">admin pela fração</Etiqueta>
          ) : (
            <Etiqueta tom="neutro">condómino</Etiqueta>
          )}
          {!conta.fracaoId && conta.papel !== "admin" && (
            <Etiqueta tom="aviso">por atribuir</Etiqueta>
          )}
        </div>
      </div>

      <form action={despachar} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="id" value={conta.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label
              htmlFor={`fracao-${conta.id}`}
              className="text-sm font-medium text-verdete-800"
            >
              Fração associada
            </label>
            <select
              id={`fracao-${conta.id}`}
              name="fracao_id"
              defaultValue={conta.fracaoId ?? ""}
              className={CLASSE_SELECT}
            >
              <OpcoesFracao fracoes={fracoes} />
            </select>
          </div>

          <label className="flex items-center gap-3 self-end pb-2.5 text-sm text-verdete-800">
            <input
              type="checkbox"
              name="admin"
              defaultChecked={conta.papel === "admin"}
              className="size-4 accent-[#274a43]"
            />
            Acesso de administrador
          </label>
        </div>

        {adminPelaFracao && conta.papel !== "admin" && (
          <p className="text-sm text-pergaminho-500">
            Esta conta já é administradora por a fração {fracaoLigada?.letra}{" "}
            estar marcada como administração em Frações.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <BotaoSubmeter rotulo="Guardar" />
          <Mensagem estado={estado} />
        </div>
      </form>

      <div className="mt-4 border-t border-pergaminho-200 pt-4">
        {apagarEstado && !apagarEstado.ok ? (
          <p role="alert" className="text-sm text-[#a63a2b]">
            {apagarEstado.mensagem}
          </p>
        ) : conta.euProprio ? (
          <p className="text-sm text-pergaminho-400">
            Não podes apagar a tua própria conta.
          </p>
        ) : aConfirmar ? (
          <form action={despacharApagar} className="flex items-center gap-3">
            <input type="hidden" name="id" value={conta.id} />
            <span className="text-sm text-verdete-800">
              Apagar a conta {conta.email}? A conta perde o acesso de imediato.
            </span>
            <button
              type="submit"
              className="rounded-md border border-[#a63a2b]/40 bg-[#a63a2b]/10 px-3 py-1.5 text-xs font-medium text-[#7d2c20] transition-colors duration-150 hover:bg-[#a63a2b]/18"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setAConfirmar(false)}
              className="text-xs text-pergaminho-600 transition-colors duration-150 hover:text-verdete-800"
            >
              Não
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAConfirmar(true)}
            className="text-sm text-pergaminho-500 underline-offset-4 transition-colors duration-150 hover:text-[#7d2c20] hover:underline"
          >
            Apagar conta
          </button>
        )}
      </div>
    </Painel>
  );
}

// ---------------------------------------------------------------------------
// Gestor
// ---------------------------------------------------------------------------
export default function GestorContas({
  contas,
  fracoes,
}: {
  contas: ContaVista[];
  fracoes: FracaoOpcao[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <FormularioNovaConta fracoes={fracoes} />

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-semibold text-verdete-900">
          Contas existentes
        </h2>
        {contas.length === 0 ? (
          <Vazio>Ainda não há contas além da tua.</Vazio>
        ) : (
          contas.map((conta) => (
            <LinhaConta key={conta.id} conta={conta} fracoes={fracoes} />
          ))
        )}
      </section>
    </div>
  );
}
