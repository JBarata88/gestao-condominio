import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BotaoImprimir from "@/components/botao-imprimir";
import { CabecalhoPagina, Etiqueta } from "@/components/ui";
import { carregarActa, perfilAtual, type SeguroActa } from "@/lib/dados";
import { dataCurta } from "@/lib/formatos";
import {
  formatarPermilagem,
  fraseDecisao,
  frasePorExtensoDaData,
  partesDoComentario,
  partirAndar,
  tituloLimpo,
} from "@/lib/relatorios/acta";

export const metadata: Metadata = { title: "Ata" };

const CELA = "border border-pergaminho-300 px-2 py-1.5 print:border-black";
const CABECA = `${CELA} bg-pergaminho-50 text-center font-semibold text-verdete-900 print:bg-transparent print:text-black`;

/**
 * A acta tal como sai no documento Word, para ler no ecrã. A RLS só devolve
 * rascunhos à administração; a um condómino um rascunho dá 404.
 */
export default async function PaginaActa({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [perfil, completa] = await Promise.all([perfilAtual(), carregarActa(id)]);
  if (!completa) notFound();

  const { acta, topicos, presencas, seguros } = completa;
  const admin = perfil?.admin === true;
  const local = acta.local.trim().replace(/,$/, "");
  const documentoPresencas = presencas.map((p) => ({ ...p, nome: p.condomino_nome }));

  return (
    <div className="mx-auto max-w-3xl">
      <CabecalhoPagina
        sobretitulo={`Assembleia de ${dataCurta(acta.data)}`}
        titulo={`Ata n.º ${acta.numero}`}
        accao={
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <BotaoImprimir />
            <a
              href={`/api/actas/${acta.id}`}
              className="inline-flex items-center justify-center rounded-lg bg-verdete-700 px-5 py-3 text-sm font-medium text-pergaminho-50 shadow-[var(--shadow-medio)] transition-[transform,background-color,box-shadow] duration-200 ease-[var(--ease-mola)] hover:-translate-y-0.5 hover:bg-verdete-600 hover:shadow-[var(--shadow-alto)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdete-500 active:translate-y-0 active:bg-verdete-800"
            >
              Descarregar Word
            </a>
          </div>
        }
      />

      <div className="-mt-3 mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/actas"
          className="text-sm text-pergaminho-500 underline-offset-4 transition-colors duration-150 hover:text-verdete-700 hover:underline focus-visible:outline-2 focus-visible:outline-verdete-500 active:text-verdete-900"
        >
          ← Todas as atas
        </Link>
        {admin && (
          <span className="flex items-center gap-3">
            {acta.estado === "rascunho" && (
              <Etiqueta tom="aviso">Rascunho — só a administração vê</Etiqueta>
            )}
            <Link
              href={`/definicoes/actas/${acta.id}`}
              className="text-sm font-medium text-verdete-700 underline-offset-4 transition-colors duration-150 hover:text-verdete-900 hover:underline focus-visible:outline-2 focus-visible:outline-verdete-500 active:text-verdete-950"
            >
              Editar
            </Link>
          </span>
        )}
      </div>

      <article className="rounded-xl border border-pergaminho-200 bg-white px-5 py-6 text-[15px] leading-[1.7] text-pergaminho-800 shadow-[var(--shadow-baixo)] sm:px-10 sm:py-10 print:border-0 print:p-0 print:text-[10pt] print:leading-normal print:text-black print:shadow-none">
        <h2 className="mb-6 text-center font-display text-xl font-semibold text-verdete-950 print:text-black">
          Ata n.º {acta.numero}
        </h2>

        <p className="text-justify">
          {frasePorExtensoDaData(acta.data)}, pelas {acta.hora_inicio} horas
          {local ? `, ${local}` : ""}, teve lugar a assembleia de condóminos para
          deliberar sobre os trabalhos que a seguir se indica:
        </p>

        <ol className="my-5 list-decimal pl-10 font-semibold text-verdete-950 print:text-black">
          {topicos.map((t) => (
            <li key={t.id}>{tituloLimpo(t.titulo)};</li>
          ))}
        </ol>

        <p>Estiveram presentes os condóminos das seguintes frações:</p>
        <div className="my-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm print:min-w-0 print:text-[9pt]">
            <thead>
              <tr>
                <th colSpan={2} className={CABECA}>ANDARES</th>
                <th className={CABECA}>FRAÇÃO</th>
                <th className={CABECA}>CONDÓMINOS</th>
                <th className={CABECA}>PERMILAGEM</th>
                <th className={CABECA}>FORMA</th>
              </tr>
            </thead>
            <tbody>
              {documentoPresencas.map((p) => {
                const [piso, lado] = partirAndar(p.andar);
                return (
                  <tr key={p.fracao_id}>
                    <td className={CELA}>{piso}</td>
                    <td className={`${CELA} text-center`}>{lado}</td>
                    <td className={`${CELA} text-center`}>{p.letra}</td>
                    <td className={CELA}>{p.nome}</td>
                    <td className={`${CELA} tabular text-right`}>{formatarPermilagem(p.permilagem)}</td>
                    <td className={CELA}>{p.forma}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 mb-8 text-justify">
          Verificada a presença de um número de condóminos representativos da
          maioria do capital do prédio e suficiente para a tomada de
          deliberação, iniciou-se a reunião.
        </p>

        {topicos.map((t, i) => (
          <section key={t.id} className="mb-6 break-inside-avoid-page">
            <h3 className="mb-2 font-semibold text-verdete-950 print:text-black">
              {i + 1}. {tituloLimpo(t.titulo)}.
            </h3>
            {partesDoComentario(t.comentario).map((parte, j) =>
              parte.tipo === "texto" ? (
                parte.blocos.map((bloco, k) => (
                  <p key={`${j}-${k}`} className="mb-3 text-justify whitespace-pre-line">
                    {bloco}
                  </p>
                ))
              ) : (
                <TabelaSeguros key={j} seguros={seguros} />
              ),
            )}
            {t.decisao && (
              <p className="mb-3">
                <span
                  className={`font-medium ${t.decisao === "reprovado" ? "text-[#7d2c20]" : "text-[#2f5c3b]"} print:text-black`}
                >
                  {fraseDecisao(t.decisao)}
                </span>
              </p>
            )}
          </section>
        ))}

        <p className="text-justify">
          Nada mais havendo a tratar foram os trabalhos encerrados
          {acta.hora_fim ? ` por volta das ${acta.hora_fim} horas` : ""}, lavrando-se
          a presente ata que vai ser assinada pelos condóminos presentes e
          entregue cópia aos condóminos ausentes.
        </p>
      </article>
    </div>
  );
}

/**
 * A tabela de apólices e recibos, como no ponto 2 da Acta nº 35: o andar
 * aparece uma vez para as duas frações do mesmo piso.
 */
function TabelaSeguros({ seguros }: { seguros: SeguroActa[] }) {
  if (seguros.length === 0) return null;
  const pisos = seguros.map((s) => partirAndar(s.andar)[0]);

  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-sm print:min-w-0 print:text-[9pt]">
        <thead>
          <tr>
            <th colSpan={2} className={CABECA}>ANDARES</th>
            <th className={CABECA}>FRAÇÃO</th>
            <th className={CABECA}>CONDÓMINOS</th>
            <th className={CABECA}>SEGURO</th>
            <th className={CABECA}>RECIBO</th>
          </tr>
        </thead>
        <tbody>
          {seguros.map((s, i) => {
            const [piso, lado] = partirAndar(s.andar);
            const continua = i > 0 && pisos[i - 1] === piso;
            let linhas = 1;
            while (!continua && pisos[i + linhas] === piso) linhas++;
            return (
              <tr key={s.fracao_id}>
                {!continua && (
                  <td rowSpan={linhas} className={`${CELA} text-center text-lg`}>
                    {piso}
                  </td>
                )}
                <td className={`${CELA} text-center`}>{lado}</td>
                <td className={`${CELA} text-center`}>{s.letra}</td>
                <td className={`${CELA} text-center`}>{s.condomino_nome}</td>
                <td className={`${CELA} text-center font-medium`}>{s.apolice ? "SIM" : ""}</td>
                <td className={`${CELA} text-center font-medium`}>{s.recibo ? "SIM" : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
