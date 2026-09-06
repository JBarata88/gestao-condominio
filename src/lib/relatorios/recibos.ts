import {
  AlignmentType,
  Document,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
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

/**
 * Gera um documento Word com um ou vários recibos.
 *
 * Como nos ficheiros originais, cabem dois recibos por página, separados por
 * uma linha. A partir do terceiro começa uma página nova.
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

  const paragrafos: Paragraph[] = [];

  pedidos.forEach((pedido, indice) => {
    if (indice > 0) {
      const parDeCima = indice % 2 === 1;
      if (parDeCima) {
        // Segundo recibo da mesma página: separador, como nos originais.
        paragrafos.push(
          new Paragraph({
            spacing: { before: 360, after: 360 },
            children: [
              new TextRun({
                text: "_".repeat(98),
                size: 22,
                font: TIPO_LETRA,
              }),
            ],
          }),
        );
      } else {
        paragrafos.push(
          new Paragraph({ children: [new PageBreak()] }),
        );
      }
    }

    if (pedido.tipo === "quota") {
      paragrafos.push(
        ...corpoQuota(pedido, condominio, localidade, assinatura),
      );
    } else if (pedido.tipo === "presenca") {
      paragrafos.push(...corpoPresenca(pedido, condominio, localidade));
    } else {
      paragrafos.push(...corpoPagamento(pedido, condominio));
    }
  });

  const documento = new Document({
    creator: "Gestão de Condomínio",
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        children: paragrafos,
      },
    ],
  });

  return Packer.toBuffer(documento);
}
