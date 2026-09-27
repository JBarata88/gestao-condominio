import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
} from "docx";
import { MESES } from "../formatos";
import { eMarcadorSeguros, MARCADOR_SEGUROS, temTabelaSeguros } from "./acta-marcador";
import type { DecisaoTopico } from "../tipos-bd";

export type TopicoDocumento = {
  titulo: string;
  decisao: DecisaoTopico | null;
  comentario: string;
};

export type PresencaDocumento = {
  /** Como está na fração, por exemplo "1º DTO". */
  andar: string;
  letra: string;
  nome: string;
  /** "Presencial" ou "Procuração fração F". */
  forma: string;
  permilagem: number | null;
};

/** Uma linha da tabela de apólices e recibos (ponto 2 da Acta nº 35). */
export type SeguroDocumento = {
  andar: string;
  letra: string;
  nome: string;
  apolice: boolean;
  recibo: boolean;
};

export type DadosActa = {
  numero: number;
  /** Data da assembleia em ISO. */
  data: string;
  /** Como se escreve na acta, por exemplo "11.00". */
  horaInicio: string;
  horaFim: string | null;
  /** O texto entre a hora e "teve lugar": "na sala de reuniões… Lote 1". */
  local: string;
  topicos: readonly TopicoDocumento[];
  presencas: readonly PresencaDocumento[];
  /** Tabela para os tópicos que têm o MARCADOR_SEGUROS no comentário. */
  seguros?: readonly SeguroDocumento[];
};

export { MARCADOR_SEGUROS, temTabelaSeguros };

export type ParteComentario = { tipo: "texto"; blocos: string[] } | { tipo: "seguros" };

/** Parte o comentário em texto e no sítio (ou sítios) da tabela de seguros. */
export function partesDoComentario(comentario: string): ParteComentario[] {
  const partes: ParteComentario[] = [];
  let actual: string[] = [];
  const fecharTexto = () => {
    const blocos = blocosDoComentario(actual.join("\n"));
    if (blocos.length > 0) partes.push({ tipo: "texto", blocos });
    actual = [];
  };
  for (const linha of comentario.replace(/\r\n/g, "\n").split("\n")) {
    if (eMarcadorSeguros(linha)) {
      fecharTexto();
      partes.push({ tipo: "seguros" });
    } else {
      actual.push(linha);
    }
  }
  fecharTexto();
  return partes;
}

// A Acta 35 original foi escrita em Verdana 10 sobre A4, com margens de
// cerca de 2,5 cm. Medidas em twips (1/20 pt).
const TIPO_LETRA = "Verdana";
const TAMANHO = 20; // meios-pontos
const TAMANHO_TABELA = 18;
const A4_LARGURA = 11906;
const A4_ALTURA = 16838;
const MARGEM = 1418;
const ESPACO = 200;

export const TEXTO_DECISAO: Record<DecisaoTopico, string> = {
  aprovado_unanimidade: "aprovado por unanimidade",
  reprovado: "reprovado",
};

/** 125 -> "125", 62.5 -> "62,5". Até três casas, sem zeros à direita. */
export function formatarPermilagem(valor: number | null): string {
  if (valor === null) return "—";
  return valor
    .toFixed(3)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
}

/** "1º DTO" -> ["1º", "DTO"], para as duas colunas de "ANDARES". */
export function partirAndar(andar: string): [string, string] {
  const limpo = andar.trim();
  const espaco = limpo.indexOf(" ");
  if (espaco === -1) return [limpo, ""];
  return [limpo.slice(0, espaco), limpo.slice(espaco + 1).trim()];
}

/** Tira a pontuação final do título, para lhe pôr ";" na lista e "." no corpo. */
export function tituloLimpo(titulo: string): string {
  return titulo.trim().replace(/[.;:,\s]+$/, "");
}

/** "Aos 18 dias do mês de Janeiro de 2026". */
export function frasePorExtensoDaData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const nomeMes = MESES[mes - 1];
  const inicio = dia === 1 ? "Ao primeiro dia" : `Aos ${dia} dias`;
  return `${inicio} do mês de ${nomeMes.toLowerCase()} de ${ano}`;
}

export function fraseDecisao(decisao: DecisaoTopico): string {
  return `Colocado à votação, foi ${TEXTO_DECISAO[decisao]}.`;
}

function run(
  texto: string,
  opcoes: { negrito?: boolean; quebra?: boolean; tamanho?: number } = {},
) {
  return new TextRun({
    text: texto,
    bold: opcoes.negrito,
    font: TIPO_LETRA,
    size: opcoes.tamanho ?? TAMANHO,
    break: opcoes.quebra ? 1 : undefined,
  });
}

