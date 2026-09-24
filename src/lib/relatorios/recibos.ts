import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  LineRuleType,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { valorPorExtensoMaiusculas } from "../extenso";
import { dataPorExtenso, euros, mesPorExtenso } from "../formatos";
import type { CabecalhoCondominio } from "./moaf";

export type DadosCondomino = {
  nome: string;
  letra: string;
  andar: string;
  /** Determina "do condómino" ou "da condómina", como nos originais. */
  tratamento: "masculino" | "feminino";
};

export type ReciboQuota = {
  tipo: "quota";
  condomino: DadosCondomino;
  valor: number;
  /** Meses a que a quota respeita, de 1 a 12. */
  meses: number[];
  ano: number;
  /** Data de emissão em ISO. */
  data: string;
};

export type ReciboPresenca = {
  tipo: "presenca";
  condomino: DadosCondomino;
  valor: number;
  /** Data da assembleia em ISO. */
  dataAssembleia: string;
  data: string;
};

export type ReciboPagamento = {
  tipo: "pagamento";
  destinatario: string;
  valor: number;
  servico: string;
  /** Período a que o serviço respeita, por exemplo "JANEIRO DE 2026". */
  periodo: string;
  data: string;
};

export type PedidoRecibo = ReciboQuota | ReciboPresenca | ReciboPagamento;

const TIPO_LETRA = "Calibri";

// Folha A4 em twips (1/20 pt), com margens iguais em todos os lados. Cada
// recibo ocupa exactamente metade da área útil, para caberem sempre dois por
// página com o mesmo tamanho, como nos originais impressos.
const A4_LARGURA = 11906;
const A4_ALTURA = 16838;
const MARGEM = 720;
const ALTURA_UTIL = A4_ALTURA - MARGEM * 2;
// Reserva um pouco de espaço para o parágrafo de quebra de página entre
// pares de recibos: sem esta folga, a tabela ocuparia 100% da página e o
// parágrafo da quebra ficava sem onde caber, criando uma página em branco.
const RESERVA_QUEBRA = 120;
const ALTURA_METADE = Math.floor((ALTURA_UTIL - RESERVA_QUEBRA) / 2);

function p(
  texto: string | TextRun[],
  opcoes: {
    negrito?: boolean;
    tamanho?: number;
    alinhamento?: (typeof AlignmentType)[keyof typeof AlignmentType];
    espacoDepois?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: opcoes.alinhamento,
    spacing: { after: opcoes.espacoDepois ?? 0 },
    children:
      typeof texto === "string"
        ? [
            new TextRun({
              text: texto,
              bold: opcoes.negrito,
              size: (opcoes.tamanho ?? 11) * 2, // docx conta em meios-pontos
              font: TIPO_LETRA,
            }),
          ]
        : texto,
  });
}

/** Nome a imprimir no topo dos recibos. */
function nomeParaRecibo(c: CabecalhoCondominio): string {
  return c.nomeRecibos ?? c.nome;
}

/** Cabeçalho comum aos três modelos. */
function cabecalho(c: CabecalhoCondominio, primeiraLinha: string): Paragraph[] {
  return [
    p(primeiraLinha, { negrito: true }),
    p(c.morada),
    p(`${c.codigoPostal} ${c.localidade}`),
    p(`CONTRIBUINTE: ${c.nif}`, { espacoDepois: 240 }),
  ];
}

/** "do condómino" ou "da condómina". */
function tratamentoDe(c: DadosCondomino): string {
  return c.tratamento === "feminino" ? "da condómina" : "do condómino";
}

function corpoQuota(
  r: ReciboQuota,
  c: CabecalhoCondominio,
  localidade: string,
  assinatura: string,
): Paragraph[] {
  const extenso = valorPorExtensoMaiusculas(r.valor);
  const meses = r.meses.map((m) => mesPorExtenso(m));
  // O original alterna entre "a quota de" e "as quotas de" conforme o número
  // de meses cobertos pelo recibo.
  const listaMeses =
    meses.length === 1
      ? meses[0]
      : `${meses.slice(0, -1).join(", ")} E ${meses[meses.length - 1]}`;
  const rotulo = meses.length === 1 ? "Valor da quota de" : "Valor das quotas de";

  return [
    ...cabecalho(c, nomeParaRecibo(c)),
    p("RECIBO", { negrito: true, tamanho: 14, espacoDepois: 240 }),
    p(
      `Recebemos ${tratamentoDe(r.condomino)} ${r.condomino.nome} fracção ${r.condomino.letra} andar ${r.condomino.andar} a quantia de ${extenso}.`,
      { espacoDepois: 120 },
    ),
    p(`${rotulo} ${listaMeses} DE ${r.ano}.`, { espacoDepois: 360 }),
    p(localidade),
    p(dataPorExtenso(r.data), { espacoDepois: 240 }),
    p(`Euros: ${euros(r.valor)}`, { negrito: true, espacoDepois: 360 }),
    p(assinatura),
    p("________________"),
  ];
}

