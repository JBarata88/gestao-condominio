import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { perfilAtual } from "@/lib/dados";

export const metadata: Metadata = { title: "Definições" };

/** As Definições abrem sempre numa área: Condomínio para a administração, Conta para o resto. */
export default async function PaginaDefinicoes() {
  const perfil = await perfilAtual();
  redirect(perfil?.admin ? "/definicoes/condominio" : "/definicoes/conta");
}
