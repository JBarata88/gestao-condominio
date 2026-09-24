import ExcelJS from "exceljs";
import type { MapaOrcamento } from "../orcamento";
import type { CabecalhoCondominio } from "./moaf";
import { dataCurta } from "../formatos";

/**
 * Mapa de origem e aplicação de fundos comparado com o orçamento aprovado em
 * assembleia, em Excel.
 *
 * Reproduz a disposição de ASSETS/ORÇAMENTO/MOAFORÇAMENTO2025.xls: mesmo
 * cabeçalho, mesmas quatro colunas (Orçamentado, Realizado, Desvio valor,
 * Desvio %), calculadas linha a linha em vez de escritas à mão como na folha
 * original. As linhas crescem conforme as categorias activas, tal como em
 * gerarMoaf.
 */
export async function gerarMoafOrcamento({
  mapa,
  condominio,
  inicio,
  fim,
  ano,
}: {
  mapa: MapaOrcamento;
  condominio: CabecalhoCondominio;
  inicio: string;
  fim: string;
  ano: number;
}): Promise<Buffer> {
  const livro = new ExcelJS.Workbook();
  livro.creator = "Gestão de Condomínio";
  livro.created = new Date();

  const folha = livro.addWorksheet(`ORCAMENTO_${ano}`, {
    properties: { defaultRowHeight: 12.75 },
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      scale: 80,
      margins: {
        left: 0.5511811023622047,
        right: 0.35433070866141736,
        top: 0.5905511811023623,
        bottom: 0.7874015748031497,
        header: 0.11811023622047245,
        footer: 0.11811023622047245,
      },
      showRowColHeaders: false,
      showGridLines: false,
      horizontalCentered: true,
      verticalCentered: true,
    },
  });

  folha.columns = [
    {}, // A
    {}, // B
    {}, // C
    {}, // D
    { width: 12 }, // E — Orçamentado
    { width: 12 }, // F — Realizado
    { width: 12 }, // G — Desvio valor
    { width: 10 }, // H — Desvio %
  ];
  folha.getRow(6).height = 13.5;

  const MOEDA = "#,##0.00";
  const PERCENTAGEM = '0.00"%"';
  const TIPO_LETRA = "MS Sans Serif";
  const TAMANHO_LETRA = 10;

  const texto = (
    celula: string,
    valor: string,
    opcoes: {
      negrito?: boolean;
      italico?: boolean;
      bordaEsquerda?: boolean;
      centroContinuo?: boolean;
    } = {},
  ) => {
    const c = folha.getCell(celula);
    c.value = valor;
    c.font = {
      bold: opcoes.negrito ?? false,
      italic: opcoes.italico ?? false,
      size: TAMANHO_LETRA,
      name: TIPO_LETRA,
    };
    if (opcoes.bordaEsquerda) c.border = { left: { style: "medium" } };
    if (opcoes.centroContinuo) c.alignment = { horizontal: "centerContinuous" };
    return c;
  };

  const valorCelula = (celula: string, v: number, numFmt: string, negrito = false) => {
    const c = folha.getCell(celula);
    c.value = v;
    c.numFmt = numFmt;
    c.font = { bold: negrito, size: TAMANHO_LETRA, name: TIPO_LETRA };
    c.alignment = { horizontal: "right" };
    return c;
  };

  /** Escreve as quatro colunas (orçamentado/realizado/desvio/desvio%) de uma linha comparada. */
  const linhaValores = (
    n: number,
    l: { orcamentado: number; realizado: number; desvioValor: number; desvioPercentagem: number },
    negrito = false,
  ) => {
    valorCelula(`E${n}`, l.orcamentado, MOEDA, negrito);
    valorCelula(`F${n}`, l.realizado, MOEDA, negrito);
    valorCelula(`G${n}`, l.desvioValor, MOEDA, negrito);
    valorCelula(`H${n}`, l.desvioPercentagem, PERCENTAGEM, negrito);
  };

  // --- Cabeçalho -----------------------------------------------------------
  texto("A1", condominio.nome, { negrito: true, italico: true });
  texto("A2", condominio.morada, { negrito: true, italico: true });
  texto("A3", `${condominio.codigoPostal} ${condominio.localidade}`, {
    negrito: true,
    italico: true,
  });
  texto("A4", `CONTRIBUINTE:${condominio.nif}`, { negrito: true, italico: true });

  texto("C6", `MAPA DE ORIGEM E APLICAÇÃO DE FUNDOS VS.ORÇAMENTO ANO ${ano}`, {
    negrito: true,
  });

  texto("E9", "ORÇAMENTADO", { negrito: true });
  texto("F9", "REALIZADO", { negrito: true });
  texto("G9", "DESVIO VALOR", { negrito: true });
  texto("H9", "DESVIO", { negrito: true });

  texto("A10", `EXERCICIO DE : ${dataCurta(inicio)} a ${dataCurta(fim)}`, { negrito: true });
  texto("E10", "EUROS", { negrito: true });
  texto("F10", "EUROS", { negrito: true });
  texto("G10", "EUROS", { negrito: true });
  texto("H10", "%", { negrito: true });

  // --- Origem de fundos ------------------------------------------------------
  texto("A13", "ORIGEM DE FUNDOS", { negrito: true, bordaEsquerda: true });
  texto("A15", "   A- Administração anterior", { bordaEsquerda: true });

  let linha = 16;
  const RUBRICAS = ["Caixa", "Depósitos à ordem", "Depósitos a prazo/Certificados de aforro", "Conta poupança - condominio"];
  for (let i = 0; i < mapa.origem.anterior.length; i++) {
    texto(`B${linha}`, RUBRICAS[i]);
    linhaValores(linha, mapa.origem.anterior[i]);
    linha++;
  }

  const subtotalAnterior = linha + 1;
  texto(`C${subtotalAnterior}`, "SUB-TOTAL", { negrito: true });
  linhaValores(subtotalAnterior, mapa.origem.anteriorSubtotal, true);

  const tituloActual = subtotalAnterior + 3;
  texto(`A${tituloActual}`, "  B- Administração actual", { bordaEsquerda: true });

  linha = tituloActual + 1;
  for (const item of mapa.origem.atual) {
    const rotulo = item.rotulo === "Quotizações" ? `Quotizações ${ano}` : item.rotulo;
    texto(`B${linha}`, rotulo);
    linhaValores(linha, item);
    linha++;
  }

  const subtotalActual = linha + 1;
  texto(`C${subtotalActual}`, "SUB-TOTAL", { negrito: true });
  linhaValores(subtotalActual, mapa.origem.atualSubtotal, true);

  const totalOrigem = subtotalActual + 2;
  texto(`B${totalOrigem}`, "TOTAL", { negrito: true });
  linhaValores(totalOrigem, mapa.origem.total, true);

  // --- Aplicação de fundos -----------------------------------------------
  const tituloAplicacao = totalOrigem + 3;
  texto(`A${tituloAplicacao}`, "APLICAÇÃO DE FUNDOS", { negrito: true, bordaEsquerda: true });
  texto(`A${tituloAplicacao + 2}`, "   A-Despesas", { bordaEsquerda: true });

  linha = tituloAplicacao + 3;
  for (const item of mapa.aplicacao.despesas) {
    texto(`B${linha}`, item.rotulo);
    linhaValores(linha, item);
    linha++;
  }

  const subtotalDespesas = linha + 1;
  texto(`C${subtotalDespesas}`, "SUB-TOTAL", { negrito: true });
  linhaValores(subtotalDespesas, mapa.aplicacao.despesasSubtotal, true);

  const tituloDisponibilidades = subtotalDespesas + 3;
  texto(`A${tituloDisponibilidades}`, "    B-Disponibilidades", { bordaEsquerda: true });

  linha = tituloDisponibilidades + 1;
  for (let i = 0; i < mapa.aplicacao.disponibilidades.length; i++) {
    texto(`B${linha}`, RUBRICAS[i]);
    linhaValores(linha, mapa.aplicacao.disponibilidades[i]);
    linha++;
  }

  const subtotalDisponibilidades = linha + 1;
  texto(`C${subtotalDisponibilidades}`, "SUB-TOTAL", { negrito: true });
  linhaValores(subtotalDisponibilidades, mapa.aplicacao.disponibilidadesSubtotal, true);

  const totalAplicacao = subtotalDisponibilidades + 2;
  texto(`B${totalAplicacao}`, "TOTAL", { negrito: true });
  linhaValores(totalAplicacao, mapa.aplicacao.total, true);

  const variacao = totalAplicacao + 2;
  texto(`A${variacao}`, "     C-Variação das disponibilidades ", { bordaEsquerda: true });
  linhaValores(variacao, mapa.variacao, true);

  const controlo = variacao + 2;
  texto(`C${controlo}`, "controlo", { negrito: true });
  const celulaOrcamentado = valorCelula(`E${controlo}`, mapa.controloOrcamentado, MOEDA, true);
  const celulaRealizado = valorCelula(`F${controlo}`, mapa.controloRealizado, MOEDA, true);
  // Se algum dos dois não fechar, tem de saltar à vista.
  for (const [celula, valorControlo] of [
    [celulaOrcamentado, mapa.controloOrcamentado],
    [celulaRealizado, mapa.controloRealizado],
  ] as const) {
    if (valorControlo !== 0) {
      celula.font = { bold: true, size: TAMANHO_LETRA, name: TIPO_LETRA, color: { argb: "FFA63A2B" } };
    }
  }

  folha.pageSetup.printArea = `A1:H${controlo}`;

  const buffer = await livro.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
