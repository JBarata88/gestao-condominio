"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Botao, Painel } from "@/components/ui";
import { MARCADOR_SEGUROS, temTabelaSeguros } from "@/lib/relatorios/acta-marcador";
import type { DecisaoTopico } from "@/lib/tipos-bd";
import { guardarActa, type ConteudoActa, type Resultado } from "../../accoes";

export type FracaoEditor = {
  id: string;
  letra: string;
  andar: string;
  condominoNome: string | null;
  permilagem: number | null;
};

type TopicoEditor = {
  chave: number;
  titulo: string;
  decisao: DecisaoTopico | null;
  comentario: string;
};

type PresencaEditor = { presente: boolean; nome: string; forma: string };

export type ActaEditor = {
  id: string;
  numero: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  local: string;
  topicos: Array<{ titulo: string; decisao: DecisaoTopico | null; comentario: string }>;
  /** Presenças já guardadas, por fração. */
  presencas: Record<string, { nome: string; forma: string }>;
  /** A acta já tem uma tabela de apólices guardada (que fica fixa). */
  temTabelaSeguros: boolean;
};

const CAMPO =
  "w-full rounded-lg border border-pergaminho-300 bg-white px-3 py-2 text-sm text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

const ETIQUETA = "text-sm font-medium text-verdete-800";

const BOTAO_PEQUENO =
  "rounded-md border border-pergaminho-300 bg-white px-2.5 py-1.5 text-xs font-medium text-verdete-800 transition-[transform,border-color,background-color] duration-150 ease-[var(--ease-mola)] hover:-translate-y-px hover:border-pergaminho-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdete-500 active:translate-y-0 active:bg-pergaminho-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0";

const DECISOES: Array<{ valor: DecisaoTopico | ""; rotulo: string }> = [
  { valor: "", rotulo: "— Sem votação" },
  { valor: "aprovado_unanimidade", rotulo: "Aprovado por unanimidade" },
  { valor: "reprovado", rotulo: "Reprovado" },
];

function permilagem(v: number): string {
  return v.toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
}

