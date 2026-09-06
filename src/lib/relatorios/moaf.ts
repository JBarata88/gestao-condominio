import ExcelJS from "exceljs";
import type { Mapa } from "../contas";
import { dataCurta } from "../formatos";

export type CabecalhoCondominio = {
  /** Nome usado nos relatórios, por exemplo "CONDOMÍNIO DO LOTE 1". */
  nome: string;
  /**
   * Nome usado nos recibos. Os ficheiros originais usam duas designações
   * diferentes para o mesmo condomínio: "CONDOMÍNIO DO LOTE 1" nos mapas e
   * "CONDOMÍNIO DO Nº 4" nos recibos. Quando ausente, usa-se o nome acima.
   */
  nomeRecibos?: string;
  morada: string;
  codigoPostal: string;
  localidade: string;
  nif: string;
};

/**
 * Mapa de origem e aplicação de fundos, em Excel.
 *
 * Reproduz a disposição de ASSETS/MOAF202601.xlsx: mesmas colunas, mesmos
 * rótulos, mesma ordem. Os blocos de receitas e de despesas crescem conforme
 * as categorias activas, e as linhas de subtotal acompanham.
 */
export async function gerarMoaf({
  mapa,
  condominio,
  inicio,
  fim,
  ano,
}: {
  mapa: Mapa;
  condominio: CabecalhoCondominio;
  inicio: string;
  fim: string;
  ano: number;
}): Promise<Buffer> {
  const livro = new ExcelJS.Workbook();
  livro.creator = "Gestão de Condomínio";
  livro.created = new Date();

  const folha = livro.addWorksheet(`MOAF_${ano}`, {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true },
  });

  folha.columns = [
    { width: 4 }, // A
    { width: 30 }, // B
    { width: 12 }, // C
    { width: 12 }, // D
    { width: 4 }, // E
    { width: 4 }, // F
    { width: 14 }, // G
  ];

  const MOEDA = "#,##0.00";

  const texto = (celula: string, valor: string, opcoes: {
    negrito?: boolean;
    tamanho?: number;
  } = {}) => {
    const c = folha.getCell(celula);
    c.value = valor;
    c.font = { bold: opcoes.negrito ?? false, size: opcoes.tamanho ?? 11 };
    return c;
  };

  const valor = (celula: string, v: number, negrito = false) => {
    const c = folha.getCell(celula);
    c.value = v;
    c.numFmt = MOEDA;
    c.font = { bold: negrito };
    c.alignment = { horizontal: "right" };
    return c;
  };

  // --- Cabeçalho -----------------------------------------------------------
  texto("A1", condominio.nome, { negrito: true });
  texto("A2", condominio.morada);
  texto("A3", `${condominio.codigoPostal} ${condominio.localidade}`);
  texto("A4", `CONTRIBUINTE:${condominio.nif}`);

  texto("C6", "MAPA DE ORIGEM E APLICAÇÃO DE FUNDOS", {
    negrito: true,
    tamanho: 12,
  });

  texto("A8", "  EXERCICIO DE :");
  texto("C8", `${dataCurta(inicio)} a ${dataCurta(fim)}`);
  texto("G8", "EUROS", { negrito: true });

  // --- Origem de fundos ----------------------------------------------------
  texto("A11", "ORIGEM DE FUNDOS", { negrito: true });
  texto("A13", "   A- Administração anterior");

  texto("B14", "Caixa");
  valor("G14", mapa.origem.anterior.caixa);
  texto("B15", "Depósitos à ordem");
  valor("G15", mapa.origem.anterior.depositoOrdem);
  texto("B16", "Depósitos a prazo");
  valor("G16", mapa.origem.anterior.depositoPrazo);
  texto("B17", "Conta poupança - condominio");
  valor("G17", mapa.origem.anterior.contaPoupanca);

  texto("D19", "SUB-TOTAL", { negrito: true });
  valor("G19", mapa.origem.anterior.total, true);

  texto("A22", "  B- Administração actual");

  // As receitas começam na linha 23, como no ficheiro original.
  let linha = 23;
  for (const item of mapa.origem.atual.linhas) {
    // A folha original escrevia "Quotizações 2026", com o ano. A categoria na
    // base de dados chama-se só "Quotizações"; o ano é acrescentado aqui.
    const rotulo =
      item.rotulo === "Quotizações" ? `Quotizações ${ano}` : item.rotulo;
    texto(`B${linha}`, rotulo);
    valor(`G${linha}`, item.valor);
    linha++;
  }

  const subtotalReceitas = linha + 1;
  texto(`D${subtotalReceitas}`, "SUB-TOTAL", { negrito: true });
  valor(`G${subtotalReceitas}`, mapa.origem.atual.subtotal, true);

  const totalOrigem = subtotalReceitas + 2;
  texto(`B${totalOrigem}`, "TOTAL", { negrito: true });
  valor(`G${totalOrigem}`, mapa.origem.total, true);

  // --- Aplicação de fundos -------------------------------------------------
  const tituloAplicacao = totalOrigem + 3;
  texto(`A${tituloAplicacao}`, "APLICAÇÃO DE FUNDOS", { negrito: true });
  texto(`A${tituloAplicacao + 2}`, "   A-Despesas");

  linha = tituloAplicacao + 3;
  for (const item of mapa.aplicacao.despesas.linhas) {
    texto(`B${linha}`, item.rotulo);
    valor(`G${linha}`, item.valor);
    linha++;
  }

  const subtotalDespesas = linha + 1;
  texto(`D${subtotalDespesas}`, "SUB-TOTAL", { negrito: true });
  valor(`G${subtotalDespesas}`, mapa.aplicacao.despesas.subtotal, true);

  const tituloDisponibilidades = subtotalDespesas + 3;
  texto(`A${tituloDisponibilidades}`, "    B-Disponibilidades");

  const d = mapa.aplicacao.disponibilidades;
  texto(`B${tituloDisponibilidades + 1}`, "Caixa");
  valor(`G${tituloDisponibilidades + 1}`, d.caixa);
  texto(`B${tituloDisponibilidades + 2}`, "Depósitos à ordem");
  valor(`G${tituloDisponibilidades + 2}`, d.depositoOrdem);
  texto(`B${tituloDisponibilidades + 3}`, "Depósitos a prazo");
  valor(`G${tituloDisponibilidades + 3}`, d.depositoPrazo);
  texto(`B${tituloDisponibilidades + 4}`, "Conta poupança - condominio");
  valor(`G${tituloDisponibilidades + 4}`, d.contaPoupanca);

  const subtotalDisponibilidades = tituloDisponibilidades + 6;
  texto(`D${subtotalDisponibilidades}`, "SUB-TOTAL", { negrito: true });
  valor(`G${subtotalDisponibilidades}`, d.total, true);

  const totalAplicacao = subtotalDisponibilidades + 2;
  texto(`B${totalAplicacao}`, "TOTAL", { negrito: true });
  valor(`G${totalAplicacao}`, mapa.aplicacao.total, true);

  const variacao = totalAplicacao + 2;
  texto(`A${variacao}`, "     C-Variação das disponibilidades ");
  valor(`G${variacao}`, mapa.variacao);

  const controlo = variacao + 2;
  texto(`D${controlo}`, "controlo");
  const celulaControlo = valor(`G${controlo}`, mapa.controlo);
  // Se alguma vez deixar de fechar, tem de saltar à vista em vez de passar
  // despercebido como acontecia na folha.
  if (mapa.controlo !== 0) {
    celulaControlo.font = { bold: true, color: { argb: "FFA63A2B" } };
  }

  const buffer = await livro.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