function paragrafo(
  filhos: string | TextRun[],
  opcoes: {
    negrito?: boolean;
    alinhamento?: (typeof AlignmentType)[keyof typeof AlignmentType];
    depois?: number;
    antes?: number;
    recuo?: number;
    /** Não deixar este parágrafo sozinho no fundo da página (títulos). */
    comOSeguinte?: boolean;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: opcoes.alinhamento ?? AlignmentType.JUSTIFIED,
    keepNext: opcoes.comOSeguinte,
    spacing: { before: opcoes.antes ?? 0, after: opcoes.depois ?? ESPACO },
    indent: opcoes.recuo ? { left: opcoes.recuo, hanging: 360 } : undefined,
    children: typeof filhos === "string" ? [run(filhos, { negrito: opcoes.negrito })] : filhos,
  });
}

/**
 * O comentário de um tópico: uma linha em branco separa parágrafos, uma
 * mudança de linha simples fica como quebra dentro do mesmo parágrafo.
 */
export function blocosDoComentario(comentario: string): string[] {
  return comentario
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((bloco) => bloco.trim())
    .filter((bloco) => bloco.length > 0);
}

function paragrafosDoBloco(blocos: string[]): Paragraph[] {
  return blocos.map((bloco) => {
    const linhas = bloco.split("\n");
    // O Word estica as linhas que acabam numa quebra quando o parágrafo é
    // justificado: um bloco com várias linhas (uma lista de valores, por
    // exemplo) fica alinhado à esquerda.
    return paragrafo(
      linhas.map((linha, i) => run(linha, { quebra: i > 0 })),
      { alinhamento: linhas.length > 1 ? AlignmentType.LEFT : undefined },
    );
  });
}

function conteudoDoComentario(
  comentario: string,
  seguros: readonly SeguroDocumento[],
): (Paragraph | Table)[] {
  return partesDoComentario(comentario).flatMap((parte) =>
    parte.tipo === "texto"
      ? paragrafosDoBloco(parte.blocos)
      : [tabelaSeguros(seguros), new Paragraph({ spacing: { after: ESPACO }, children: [] })],
  );
}

const BORDA = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const BORDAS = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };

function cela(
  texto: string | TextRun[],
  largura: number,
  opcoes: {
    negrito?: boolean;
    alinhamento?: (typeof AlignmentType)[keyof typeof AlignmentType];
    colunas?: number;
    /** Junta esta cela com as de baixo (início) ou continua a de cima. */
    juntar?: "inicio" | "continuar";
    tamanho?: number;
  } = {},
): TableCell {
  return new TableCell({
    width: { size: largura, type: WidthType.DXA },
    columnSpan: opcoes.colunas,
    verticalMerge:
      opcoes.juntar === "inicio"
        ? VerticalMergeType.RESTART
        : opcoes.juntar === "continuar"
          ? VerticalMergeType.CONTINUE
          : undefined,
    borders: BORDAS,
    verticalAlign: VerticalAlign.CENTER,
    margins: { left: 60, right: 60 },
    children: [
      new Paragraph({
        alignment: opcoes.alinhamento ?? AlignmentType.LEFT,
        children:
          typeof texto === "string"
            ? [run(texto, { negrito: opcoes.negrito, tamanho: opcoes.tamanho ?? TAMANHO_TABELA })]
            : texto,
      }),
    ],
  });
}

function tabela(larguras: number[], linhas: TableRow[]): Table {
  return new Table({
    width: { size: larguras.reduce((s, l) => s + l, 0), type: WidthType.DXA },
    columnWidths: larguras,
    rows: linhas,
  });
}

/** ANDARES (2) | FRACÇÃO | CONDÓMINOS | PERMILAGEM | FORMA, mais o total. */
function tabelaPresencas(presencas: readonly PresencaDocumento[]): Table {
  const L = [500, 600, 880, 3800, 1150, 2140];
  const centro = AlignmentType.CENTER;
  const direita = AlignmentType.RIGHT;

  return tabela(L, [
    new TableRow({
      tableHeader: true,
      children: [
        cela("ANDARES", L[0] + L[1], { negrito: true, alinhamento: centro, colunas: 2 }),
        cela("FRAÇÃO", L[2], { negrito: true, alinhamento: centro }),
        cela("CONDÓMINOS", L[3], { negrito: true, alinhamento: centro }),
        cela("PERMILAGEM", L[4], { negrito: true, alinhamento: centro }),
        cela("FORMA", L[5], { negrito: true, alinhamento: centro }),
      ],
    }),
    ...presencas.map((p) => {
      const [piso, lado] = partirAndar(p.andar);
      return new TableRow({
        children: [
          cela(piso, L[0]),
          cela(lado, L[1], { alinhamento: centro }),
          cela(p.letra, L[2], { alinhamento: centro }),
          cela(p.nome, L[3]),
          cela(formatarPermilagem(p.permilagem), L[4], { alinhamento: direita }),
          cela(p.forma, L[5]),
        ],
      });
    }),
  ]);
}

