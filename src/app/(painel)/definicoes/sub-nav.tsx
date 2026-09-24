"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS_ADMIN = [
  { href: "/definicoes/condominio", rotulo: "Condomínio" },
  { href: "/definicoes/fracoes", rotulo: "Frações" },
  { href: "/definicoes/quotas", rotulo: "Quotas do ano" },
  { href: "/definicoes/orcamento", rotulo: "Orçamento" },
  { href: "/definicoes/contas", rotulo: "Contas" },
  { href: "/definicoes/fornecedores", rotulo: "Fornecedores" },
  { href: "/definicoes/extratos", rotulo: "Extratos bancários" },
];

const ABA_CONTA = { href: "/definicoes/conta", rotulo: "Conta" };

/**
 * Navegação secundária das Definições. Um condómino sem acesso de
 * administrador só vê "Conta", para poder alterar a sua palavra-passe — as
 * restantes áreas nem chegam a ser pedidas (ver exigirAdminOuRedirecionar).
 */
export default function SubNavDefinicoes({ admin }: { admin: boolean }) {
  const caminho = usePathname();
  const abas = admin ? [...ABAS_ADMIN, ABA_CONTA] : [ABA_CONTA];

  return (
    <nav
      aria-label="Áreas das definições"
      className="-mx-4 overflow-x-auto border-b border-pergaminho-200 px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex gap-1 whitespace-nowrap sm:-mb-px sm:flex-wrap">
        {abas.map((aba) => {
          const ativo = caminho.startsWith(aba.href);
          return (
            <li key={aba.href}>
              <Link
                href={aba.href}
                aria-current={ativo ? "page" : undefined}
                className={`inline-block rounded-t-lg border-b-2 px-3 py-3 text-sm sm:px-4 sm:py-2.5 transition-[color,border-color,background-color] duration-150 ease-[var(--ease-saida)] ${
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
