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
  if (!perfil?.admin) redirect("/");

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina
        sobretitulo="Administração"
        titulo="Definições"
        descricao="Dados do condomínio, prazos, frações, fornecedores e importação de extratos bancários."
      />

      <SubNavDefinicoes />

      <div className="mt-8">{children}</div>
    </div>
  );
}
