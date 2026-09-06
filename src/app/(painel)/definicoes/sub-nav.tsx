"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/definicoes/condominio", rotulo: "Condomínio" },
  { href: "/definicoes/fracoes", rotulo: "Frações" },
  { href: "/definicoes/quotas", rotulo: "Quotas do ano" },
  { href: "/definicoes/contas", rotulo: "Contas" },
  { href: "/definicoes/fornecedores", rotulo: "Fornecedores" },
  { href: "/definicoes/extratos", rotulo: "Extratos bancários" },
];

/** Navegação secundária das Definições, entre as quatro áreas de configuração. */
export default function SubNavDefinicoes() {
  const caminho = usePathname();

  return (
    <nav aria-label="Áreas das definições" className="border-b border-pergaminho-200">
      <ul className="-mb-px flex flex-wrap gap-1">
        {ABAS.map((aba) => {
          const ativo = caminho.startsWith(aba.href);
          return (
            <li key={aba.href}>
              <Link
                href={aba.href}
                aria-current={ativo ? "page" : undefined}
                className={`inline-block rounded-t-lg border-b-2 px-4 py-2.5 text-sm transition-[color,border-color,background-color] duration-150 ease-[var(--ease-saida)] ${
                  ativo
                    ? "border-verdete-700 font-medium text-verdete-900"
                    : "border-transparent text-pergaminho-600 hover:border-pergaminho-300 hover:text-verdete-800"
                }`}
              >
                {aba.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
