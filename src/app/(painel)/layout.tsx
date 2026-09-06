import { Suspense } from "react";
import { redirect } from "next/navigation";
import Navegacao, { type ItemNavegacao } from "@/components/navegacao";
import SeletorAno from "@/components/seletor-ano";
import {
  anoDeExercicio,
  anosComExercicio,
  configurado,
  perfilAtual,
} from "@/lib/dados";
import PorConfigurar from "@/components/por-configurar";

/**
 * Todas as páginas autenticadas são renderizadas a pedido.
 *
 * Sem isto, uma compilação feita sem variáveis de ambiente pré-renderiza estas
 * páginas como estáticas, porque a leitura do perfil desiste antes de tocar
 * nos cookies. Em produção isso serviria a mesma página a toda a gente.
 */
export const dynamic = "force-dynamic";

const ITENS_ADMIN: ItemNavegacao[] = [
  { href: "/", rotulo: "Painel" },
  { href: "/movimentos", rotulo: "Movimentos" },
  { href: "/quotas", rotulo: "Quotas" },
  { href: "/relatorios", rotulo: "Relatórios" },
  { href: "/recibos", rotulo: "Recibos" },
  { href: "/definicoes", rotulo: "Definições" },
];

const ITENS_CONDOMINO: ItemNavegacao[] = [
  { href: "/", rotulo: "Painel" },
  { href: "/movimentos", rotulo: "Movimentos" },
  { href: "/quotas", rotulo: "Quotas" },
  { href: "/relatorios", rotulo: "Relatórios" },
];

export default async function LayoutPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!configurado()) return <PorConfigurar />;

  const perfil = await perfilAtual();
  if (!perfil) redirect("/entrar");

  const admin = perfil.admin;
  const [anos, anoActivo] = await Promise.all([
    anosComExercicio(),
    anoDeExercicio(),
  ]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <Navegacao
        itens={admin ? ITENS_ADMIN : ITENS_CONDOMINO}
        nome={perfil.nome ?? "Utilizador"}
        papel={admin ? "Administração" : "Condómino"}
      />
      <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mb-8 flex justify-end border-b border-pergaminho-200 pb-4">
          <Suspense fallback={null}>
            <SeletorAno anos={anos} anoActivo={anoActivo} />
          </Suspense>
        </div>
        {children}
      </main>
    </div>
  );
}
