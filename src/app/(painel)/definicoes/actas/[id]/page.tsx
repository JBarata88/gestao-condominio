import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Botao, Etiqueta, Painel } from "@/components/ui";
import { carregarActa, carregarFracoes } from "@/lib/dados";
import { exigirAdminOuRedirecionar } from "../../exigir-admin";
import { BotaoApagarActa, BotaoEstadoActa } from "./accoes-acta";
import EditorActa, { type FracaoEditor } from "./editor-acta";

export const metadata: Metadata = { title: "Assembleia · Definições" };

const CAMPO_CONVOCATORIA =
  "rounded-lg border border-pergaminho-300 bg-white px-3 py-2 text-sm text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

/** Proposta para a segunda convocação: uma semana depois, como no original. */
function semanaDepois(dataIso: string): string {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

const LIGACAO =
  "text-sm text-pergaminho-500 underline-offset-4 transition-colors duration-150 hover:text-verdete-700 hover:underline focus-visible:outline-2 focus-visible:outline-verdete-500 active:text-verdete-900";

export default async function PaginaEditarActa({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdminOuRedirecionar();
  const { id } = await params;

  const [completa, todasFracoes] = await Promise.all([carregarActa(id), carregarFracoes()]);
  if (!completa) notFound();
  const { acta, topicos, presencas, seguros } = completa;

  // Frações ativas, mais alguma inativa que já esteja na acta.
  const presentes = new Set(presencas.map((p) => p.fracao_id));
  const fracoes: FracaoEditor[] = todasFracoes
    .filter((f) => f.ativo || presentes.has(f.id))
    .map((f) => ({
      id: f.id,
      letra: f.letra,
      andar: f.andar,
      condominoNome: f.condomino_nome,
      permilagem: f.permilagem === null ? null : Number(f.permilagem),
    }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/definicoes/actas" className={LIGACAO}>
          ← Todas as atas
        </Link>
        {acta.estado === "publicada" ? (
          <Etiqueta tom="positivo">Publicada</Etiqueta>
        ) : (
          <Etiqueta tom="aviso">Rascunho — só a administração vê</Etiqueta>
        )}
      </div>

      <EditorActa
        fracoes={fracoes}
        acta={{
          id: acta.id,
          numero: acta.numero,
          data: acta.data,
          horaInicio: acta.hora_inicio,
          horaFim: acta.hora_fim ?? "",
          local: acta.local,
          topicos: topicos.map((t) => ({
            titulo: t.titulo,
            decisao: t.decisao,
            comentario: t.comentario,
          })),
          presencas: Object.fromEntries(
            presencas.map((p) => [p.fracao_id, { nome: p.condomino_nome, forma: p.forma }]),
          ),
          temTabelaSeguros: seguros.length > 0,
        }}
      />

      <Painel
        titulo="Convocatórias"
        descricao="Uma convocatória por condómino, com a data, a hora e a ordem de trabalhos guardadas acima. A segunda convocação vale se não houver quórum na primeira."
      >
        <form
          action={`/api/actas/${acta.id}/convocatorias`}
          method="get"
          className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="conv-sala" className="text-xs font-medium text-verdete-800">
              Local da reunião
            </label>
            <input
              id="conv-sala"
              name="sala"
              defaultValue="na sala de reuniões dos condóminos, no 5.º piso"
              className={CAMPO_CONVOCATORIA}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="conv-segunda" className="text-xs font-medium text-verdete-800">
              Segunda convocação
            </label>
            <input
              id="conv-segunda"
              name="segunda"
              type="date"
              required
              defaultValue={semanaDepois(acta.data)}
              className={CAMPO_CONVOCATORIA}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="conv-hora-segunda" className="text-xs font-medium text-verdete-800">
              Hora
            </label>
            <input
              id="conv-hora-segunda"
              name="horaSegunda"
              defaultValue={acta.hora_inicio}
              className={`${CAMPO_CONVOCATORIA} sm:w-24`}
            />
          </div>
          <div className="sm:col-span-3">
            <Botao type="submit" variante="secundario" disabled={topicos.length === 0}>
              Gerar convocatórias
            </Botao>
            {topicos.length === 0 && (
              <p className="mt-2 text-sm text-pergaminho-600">
                Define e guarda primeiro a ordem de trabalhos.
              </p>
            )}
          </div>
        </form>
      </Painel>

      <Painel
        titulo="Documento e publicação"
        descricao="O documento Word e a secção Assembleia de Condóminos usam a última versão guardada. Guarda antes de descarregar ou publicar."
      >
        <div className="flex flex-wrap items-start gap-4">
          <a
            href={`/api/actas/${acta.id}`}
            className="inline-flex items-center justify-center rounded-lg border border-pergaminho-300 bg-white px-5 py-3 text-sm font-medium text-verdete-800 transition-[transform,box-shadow,border-color] duration-200 ease-[var(--ease-mola)] hover:-translate-y-0.5 hover:border-pergaminho-400 hover:shadow-[var(--shadow-baixo)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdete-500 active:translate-y-0 active:bg-pergaminho-100"
          >
            Descarregar Word
          </a>
          <Link
            href={`/actas/${acta.id}`}
            className="inline-flex items-center justify-center rounded-lg px-3 py-3 text-sm font-medium text-verdete-700 underline-offset-4 transition-colors duration-150 hover:text-verdete-900 hover:underline focus-visible:outline-2 focus-visible:outline-verdete-500 active:text-verdete-950"
          >
            Pré-visualizar
          </Link>
          <BotaoEstadoActa id={acta.id} estado={acta.estado} />
        </div>
        <div className="mt-6 border-t border-pergaminho-200 pt-4">
          <BotaoApagarActa id={acta.id} />
        </div>
      </Painel>
    </div>
  );
}
