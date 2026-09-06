"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type ItemNavegacao = { href: string; rotulo: string };

export default function Navegacao({
  itens,
  nome,
  papel,
}: {
  itens: ItemNavegacao[];
  nome: string;
  papel: string;
}) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);

  const ativo = (href: string) =>
    href === "/" ? caminho === "/" : caminho.startsWith(href);

  return (
    <>
      {/* Barra superior, só em ecrãs pequenos */}
      <div className="flex items-center justify-between border-b border-pergaminho-200 bg-white px-4 py-3 lg:hidden">
        <span className="font-display text-base font-semibold text-verdete-900">
          Gestão de Condomínio
        </span>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls="menu-principal"
          className="rounded-lg border border-pergaminho-300 px-3 py-1.5 text-sm text-verdete-800 transition-colors duration-150 hover:bg-pergaminho-100 active:bg-pergaminho-200"
        >
          {aberto ? "Fechar" : "Menu"}
        </button>
      </div>

      <nav
        id="menu-principal"
        className={`${aberto ? "block" : "hidden"} border-b border-pergaminho-200 bg-white lg:block lg:border-r lg:border-b-0`}
        aria-label="Navegação principal"
      >
        <div className="flex h-full flex-col lg:w-60">
          <div className="hidden items-center gap-3 px-5 py-6 lg:flex">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-verdete-700 font-display text-base font-semibold text-pergaminho-50 shadow-[var(--shadow-medio)]"
            >
              C
            </span>
            <span className="font-display leading-tight font-semibold text-verdete-900">
              Gestão de
              <br />
              Condomínio
            </span>
          </div>

          <ul className="flex flex-col gap-1 px-3 py-3 lg:py-0">
            {itens.map((item) => {
              const selecionado = ativo(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setAberto(false)}
                    aria-current={selecionado ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2.5 text-sm transition-[background-color,color,transform] duration-150 ease-[var(--ease-saida)] active:scale-[0.99] ${
                      selecionado
                        ? "bg-verdete-700 font-medium text-pergaminho-50 shadow-[var(--shadow-baixo)]"
                        : "text-verdete-800 hover:bg-pergaminho-100"
                    }`}
                  >
                    {item.rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto border-t border-pergaminho-200 px-5 py-4">
            <p className="truncate text-sm font-medium text-verdete-900">
              {nome}
            </p>
            <p className="text-xs text-pergaminho-500">{papel}</p>
            <form action="/auth/sair" method="post" className="mt-3">
              <button
                type="submit"
                className="text-sm text-pergaminho-600 underline-offset-4 transition-colors duration-150 hover:text-verdete-700 hover:underline"
              >
                Terminar sessão
              </button>
            </form>
          </div>
        </div>
      </nav>
    </>
  );
}
