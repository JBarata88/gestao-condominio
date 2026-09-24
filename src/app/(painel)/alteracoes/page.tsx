import type { Metadata } from "next";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CabecalhoPagina, Painel } from "@/components/ui";
import { analisarChangelog } from "@/lib/changelog";

export const metadata: Metadata = { title: "O que mudou" };

const PADRAO_INLINE = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;

/** Interpreta só o **negrito** e os [links](url) do CHANGELOG — o resto é texto simples. */
function TextoInline({ texto }: { texto: string }) {
  const partes: ReactNode[] = [];
  let ultimo = 0;
  let chave = 0;
  let m: RegExpExecArray | null;
  PADRAO_INLINE.lastIndex = 0;
  while ((m = PADRAO_INLINE.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1] !== undefined) {
      partes.push(
        <strong key={chave++} className="font-medium text-verdete-900">
          {m[1]}
        </strong>,
      );
    } else {
      partes.push(
        <a
          key={chave++}
          href={m[3]}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-verdete-700"
        >
          {m[2]}
        </a>,
      );
    }
    ultimo = PADRAO_INLINE.lastIndex;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return <>{partes}</>;
}

/** Lê o CHANGELOG.md do repositório — o mesmo ficheiro que documenta cada versão. */
export default function PaginaAlteracoes() {
  const conteudo = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8");
  const changelog = analisarChangelog(conteudo);

  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina sobretitulo="Gestão de Condomínio" titulo="O que mudou" />

      {changelog.preambulo.length > 0 && (
        <p className="mb-8 leading-relaxed text-pergaminho-600">
          {changelog.preambulo.map((linha, i) => (
            <span key={i}>
              <TextoInline texto={linha} />
              {i < changelog.preambulo.length - 1 && " "}
            </span>
          ))}
        </p>
      )}

      <div className="flex flex-col gap-6">
        {changelog.versoes.map((v) => (
          <Painel key={v.versao} titulo={`Versão ${v.versao}`} descricao={v.data}>
            <div className="flex flex-col gap-5">
              {v.seccoes.map((s) => (
                <div key={s.categoria}>
                  <h3 className="mb-2 text-xs font-semibold tracking-[0.15em] text-ocre-600 uppercase">
                    {s.categoria}
                  </h3>
                  <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-pergaminho-700">
                    {s.itens.map((item, i) => (
                      <li key={i} className="pl-4 -indent-4">
                        <span aria-hidden className="mr-1.5">
                          •
                        </span>
                        <TextoInline texto={item.texto} />
                        {item.subitens.length > 0 && (
                          <ul className="mt-1.5 ml-5 flex flex-col gap-1.5 text-pergaminho-600">
                            {item.subitens.map((sub, j) => (
                              <li key={j} className="list-disc marker:text-pergaminho-400">
                                <TextoInline texto={sub} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Painel>
        ))}
      </div>
    </div>
  );
}
