import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Cabeçalho de página, com sobretítulo em maiúsculas e título em serifado. */
export function CabecalhoPagina({
  sobretitulo,
  titulo,
  descricao,
  accao,
}: {
  sobretitulo?: string;
  titulo: string;
  descricao?: string;
  accao?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {sobretitulo && (
          <p className="font-display text-sm tracking-[0.2em] text-ocre-600 uppercase">
            {sobretitulo}
          </p>
        )}
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] text-verdete-950">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-2 max-w-2xl leading-relaxed text-pergaminho-600">
            {descricao}
          </p>
        )}
      </div>
      {accao}
    </header>
  );
}

/** Superfície elevada, o segundo plano do sistema de profundidade. */
export function Painel({
  titulo,
  descricao,
  children,
}: {
  titulo?: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-pergaminho-200 bg-white p-6 shadow-[var(--shadow-baixo)]">
      {titulo && (
        <h2 className="font-display text-xl font-semibold text-verdete-900">
          {titulo}
        </h2>
      )}
      {descricao && (
        <p className="mt-1.5 leading-relaxed text-pergaminho-600">
          {descricao}
        </p>
      )}
      <div className={titulo || descricao ? "mt-5" : undefined}>{children}</div>
    </section>
  );
}

const ESTILO_BOTAO = {
  primario:
    "bg-verdete-700 text-pergaminho-50 shadow-[var(--shadow-medio)] hover:-translate-y-0.5 hover:bg-verdete-600 hover:shadow-[var(--shadow-alto)] active:translate-y-0 active:bg-verdete-800",
  secundario:
    "border border-pergaminho-300 bg-white text-verdete-800 hover:-translate-y-0.5 hover:border-pergaminho-400 hover:shadow-[var(--shadow-baixo)] active:translate-y-0 active:bg-pergaminho-100",
  acento:
    "bg-ocre-600 text-white shadow-[var(--shadow-ocre)] hover:-translate-y-0.5 hover:bg-ocre-500 active:translate-y-0 active:bg-ocre-700",
} as const;

type Variante = keyof typeof ESTILO_BOTAO;

const BASE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium transition-[transform,background-color,box-shadow,border-color] duration-200 ease-[var(--ease-mola)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

export function Botao({
  variante = "primario",
  className = "",
  ...resto
}: ComponentProps<"button"> & { variante?: Variante }) {
  return (
    <button
      {...resto}
      className={`${BASE_BOTAO} ${ESTILO_BOTAO[variante]} ${className}`}
    />
  );
}

export function LigacaoBotao({
  variante = "primario",
  className = "",
  ...resto
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return (
    <Link
      {...resto}
      className={`${BASE_BOTAO} ${ESTILO_BOTAO[variante]} ${className}`}
    />
  );
}

/** Mensagem para listas vazias, em vez de uma tabela sem linhas. */
export function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-pergaminho-300 bg-pergaminho-50 px-5 py-8 text-center leading-relaxed text-pergaminho-600">
      {children}
    </p>
  );
}

/** Etiqueta de estado, com as cores do sistema. */
export function Etiqueta({
  tom,
  children,
}: {
  tom: "positivo" | "negativo" | "aviso" | "neutro";
  children: ReactNode;
}) {
  const tons = {
    positivo: "bg-[#3f7a4e]/10 text-[#2f5c3b] border-[#3f7a4e]/25",
    negativo: "bg-[#a63a2b]/10 text-[#7d2c20] border-[#a63a2b]/25",
    aviso: "bg-ocre-50 text-ocre-800 border-ocre-200",
    neutro: "bg-pergaminho-100 text-pergaminho-700 border-pergaminho-300",
  } as const;

  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${tons[tom]}`}
    >
      {children}
    </span>
  );
}
