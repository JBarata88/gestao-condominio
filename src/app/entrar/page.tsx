import { Suspense } from "react";
import type { Metadata } from "next";
import FormularioEntrada from "./formulario";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function PaginaEntrar() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca. Gradientes radiais sobrepostos e grão, para o fundo
          não ficar um bloco de cor chapado. */}
      <section className="relative isolate hidden overflow-hidden bg-verdete-900 px-12 py-16 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: [
              "radial-gradient(120% 90% at 12% 8%, rgba(206,138,43,0.28), transparent 55%)",
              "radial-gradient(90% 70% at 88% 22%, rgba(66,116,104,0.55), transparent 60%)",
              "radial-gradient(140% 120% at 50% 108%, rgba(15,29,27,0.85), transparent 70%)",
            ].join(","),
          }}
        />
        <div aria-hidden className="grao absolute inset-0 -z-10" />

        <p className="font-display text-sm tracking-[0.2em] text-ocre-200 uppercase">
          Administração
        </p>

        <div className="max-w-md">
          <h1 className="font-display text-5xl leading-[1.05] font-semibold tracking-[-0.03em] text-pergaminho-50">
            As contas do condomínio,
            <span className="text-ocre-300"> sem folhas soltas.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-verdete-100/85">
            Movimentos, quotas, mapa de origem e aplicação de fundos e recibos,
            a partir de um único registo.
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-6 border-t border-verdete-100/15 pt-8">
          {[
            ["Saldos", "Sempre calculados"],
            ["Quotas", "Controlo mensal"],
            ["Recibos", "Gerados em segundos"],
          ].map(([termo, descricao]) => (
            <div key={termo}>
              <dt className="font-display text-base text-ocre-200">{termo}</dt>
              <dd className="mt-1 text-sm text-verdete-100/70">{descricao}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Formulário */}
      <section className="relative flex items-center justify-center px-6 py-14 sm:px-10">
        <div className="w-full max-w-sm">
          <header className="mb-9">
            <div className="mb-7 flex items-center gap-3 lg:hidden">
              <span
                aria-hidden
                className="grid size-10 place-items-center rounded-lg bg-verdete-700 font-display text-lg font-semibold text-pergaminho-50 shadow-[var(--shadow-medio)]"
              >
                C
              </span>
              <span className="font-display text-lg font-semibold text-verdete-900">
                Gestão de Condomínio
              </span>
            </div>

            <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-verdete-950">
              Entrar na conta
            </h2>
            <p className="mt-2 leading-relaxed text-pergaminho-600">
              Introduz as credenciais que te foram atribuídas.
            </p>
          </header>

          <Suspense
            fallback={
              <div className="h-72 animate-pulse rounded-lg bg-pergaminho-200/60" />
            }
          >
            <FormularioEntrada />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