export default function EditorActa({
  acta,
  fracoes,
}: {
  acta: ActaEditor;
  fracoes: FracaoEditor[];
}) {
  const [numero, setNumero] = useState(String(acta.numero));
  const [data, setData] = useState(acta.data);
  const [horaInicio, setHoraInicio] = useState(acta.horaInicio);
  const [horaFim, setHoraFim] = useState(acta.horaFim);
  const [local, setLocal] = useState(acta.local);
  const [atualizarSeguros, setAtualizarSeguros] = useState(false);

  // Chaves estáveis entre servidor e cliente: os ids dos campos dependem delas.
  const proximaChave = useRef(acta.topicos.length + 1);
  const [topicos, setTopicos] = useState<TopicoEditor[]>(() =>
    acta.topicos.map((t, i) => ({ ...t, chave: i + 1 })),
  );

  const [presencas, setPresencas] = useState<Record<string, PresencaEditor>>(() =>
    Object.fromEntries(
      fracoes.map((f) => {
        const guardada = acta.presencas[f.id];
        return [
          f.id,
          {
            presente: guardada !== undefined,
            nome: guardada?.nome ?? f.condominoNome ?? "",
            forma: guardada?.forma ?? "Presencial",
          },
        ];
      }),
    ),
  );

  /** Põe o marcador numa linha sozinha, onde está o cursor (ou no fim). */
  const inserirTabelaSeguros = (chave: number, comentario: string) => {
    const campo = document.getElementById(`topico-comentario-${chave}`) as HTMLTextAreaElement | null;
    const posicao =
      campo && document.activeElement === campo ? campo.selectionStart : comentario.length;
    const antes = comentario.slice(0, posicao).replace(/\s+$/, "");
    const depois = comentario.slice(posicao).replace(/^\s+/, "");
    alterarTopico(chave, {
      comentario: [antes, MARCADOR_SEGUROS, depois].filter(Boolean).join("\n\n"),
    });
  };

  const alterarTopico = (chave: number, alteracao: Partial<TopicoEditor>) =>
    setTopicos((ts) => ts.map((t) => (t.chave === chave ? { ...t, ...alteracao } : t)));

  const moverTopico = (indice: number, direccao: -1 | 1) =>
    setTopicos((ts) => {
      const destino = indice + direccao;
      if (destino < 0 || destino >= ts.length) return ts;
      const copia = [...ts];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });

  const alterarPresenca = (fracaoId: string, alteracao: Partial<PresencaEditor>) =>
    setPresencas((ps) => ({ ...ps, [fracaoId]: { ...ps[fracaoId], ...alteracao } }));

  const totalPresente = fracoes.reduce(
    (s, f) => s + (presencas[f.id]?.presente ? (f.permilagem ?? 0) : 0),
    0,
  );
  const totalPredio = fracoes.reduce((s, f) => s + (f.permilagem ?? 0), 0);

  const conteudo: ConteudoActa = {
    numero: Number(numero),
    data,
    hora_inicio: horaInicio,
    hora_fim: horaFim,
    local,
    topicos: topicos.map(({ titulo, decisao, comentario }) => ({ titulo, decisao, comentario })),
    atualizar_seguros: atualizarSeguros,
    presencas: fracoes
      .filter((f) => presencas[f.id]?.presente)
      .map((f) => ({
        fracao_id: f.id,
        condomino_nome: presencas[f.id].nome,
        forma: presencas[f.id].forma,
      })),
  };

  const [resultado, despachar, aGuardar] = useActionState<Resultado | null, FormData>(
    async (anterior, dados) => {
      const r = await guardarActa(anterior, dados);
      // Pedido de uma vez: a gravação seguinte volta a manter a tabela fixa.
      if (r.ok) setAtualizarSeguros(false);
      return r;
    },
    null,
  );

  // Submete à mão em vez de usar <form action>: com uma acção no atributo, o
  // React 19 limpa o formulário no fim, e com campos controlados isso deixava
  // caixas desmarcadas e decisões em branco no ecrã, diferentes do que ficou
  // guardado.
  const submeter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => despachar(dados));
  };

  return (
    <form onSubmit={submeter} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={acta.id} />
      <input type="hidden" name="conteudo" value={JSON.stringify(conteudo)} />

      <Painel
        titulo="Cabeçalho"
        descricao="Aparece no primeiro parágrafo da ata: «Aos 18 dias do mês de janeiro de 2026, pelas 11.00 horas, {local}, teve lugar a assembleia…»."
      >
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="acta-numero" className={ETIQUETA}>Número</label>
            <input id="acta-numero" type="number" min={1} required value={numero}
              onChange={(e) => setNumero(e.target.value)} className={CAMPO} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="acta-data" className={ETIQUETA}>Data</label>
            <input id="acta-data" type="date" required value={data}
              onChange={(e) => setData(e.target.value)} className={CAMPO} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="acta-hora-inicio" className={ETIQUETA}>Hora de início</label>
            <input id="acta-hora-inicio" value={horaInicio} placeholder="11.00"
              onChange={(e) => setHoraInicio(e.target.value)} className={CAMPO} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="acta-hora-fim" className={ETIQUETA}>Hora de fim</label>
            <input id="acta-hora-fim" value={horaFim} placeholder="12,00"
              onChange={(e) => setHoraFim(e.target.value)} className={CAMPO} />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <label htmlFor="acta-local" className={ETIQUETA}>Local</label>
          <textarea id="acta-local" rows={3} value={local}
            placeholder="na sala de reuniões de condóminos, no 5.º piso do prédio…"
            onChange={(e) => setLocal(e.target.value)} className={`${CAMPO} leading-relaxed`} />
        </div>
      </Painel>

      <Painel
        titulo="Ordem de trabalhos"
        descricao="Um tópico por ponto. Nos comentários, uma linha em branco começa um parágrafo novo."
      >
        <ol className="flex flex-col gap-4">
          {topicos.map((t, i) => (
            <li key={t.chave} className="rounded-lg border border-pergaminho-200 bg-pergaminho-50 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-base font-semibold text-verdete-900">
                  Ponto {i + 1}
                </span>
                <div className="flex gap-1.5">
                  <button type="button" className={BOTAO_PEQUENO} disabled={i === 0}
                    onClick={() => moverTopico(i, -1)} aria-label={`Subir ponto ${i + 1}`}>↑</button>
                  <button type="button" className={BOTAO_PEQUENO} disabled={i === topicos.length - 1}
                    onClick={() => moverTopico(i, 1)} aria-label={`Descer ponto ${i + 1}`}>↓</button>
                  <button type="button" className={`${BOTAO_PEQUENO} hover:text-[#7d2c20]`}
                    onClick={() => setTopicos((ts) => ts.filter((x) => x.chave !== t.chave))}>
                    Remover
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_15rem]">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`topico-titulo-${t.chave}`} className={ETIQUETA}>Tópico</label>
                  <input id={`topico-titulo-${t.chave}`} value={t.titulo}
                    placeholder="Aumento das quotas para 2026"
                    onChange={(e) => alterarTopico(t.chave, { titulo: e.target.value })} className={CAMPO} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`topico-decisao-${t.chave}`} className={ETIQUETA}>Decisão</label>
                  <select id={`topico-decisao-${t.chave}`} value={t.decisao ?? ""}
                    onChange={(e) =>
                      alterarTopico(t.chave, { decisao: (e.target.value || null) as DecisaoTopico | null })
                    }
                    className={CAMPO}>
                    {DECISOES.map((d) => (
                      <option key={d.valor} value={d.valor}>{d.rotulo}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                <label htmlFor={`topico-comentario-${t.chave}`} className={ETIQUETA}>Comentários</label>
                <textarea id={`topico-comentario-${t.chave}`} rows={5} value={t.comentario}
                  onChange={(e) => alterarTopico(t.chave, { comentario: e.target.value })}
                  className={`${CAMPO} leading-relaxed`} />
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className={BOTAO_PEQUENO}
                    disabled={temTabelaSeguros(t.comentario)}
                    // Mantém o foco (e o cursor) na caixa de comentários.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => inserirTabelaSeguros(t.chave, t.comentario)}>
                    Inserir tabela de apólices
                  </button>
                  {temTabelaSeguros(t.comentario) && (
                    <p className="text-xs leading-relaxed text-pergaminho-600">
                      A tabela de apólices e recibos entra onde está{" "}
                      <code className="rounded bg-pergaminho-100 px-1">{MARCADOR_SEGUROS}</code>.{" "}
                      {acta.temTabelaSeguros
                        ? "A tabela já guardada nesta ata fica fixa."
                        : `Ao guardar, é copiada de Definições › Apólices e recibos (${data.slice(0, 4)}) e fica fixa na ata.`}
                    </p>
                  )}
                  {temTabelaSeguros(t.comentario) && acta.temTabelaSeguros && (
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-verdete-800">
                      <input type="checkbox" checked={atualizarSeguros}
                        onChange={(e) => setAtualizarSeguros(e.target.checked)}
                        className="size-4 accent-verdete-700" />
                      Atualizar com os dados atuais de {data.slice(0, 4)} ao guardar
                    </label>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
        <button type="button"
          onClick={() => {
            const chave = proximaChave.current++;
            setTopicos((ts) => [...ts, { chave, titulo: "", decisao: null, comentario: "" }]);
          }}
          className={`${BOTAO_PEQUENO} mt-4 px-3 py-2 text-sm`}>
          + Adicionar tópico
        </button>
      </Painel>

      <Painel
        titulo="Condóminos presentes"
        descricao="Marca as frações presentes ou representadas. A permilagem vem de Definições › Frações e fica guardada na ata."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-pergaminho-200 text-left">
                <th className="px-2 py-2.5 font-medium text-verdete-800">Presente</th>
                <th className="px-2 py-2.5 font-medium text-pergaminho-600">Fração</th>
                <th className="px-2 py-2.5 font-medium text-pergaminho-600">Condómino</th>
                <th className="px-2 py-2.5 text-right font-medium text-pergaminho-600">Permilagem</th>
                <th className="px-2 py-2.5 font-medium text-pergaminho-600">Forma</th>
              </tr>
            </thead>
            <tbody>
              {fracoes.map((f) => {
                const p = presencas[f.id];
                const formas = [
                  "Presencial",
                  ...fracoes.filter((o) => o.id !== f.id).map((o) => `Procuração fração ${o.letra}`),
                ];
                if (!formas.includes(p.forma)) formas.push(p.forma);
                return (
                  <tr key={f.id} className={`border-b border-pergaminho-100 last:border-0 ${p.presente ? "" : "text-pergaminho-400"}`}>
                    <td className="px-2 py-2">
                      <input type="checkbox" checked={p.presente}
                        aria-label={`Fração ${f.letra} presente`}
                        onChange={(e) => alterarPresenca(f.id, { presente: e.target.checked })}
                        className="size-5 accent-verdete-700" />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className="font-medium">{f.letra}</span>
                      <span className="text-pergaminho-500"> · {f.andar}</span>
                    </td>
                    <td className="px-2 py-2">
                      <input value={p.nome} disabled={!p.presente}
                        aria-label={`Condómino da fração ${f.letra}`}
                        onChange={(e) => alterarPresenca(f.id, { nome: e.target.value })}
                        className={`${CAMPO} disabled:bg-pergaminho-50 disabled:text-pergaminho-400`} />
                    </td>
                    <td className="tabular px-2 py-2 text-right">
                      {f.permilagem === null ? "—" : permilagem(f.permilagem)}
                    </td>
                    <td className="px-2 py-2">
                      <select value={p.forma} disabled={!p.presente}
                        aria-label={`Forma de presença da fração ${f.letra}`}
                        onChange={(e) => alterarPresenca(f.id, { forma: e.target.value })}
                        className={`${CAMPO} disabled:bg-pergaminho-50 disabled:text-pergaminho-400`}>
                        {formas.map((forma) => (
                          <option key={forma} value={forma}>{forma}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-pergaminho-200 font-medium text-verdete-950">
                <td colSpan={3} className="px-2 py-2.5 text-right">Total presente</td>
                <td className="tabular px-2 py-2.5 text-right">{permilagem(totalPresente)}</td>
                <td className="px-2 py-2.5 text-pergaminho-500">
                  de {permilagem(totalPredio)}
                  {totalPredio > 0 && ` (${((totalPresente / totalPredio) * 100).toFixed(1).replace(".", ",")}%)`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Painel>

      <div className="flex flex-wrap items-center gap-4">
        <Botao type="submit" disabled={aGuardar}>
          {aGuardar ? "A guardar…" : "Guardar ata"}
        </Botao>
        {resultado && (
          <p
            role={resultado.ok ? "status" : "alert"}
            className={`text-sm ${resultado.ok ? "text-[#2f5c3b]" : "text-[#a63a2b]"}`}
          >
            {resultado.mensagem}
          </p>
        )}
      </div>
    </form>
  );
}
