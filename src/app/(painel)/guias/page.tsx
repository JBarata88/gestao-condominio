import type { Metadata } from "next";
import { CabecalhoPagina, Etiqueta, LigacaoBotao, LigacaoFicheiro } from "@/components/ui";
import { perfilAtual } from "@/lib/dados";
import { dataCurta } from "@/lib/formatos";
import { BUCKET_GUIAS, guiasVisiveis } from "@/lib/guias";
import { clienteAdministrativo } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Guias de utilização" };

type Detalhes = { tamanho: number | null; atualizado: string | null };

/** Tamanho e data de cada PDF no bucket, por nome de ficheiro. */
async function detalhesDosFicheiros(): Promise<Map<string, Detalhes>> {
  try {
    const { data } = await clienteAdministrativo().storage.from(BUCKET_GUIAS).list();
    return new Map(
      (data ?? []).map((f) => [
        f.name,
        {
          tamanho: typeof f.metadata?.size === "number" ? f.metadata.size : null,
          atualizado: f.updated_at ? f.updated_at.slice(0, 10) : null,
        },
      ]),
    );
  } catch {
    // Sem chave de serviço ou sem bucket: os cartões aparecem como "por publicar".
    return new Map();
  }
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export default async function PaginaGuias() {
  const perfil = await perfilAtual();
  const guias = guiasVisiveis(perfil?.admin === true);
  const detalhes = await detalhesDosFicheiros();

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina
        sobretitulo="Ajuda"
        titulo="Guias de utilização"
        descricao="Explicações passo a passo, com imagens da aplicação. Lê aqui ou descarrega o PDF para guardar ou imprimir."
      />

      <ul className="grid gap-5 sm:grid-cols-2">
        {guias.map((guia) => {
          const d = detalhes.get(guia.ficheiro);
          return (
            <li
              key={guia.id}
              className="flex flex-col rounded-xl border border-pergaminho-200 bg-white p-5 shadow-[var(--shadow-baixo)] sm:p-6"
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden
                  className="grid h-14 w-11 shrink-0 place-items-center rounded-md border border-verdete-800 bg-verdete-700 font-display text-xs font-semibold tracking-wide text-pergaminho-50 shadow-[var(--shadow-medio)]"
                >
                  PDF
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-verdete-950">
                    {guia.titulo}
                  </h2>
                  {guia.soAdmin && (
                    <p className="mt-1">
                      <Etiqueta tom="neutro">só administração</Etiqueta>
                    </p>
                  )}
                </div>
              </div>

              <p className="mt-4 flex-1 leading-relaxed text-pergaminho-600">{guia.descricao}</p>

              {d ? (
                <p className="tabular mt-4 text-sm text-pergaminho-500">
                  {d.tamanho !== null && `${megabytes(d.tamanho)} · `}
                  {d.atualizado && `atualizado a ${dataCurta(d.atualizado)}`}
                </p>
              ) : (
                <p className="mt-4 text-sm text-ocre-700">Ainda não publicado.</p>
              )}

              {d && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <LigacaoBotao href={`/guias/${guia.id}`}>Ler guia</LigacaoBotao>
                  <LigacaoFicheiro
                    href={`/api/guias/${guia.id}?descarregar=1`}
                    download={guia.nomeDescarga}
                    variante="secundario"
                  >
                    Descarregar PDF
                  </LigacaoFicheiro>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
