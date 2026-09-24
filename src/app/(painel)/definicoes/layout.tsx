import { redirect } from "next/navigation";
import { CabecalhoPagina } from "@/components/ui";
import { perfilAtual } from "@/lib/dados";
import SubNavDefinicoes from "./sub-nav";

/**
 * As páginas de definições são sempre renderizadas a pedido, pela mesma razão
 * do layout do painel: sem isto uma compilação sem variáveis de ambiente
 * pré-renderiza-as como estáticas.
 */
export const dynamic = "force-dynamic";

export default async function LayoutDefinicoes({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/entrar");

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina
        sobretitulo={perfil.admin ? "Administração" : "A tua conta"}
        titulo="Definições"
        descricao={
          perfil.admin
            ? "Dados do condomínio, prazos, frações, fornecedores e importação de extratos bancários."
            : "Só a administração acede às restantes áreas. Aqui podes alterar a tua palavra-passe."
        }
      />

      <SubNavDefinicoes admin={perfil.admin} />

      <div className="mt-6 sm:mt-8">{children}</div>
    </div>
  );
}
