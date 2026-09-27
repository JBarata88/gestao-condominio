import {
  AlignmentType,
  Document,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";
import { MESES } from "../formatos";
import type { TratamentoPessoa } from "../tipos-bd";

export type DestinatarioConvocatoria = {
  nome: string;
  letra: string;
  tratamento: TratamentoPessoa;
};

export type DadosConvocatoria = {
  /** Primeira convocação, em ISO. */
  data: string;
  /** Como se escreve na convocatória, por exemplo "11" ou "11:00". */
  hora: string;
  /** Segunda convocação (sem quórum na primeira), em ISO. */
  dataSegunda: string;
  horaSegunda: string;
  /** "na sala de reuniões dos condóminos, no 5.º piso". */
  sala: string;
  /** Morada do prédio, como está em Definições › Condomínio. */
  morada: string;
  codigoPostal: string;
  localidade: string;
  topicos: readonly string[];
  destinatarios: readonly DestinatarioConvocatoria[];
};

// A convocatória original é Times New Roman 12 em A4, com margens de 2,5 cm
// em cima e 3,2 cm dos lados. Medidas em twips (1/20 pt).
const TIPO_LETRA = "Times New Roman";
const TAMANHO = 24; // meios-pontos
const A4_LARGURA = 11906;
const A4_ALTURA = 16838;

/** Palavras que ficam em minúscula a meio de um nome próprio. */
const PARTICULAS = new Set(["da", "das", "de", "do", "dos", "e"]);

/**
 * "PRACETA POETAS DA POVOA, Nº 4" -> "Praceta Poetas da Povoa, Nº 4", para a
 * morada (guardada em maiúsculas) caber a meio de uma frase.
 */
export function capitalizarMorada(texto: string): string {
  return texto
    .toLowerCase()
    .split(/(\s+)/)
    .map((palavra, i) => {
      if (/^\s+$/.test(palavra) || palavra === "") return palavra;
      if (i > 0 && PARTICULAS.has(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join("");
}

/** "2025-01-12" -> "12 do mês de janeiro de 2025", como no original. */
export function dataDaConvocatoria(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return `${dia} do mês de ${MESES[mes - 1].toLowerCase()} de ${ano}`;
}

/** Tira a pontuação final do tópico, para lhe pôr ";" na lista. */
function semPontuacaoFinal(titulo: string): string {
  return titulo.trim().replace(/[.;:,\s]+$/, "");
}

function run(texto: string, opcoes: { negrito?: boolean; tamanho?: number; quebra?: boolean } = {}) {
  return new TextRun({
    text: texto,
    bold: opcoes.negrito,
    font: TIPO_LETRA,
    size: opcoes.tamanho ?? TAMANHO,
    break: opcoes.quebra ? 1 : undefined,
  });
}

function paragrafo(
  filhos: TextRun[],
  opcoes: {
    alinhamento?: (typeof AlignmentType)[keyof typeof AlignmentType];
    esquerda?: number;
    primeiraLinha?: number;
    pendente?: number;
    depois?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: opcoes.alinhamento ?? AlignmentType.LEFT,
    indent: {
      left: opcoes.esquerda,
      firstLine: opcoes.primeiraLinha,
      hanging: opcoes.pendente,
    },
    spacing: { after: opcoes.depois ?? 0 },
    children: filhos,
  });
}

const vazio = () => new Paragraph({ children: [] });

function convocatoria(d: DadosConvocatoria, pessoa: DestinatarioConvocatoria): Paragraph[] {
  const feminino = pessoa.tratamento === "feminino";
  const convocado = feminino ? "convocada" : "convocado";
  const morada = capitalizarMorada(d.morada);
  const sala = d.sala.trim().replace(/[.,;]+$/, "");
  const justificado = AlignmentType.JUSTIFIED;

  return [
    vazio(),
    paragrafo([run("CONVOCATÓRIA", { tamanho: 28 })], { alinhamento: AlignmentType.CENTER, depois: 360 }),
    paragrafo([run("Da administração:")], { esquerda: 720 }),
    vazio(),
    vazio(),
    paragrafo(
      [
        run(`${feminino ? "Exma. Senhora" : "Exmo. Senhor"}: ${pessoa.nome}`),
        run(`Fração: ${pessoa.letra}`, { quebra: true }),
      ],
      { esquerda: 2520 },
    ),
    vazio(),
    vazio(),
    paragrafo(
      [
        run(
          `Por este meio fica V.Ex.ª ${convocado} para a Assembleia de condóminos do prédio sito na ${morada}, a realizar no referido edifício `,
        ),
        run(sala, { negrito: true }),
        run(", no dia "),
        run(`${dataDaConvocatoria(d.data)}, pelas ${d.hora.trim()} horas`, { negrito: true }),
        run(", com a seguinte ordem de trabalhos:"),
      ],
      { alinhamento: justificado, primeiraLinha: 1440 },
    ),
    vazio(),
    vazio(),
    ...d.topicos.map((t, i) =>
      paragrafo([run(`${i + 1}.\t${semPontuacaoFinal(t)};`, { negrito: true })], {
        alinhamento: justificado,
        esquerda: 3240,
        pendente: 360,
      }),
    ),
    vazio(),
    vazio(),
    vazio(),
    paragrafo(
      [run("Aguarda-se a sua comparência."), run("Com os melhores cumprimentos,", { quebra: true })],
      { esquerda: 1800 },
    ),
    vazio(),
    vazio(),
    paragrafo(
      [
        run("A Administração"),
        run(morada, { quebra: true }),
        run(`${d.codigoPostal} ${capitalizarMorada(d.localidade)}`, { quebra: true }),
      ],
      { esquerda: 4320 },
    ),
    vazio(),
    vazio(),
    paragrafo(
      [
        run(
          "P.S. Se na reunião da Assembleia de condóminos que acima ficou indicada não estiverem " +
            "presentes ou representados condóminos titulares da maioria do capital investido no " +
            "prédio, ou não for possível formar a maioria do n.º 12 do art.º 1432.º do Código Civil, " +
            `fica V.Ex.ª também desde já ${convocado} para nova reunião da Assembleia de condóminos ` +
            "no mesmo prédio, no mesmo local, e no dia ",
        ),
        run(`${dataDaConvocatoria(d.dataSegunda)}, pelas ${d.horaSegunda.trim()} horas`, {
          negrito: true,
        }),
        run(
          ", com a mesma ordem de trabalhos, a qual poderá deliberar por maioria dos votos dos " +
            "proprietários presentes, desde que representem pelo menos um terço do capital " +
            "investido no edifício, nos termos do art.º 1432.º, n.º 3, do Código Civil.",
        ),
      ],
      { alinhamento: justificado, primeiraLinha: 720 },
    ),
  ];
}

/** Uma convocatória por condómino, cada uma na sua página. */
export async function gerarConvocatorias(d: DadosConvocatoria): Promise<Buffer> {
  if (d.destinatarios.length === 0) throw new Error("Não há condóminos para convocar.");

  const conteudo = d.destinatarios.flatMap((pessoa, i) => [
    ...(i > 0 ? [new Paragraph({ children: [new PageBreak()] })] : []),
    ...convocatoria(d, pessoa),
  ]);

  const documento = new Document({
    creator: "Gestão de condomínio",
    title: "Convocatórias",
    styles: { default: { document: { run: { font: TIPO_LETRA, size: TAMANHO } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_LARGURA, height: A4_ALTURA },
            margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 },
          },
        },
        children: conteudo,
      },
    ],
  });
  return Packer.toBuffer(documento);
}