/**
 * ANDARES (2) | FRACÇÃO | CONDÓMINOS | SEGURO | RECIBO, como no ponto 2 da
 * Acta nº 35: o número do andar aparece uma vez, grande, para as duas frações
 * do mesmo piso.
 */
function tabelaSeguros(seguros: readonly SeguroDocumento[]): Table {
  const L = [500, 600, 880, 4290, 1400, 1400];
  const centro = AlignmentType.CENTER;
  const pisos = seguros.map((s) => partirAndar(s.andar)[0]);

  return tabela(L, [
    new TableRow({
      tableHeader: true,
      children: [
        cela("ANDARES", L[0] + L[1], { negrito: true, alinhamento: centro, colunas: 2 }),
        cela("FRAÇÃO", L[2], { negrito: true, alinhamento: centro }),
        cela("CONDÓMINOS", L[3], { negrito: true, alinhamento: centro }),
        cela("SEGURO", L[4], { negrito: true, alinhamento: centro }),
        cela("RECIBO", L[5], { negrito: true, alinhamento: centro }),
      ],
    }),
    ...seguros.map((s, i) => {
      const [piso, lado] = partirAndar(s.andar);
      const continua = i > 0 && pisos[i - 1] === piso;
      const inicia = !continua && pisos[i + 1] === piso;
      return new TableRow({
        children: [
          cela(continua ? "" : piso, L[0], {
            alinhamento: centro,
            juntar: continua ? "continuar" : inicia ? "inicio" : undefined,
            tamanho: 28,
          }),
          cela(lado, L[1], { alinhamento: centro }),
          cela(s.letra, L[2], { alinhamento: centro }),
          cela(s.nome, L[3], { alinhamento: centro }),
          cela(s.apolice ? "SIM" : "", L[4], { alinhamento: centro }),
          cela(s.recibo ? "SIM" : "", L[5], { alinhamento: centro }),
        ],
      });
    }),
  ]);
}

/** ANDARES (2) | FRACÇÃO | CONDÓMINOS | ASSINATURA, para assinar à mão. */
function tabelaAssinaturas(presencas: readonly PresencaDocumento[]): Table {
  const L = [500, 600, 880, 5190, 1900];
  const centro = AlignmentType.CENTER;

  return tabela(L, [
    new TableRow({
      tableHeader: true,
      children: [
        cela("ANDARES", L[0] + L[1], { negrito: true, alinhamento: centro, colunas: 2 }),
        cela("FRAÇÃO", L[2], { negrito: true, alinhamento: centro }),
        cela("CONDÓMINOS", L[3], { negrito: true, alinhamento: centro }),
        cela("ASSINATURA", L[4], { negrito: true, alinhamento: centro }),
      ],
    }),
    ...presencas.map((p) => {
      const [piso, lado] = partirAndar(p.andar);
      const nome =
        p.forma.trim().toLowerCase() === "presencial"
          ? [run(p.nome, { tamanho: TAMANHO_TABELA })]
          : [
              run(`${p.nome} (`, { tamanho: TAMANHO_TABELA }),
              run("Por procuração", { negrito: true, tamanho: TAMANHO_TABELA }),
              run(")", { tamanho: TAMANHO_TABELA }),
            ];
      return new TableRow({
        height: { value: 560, rule: HeightRule.ATLEAST },
        children: [
          cela(piso, L[0]),
          cela(lado, L[1], { alinhamento: centro }),
          cela(p.letra, L[2], { alinhamento: centro }),
          cela(nome, L[3]),
          cela("", L[4]),
        ],
      });
    }),
  ]);
}

