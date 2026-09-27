import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina, Etiqueta, Vazio } from "@/components/ui";
import { carregarActas, perfilAtual } from "@/lib/dados";
import { dataCurta } from "@/lib/formatos";

export const metadata: Metadata = { title: "Assembleia de Condóminos" };

export default async function PaginaActas() {
  const [perfil, actas] = await Promise.all([perfilAtual(), carregarActas()]);
  const admin = perfil?.admin === true;

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina sobretitulo="Atas das assembleias" titulo="Assembleia de Condóminos" />

      {actas.length === 0 ? (
        <Vazio>
          Ainda não há atas publicadas.
          {admin && " Prepara-as em Definições › Assembleia de Condóminos."}
        </Vazio>
      ) : (
        <ul className="flex flex-col gap-3">
          {actas.map((a) => (
            <li key={a.id}>
              <Link
                href={`/actas/${a.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pergaminho-200 bg-white p-4 shadow-[var(--shadow-baixo)] transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-mola)] hover:-translate-y-0.5 hover:border-pergaminho-300 hover:shadow-[var(--shadow-medio)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdete-500 active:translate-y-0 sm:p-5"
              >
                <span>
                  <span className="block font-display text-lg font-semibold text-verdete-900">
                    Ata n.º {a.numero}
                  </span>
                  <span className="tabular text-sm text-pergaminho-600">
                    Assembleia de {dataCurta(a.data)}
                  </span>
                </span>
                {admin && a.estado === "rascunho" && (
                  <Etiqueta tom="aviso">Rascunho — só a administração vê</Etiqueta>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
