import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina, LigacaoFicheiro } from "@/components/ui";
import { perfilAtual } from "@/lib/dados";
import { guiasVisiveis } from "@/lib/guias";

export const metadata: Metadata = { title: "Guia" };

/**
 * Um guia aberto dentro da aplicação, no visualizador de PDF do browser.
 *
 * Alguns browsers de telemóvel (Safari no iPhone) mostram só a primeira
 * página de um PDF dentro de um iframe; por isso há sempre também a ligação
 * para o abrir num separador novo, onde aparece inteiro.
 */
export default async function PaginaGuia({
  params,
}: {
  params: Promise<{ guia: string }>;
}) {
  const [{ guia: id }, perfil] = await Promise.all([params, perfilAtual()]);
  const guia = guiasVisiveis(perfil?.admin === true).find((g) => g.id === id);
  if (!guia) notFound();

  const endereco = `/api/guias/${guia.id}`;

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina
        sobretitulo="Guias de utilização"
        titulo={guia.titulo}
        accao={
          <div className="flex flex-wrap gap-3">
            <LigacaoFicheiro href={endereco} target="_blank" rel="noreferrer" variante="secundario">
              Abrir num separador novo
            </LigacaoFicheiro>
            <LigacaoFicheiro href={`${endereco}?descarregar=1`} download={guia.nomeDescarga}>
              Descarregar PDF
            </LigacaoFicheiro>
          </div>
        }
      />

      <Link
        href="/guias"
        className="-mt-3 mb-5 inline-block text-sm text-pergaminho-500 underline-offset-4 transition-colors duration-150 hover:text-verdete-700 hover:underline focus-visible:outline-2 focus-visible:outline-verdete-500 active:text-verdete-900"
      >
        ← Todos os guias
      </Link>

      <iframe
        src={endereco}
        title={guia.titulo}
        className="h-[calc(100dvh-16rem)] min-h-[32rem] w-full rounded-xl border border-pergaminho-200 bg-white shadow-[var(--shadow-baixo)]"
      />
    </div>
  );
}