/** O documento Word da acta, com a estrutura da Acta nº 35. */
export async function gerarActa(dados: DadosActa): Promise<Buffer> {
  const titulos = dados.topicos.map((t) => tituloLimpo(t.titulo));
  const local = dados.local.trim().replace(/,$/, "");

  const conteudo: (Paragraph | Table)[] = [
    paragrafo(`Ata n.º ${dados.numero}`, {
      alinhamento: AlignmentType.CENTER,
      depois: ESPACO * 2,
    }),
    paragrafo(
      `${frasePorExtensoDaData(dados.data)}, pelas ${dados.horaInicio.trim()} horas` +
        `${local ? `, ${local}` : ""}, teve lugar a assembleia de condóminos para ` +
        "deliberar sobre os trabalhos que a seguir se indica:",
    ),
    ...titulos.map((titulo, i) =>
      paragrafo(`${i + 1}.\t${titulo};`, {
        negrito: true,
        alinhamento: AlignmentType.LEFT,
        recuo: 1080,
        depois: i === titulos.length - 1 ? ESPACO * 2 : 0,
      }),
    ),
    paragrafo("Estiveram presentes os condóminos das seguintes frações:", { depois: 0 }),
    tabelaPresencas(dados.presencas),
    paragrafo(
      "Verificada a presença de um número de condóminos representativos da " +
        "maioria do capital do prédio e suficiente para a tomada de deliberação, " +
        "iniciou-se a reunião.",
      { antes: ESPACO, depois: ESPACO * 2 },
    ),
  ];

  dados.topicos.forEach((topico, i) => {
    conteudo.push(
      paragrafo(`${i + 1}.\t${titulos[i]}.`, {
        negrito: true,
        alinhamento: AlignmentType.LEFT,
        recuo: 720,
        comOSeguinte: true,
      }),
      ...conteudoDoComentario(topico.comentario, dados.seguros ?? []),
    );
    if (topico.decisao) conteudo.push(paragrafo(fraseDecisao(topico.decisao)));
    conteudo.push(new Paragraph({ spacing: { after: 0 }, children: [] }));
  });

  conteudo.push(
    paragrafo(
      "Nada mais havendo a tratar foram os trabalhos encerrados" +
        (dados.horaFim?.trim() ? ` por volta das ${dados.horaFim.trim()} horas` : "") +
        ", lavrando-se a presente ata que vai ser assinada pelos condóminos " +
        "presentes e entregue cópia aos condóminos ausentes.",
    ),
    new Paragraph({ children: [new PageBreak()] }),
    tabelaAssinaturas(dados.presencas),
  );

  return documentoA4(`Ata n.º ${dados.numero}`, conteudo);
}

/** A4 em Verdana, com as margens da acta e "Página X de Y" no rodapé. */
function documentoA4(titulo: string, conteudo: (Paragraph | Table)[]): Promise<Buffer> {
  const documento = new Document({
    creator: "Gestão de condomínio",
    title: titulo,
    styles: {
      default: { document: { run: { font: TIPO_LETRA, size: TAMANHO } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_LARGURA, height: A4_ALTURA },
            margin: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    font: TIPO_LETRA,
                    size: TAMANHO,
                    children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES],
                  }),
                ],
              }),
            ],
          }),
        },
        children: conteudo,
      },
    ],
  });
  return Packer.toBuffer(documento);
}

export type FracaoFolha = {
  andar: string;
  letra: string;
  nome: string;
  permilagem: number | null;
};

/** "2026-01-18" -> "18 de Janeiro de 2026". */
export function dataPorExtensoMinusculas(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  return `${dia} de ${MESES[mes - 1].toLowerCase()} de ${ano}`;
}

/**
 * Folha de presenças para assinar à entrada da assembleia: todas as frações,
 * com a permilagem de cada uma e espaço para a assinatura.
 */
export async function gerarFolhaPresencas({
  data,
  fracoes,
}: {
  /** Data da assembleia em ISO. */
  data: string;
  fracoes: readonly FracaoFolha[];
}): Promise<Buffer> {
  const L = [500, 600, 880, 4040, 1150, 1900];
  const centro = AlignmentType.CENTER;
  const direita = AlignmentType.RIGHT;

  const tabelaFolha = tabela(L, [
    new TableRow({
      tableHeader: true,
      children: [
        cela("ANDARES", L[0] + L[1], { negrito: true, alinhamento: centro, colunas: 2 }),
        cela("FRAÇÃO", L[2], { negrito: true, alinhamento: centro }),
        cela("CONDÓMINOS", L[3], { negrito: true, alinhamento: centro }),
        cela("PERMILAGEM", L[4], { negrito: true, alinhamento: centro }),
        cela("ASSINATURA", L[5], { negrito: true, alinhamento: centro }),
      ],
    }),
    ...fracoes.map((f) => {
      const [piso, lado] = partirAndar(f.andar);
      return new TableRow({
        height: { value: 700, rule: HeightRule.ATLEAST },
        children: [
          cela(piso, L[0]),
          cela(lado, L[1], { alinhamento: centro }),
          cela(f.letra, L[2], { alinhamento: centro }),
          cela(f.nome, L[3]),
          cela(formatarPermilagem(f.permilagem), L[4], { alinhamento: direita }),
          cela("", L[5]),
        ],
      });
    }),
  ]);

  return documentoA4("Folha de presenças", [
    paragrafo("Folha de presenças", { negrito: true, alinhamento: centro, depois: ESPACO }),
    paragrafo(`Assembleia de condóminos de ${dataPorExtensoMinusculas(data)}`, {
      alinhamento: centro,
      depois: ESPACO * 2,
    }),
    tabelaFolha,
  ]);
}
