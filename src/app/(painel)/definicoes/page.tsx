import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Definições" };

/** As Definições abrem sempre numa das quatro áreas. */
export default function PaginaDefinicoes() {
  redirect("/definicoes/condominio");
}
