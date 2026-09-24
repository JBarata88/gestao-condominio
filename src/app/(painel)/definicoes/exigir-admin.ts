import "server-only";

import { redirect } from "next/navigation";
import { perfilAtual, type PerfilAtual } from "@/lib/dados";

/**
 * Só a administração vê as áreas de configuração. Um condómino sem esse
 * acesso é reencaminhado para a única área de Definições que lhe pertence: a
 * sua própria conta.
 */
export async function exigirAdminOuRedirecionar(): Promise<PerfilAtual> {
  const perfil = await perfilAtual();
  if (!perfil?.admin) redirect("/definicoes/conta");
  return perfil;
}