function corpoPresenca(
  r: ReciboPresenca,
  c: CabecalhoCondominio,
  localidade: string,
): Paragraph[] {
  const extenso = valorPorExtensoMaiusculas(r.valor);
  const d = new Date(`${r.dataAssembleia}T00:00:00Z`);
  const dataAssembleia = `${String(d.getUTCDate()).padStart(2, "0")}/${String(
    d.getUTCMonth() + 1,
  ).padStart(2, "0")}/${d.getUTCFullYear()}`;

  return [
    ...cabecalho(c, nomeParaRecibo(c)),
    p("RECIBO", { negrito: true, tamanho: 14, espacoDepois: 240 }),
    p(
      `Eu abaixo assinado, ${r.condomino.nome} fracção ${r.condomino.letra} andar ${r.condomino.andar} declaro que recebi a quantia de ${extenso}, relativo à presença na assembleia de condóminos realizada no dia ${dataAssembleia}.`,
      { espacoDepois: 360 },
    ),
    p(localidade),
    p(dataPorExtenso(r.data), { espacoDepois: 240 }),
    p(`Euros: ${euros(r.valor)}`, { negrito: true, espacoDepois: 360 }),
    p("O Condómino"),
    p("________________"),
  ];
}

function corpoPagamento(
  r: ReciboPagamento,
  c: CabecalhoCondominio,
): Paragraph[] {
  const extenso = valorPorExtensoMaiusculas(r.valor);
  const d = new Date(`${r.data}T00:00:00Z`);
  const dataCurta = `${String(d.getUTCDate()).padStart(2, "0")}/${String(
    d.getUTCMonth() + 1,
  ).padStart(2, "0")}/${d.getUTCFullYear()}`;

  return [
    ...cabecalho(c, nomeParaRecibo(c)),
    p("       DOCUMENTO DE CAIXA", {
      negrito: true,
      tamanho: 14,
      espacoDepois: 120,
    }),
    p(`      EUROS: ${euros(r.valor)}`, { negrito: true, espacoDepois: 360 }),
    p(
      `Pagamento a ${r.destinatario} a quantia de ${extenso} referente a ${r.servico} relativos a ${r.periodo}.`,
      { espacoDepois: 360 },
    ),
    p(`                            EM ${dataCurta}`, { espacoDepois: 480 }),
    p("    O EMPREGADO                        Pela ADMINISTRAÇÃO"),
    p("_______________________________________________________________"),
  ];
}

function corpoDoRecibo(
  pedido: PedidoRecibo,
  condominio: CabecalhoCondominio,
  localidade: string,
  assinatura: string,
): Paragraph[] {
  if (pedido.tipo === "quota") {
    return corpoQuota(pedido, condominio, localidade, assinatura);
  }
  if (pedido.tipo === "presenca") {
    return corpoPresenca(pedido, condominio, localidade);
  }
  return corpoPagamento(pedido, condominio);
}

/** Uma célula com altura fixa igual a metade da página, para o recibo caber sempre no mesmo tamanho. */
function celaDeRecibo(
  conteudo: Paragraph[],
  comLinhaDivisoria: boolean,
): TableCell {
  return new TableCell({
    width: { size: 100, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.TOP,
    borders: comLinhaDivisoria
      ? {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
        }
      : undefined,
    children: conteudo,
  });
}

/**
 * Gera um documento Word com um ou vários recibos.
 *
 * A folha é sempre A4 e cada par de recibos ocupa uma tabela de duas linhas
 * com a mesma altura fixa (metade da área útil da página), separadas por uma
 * linha divisória — assim os dois recibos de cada página têm sempre o mesmo
 * tamanho, independentemente do texto de cada um. A partir do terceiro
 * recibo começa uma página nova.
 */
export async function gerarRecibos({
  pedidos,
  condominio,
  localidade = "Póvoa de Santa Iria",
  assinatura = "A administração",
}: {
  pedidos: readonly PedidoRecibo[];
  condominio: CabecalhoCondominio;
  localidade?: string;
  assinatura?: string;
}): Promise<Buffer> {
  if (pedidos.length === 0) {
    throw new Error("Não há recibos para gerar.");
  }

  const conteudo: (Paragraph | Table)[] = [];

  for (let i = 0; i < pedidos.length; i += 2) {
    if (i > 0) {
      conteudo.push(
        new Paragraph({
          spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
          children: [new PageBreak()],
        }),
      );
    }

    const primeiro = pedidos[i];
    const segundo = pedidos[i + 1] as PedidoRecibo | undefined;

    const linhas = [
      new TableRow({
        height: { value: ALTURA_METADE, rule: HeightRule.EXACT },
        cantSplit: true,
        children: [
          celaDeRecibo(
            corpoDoRecibo(primeiro, condominio, localidade, assinatura),
            segundo !== undefined,
          ),
        ],
      }),
    ];

    if (segundo !== undefined) {
      linhas.push(
        new TableRow({
          height: { value: ALTURA_METADE, rule: HeightRule.EXACT },
          cantSplit: true,
          children: [
            celaDeRecibo(
              corpoDoRecibo(segundo, condominio, localidade, assinatura),
              false,
            ),
          ],
        }),
      );
    }

    conteudo.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: "auto" },
          bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
          left: { style: BorderStyle.NONE, size: 0, color: "auto" },
          right: { style: BorderStyle.NONE, size: 0, color: "auto" },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
        },
        rows: linhas,
      }),
    );
  }

  const documento = new Document({
    creator: "Gestão de Condomínio",
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_LARGURA, height: A4_ALTURA },
            margin: { top: MARGEM, right: MARGEM, bottom: MARGEM, left: MARGEM },
          },
        },
        children: conteudo,
      },
    ],
  });

  return Packer.toBuffer(documento);
}
