/**
 * Leitura do ficheiro de extrato, seja CSV, XLSX ou PDF.
 *
 * Todos os caminhos terminam numa grelha de células, que o módulo "analisar"
 * transforma em linhas de extrato. Assim a detecção de colunas é a mesma
 * independentemente do formato de origem.
 */

import Papa from "papaparse";
import { linhasDeGrelha, type LinhaExtrato, type Mapeamento } from "./analisar";

export type Formato = "csv" | "xlsx" | "pdf";

export type ResultadoLeitura = {
  linhas: LinhaExtrato[];
  mapeamento: Mapeamento | null;
  formato: Formato;
  aviso?: string;
};

type Celula = string | number | Date | null;

export function formatoDe(nomeFicheiro: string): Formato | null {
  const ext = nomeFicheiro.toLowerCase().split(".").pop();
  if (ext === "csv" || ext === "txt") return "csv";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "pdf") return "pdf";
  return null;
}

/** Lê o ficheiro e devolve as linhas de movimento. */
export async function lerExtrato(
  ficheiro: ArrayBuffer,
  nomeFicheiro: string,
): Promise<ResultadoLeitura> {
  const formato = formatoDe(nomeFicheiro);
  if (!formato) {
    throw new Error(
      "Formato não suportado. Usa um ficheiro CSV, XLSX ou PDF do teu homebanking.",
    );
  }

  if (formato === "csv") return lerCsv(ficheiro);
  if (formato === "xlsx") return lerXlsx(ficheiro);
  return lerPdf(ficheiro);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
function lerCsv(dados: ArrayBuffer): ResultadoLeitura {
  // Os extratos portugueses costumam vir em Windows-1252. Tenta UTF-8 e, se
  // aparecer o caractere de substituição, volta a descodificar em latin-1.
  let texto = new TextDecoder("utf-8").decode(dados);
  if (texto.includes("�")) {
    texto = new TextDecoder("windows-1252").decode(dados);
  }

  const analisado = Papa.parse<string[]>(texto, {
    // O ponto e vírgula é o separador habitual em Portugal, mas deixa-se o
    // Papa detectar, que também cobre vírgula e tabulação.
    delimiter: "",
    skipEmptyLines: "greedy",
  });

  const grelha = analisado.data as Celula[][];
  const { linhas, mapeamento } = linhasDeGrelha(grelha);
  return { linhas, mapeamento, formato: "csv" };
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------
async function lerXlsx(dados: ArrayBuffer): Promise<ResultadoLeitura> {
  const ExcelJS = (await import("exceljs")).default;
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(dados);

  const folha = livro.worksheets[0];
  if (!folha) throw new Error("O ficheiro não tem nenhuma folha.");

  const grelha: Celula[][] = [];
  folha.eachRow({ includeEmpty: true }, (linha) => {
    const celulas: Celula[] = [];
    linha.eachCell({ includeEmpty: true }, (celula) => {
      const v = celula.value;
      if (v == null) celulas.push(null);
      else if (v instanceof Date) celulas.push(v);
      else if (typeof v === "number" || typeof v === "string") celulas.push(v);
      else if (typeof v === "object" && "result" in v) {
        const r = (v as { result?: unknown }).result;
        celulas.push(typeof r === "number" || typeof r === "string" ? r : null);
      } else if (typeof v === "object" && "text" in v) {
        celulas.push(String((v as { text: unknown }).text));
      } else {
        celulas.push(String(v));
      }
    });
    grelha.push(celulas);
  });

  const { linhas, mapeamento } = linhasDeGrelha(grelha);
  return { linhas, mapeamento, formato: "xlsx" };
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
/**
 * O PDF não tem colunas, tem texto corrido. Cada linha é reconhecida por um
 * padrão: data, descrição, valor e, opcionalmente, saldo.
 *
 * É o caminho menos fiável dos três, por isso o resultado vem com um aviso
 * para ser revisto linha a linha antes de gravar.
 */
async function lerPdf(dados: ArrayBuffer): Promise<ResultadoLeitura> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const documento = await getDocumentProxy(new Uint8Array(dados));
  const { text } = await extractText(documento, { mergePages: true });

  const conteudo = Array.isArray(text) ? text.join("\n") : text;

  // data  [data valor]  descrição  valor  [saldo]
  const padrao =
    /(\d{2}[-/.]\d{2}[-/.]\d{2,4})\s+(?:(\d{2}[-/.]\d{2}[-/.]\d{2,4})\s+)?(.+?)\s+(-?[\d.\s]*\d,\d{2})(?:\s+(-?[\d.\s]*\d,\d{2}))?\s*$/;

  const grelha: Celula[][] = [
    ["Data mov", "Data valor", "Descrição", "Importância", "Saldo"],
  ];

  for (const linha of conteudo.split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa) continue;
    const m = padrao.exec(limpa);
    if (!m) continue;
    grelha.push([m[1], m[2] ?? null, m[3].trim(), m[4], m[5] ?? null]);
  }

  if (grelha.length === 1) {
    throw new Error(
      "Não foi possível encontrar movimentos neste PDF. " +
        "Se o teu banco permitir, exporta antes em CSV ou XLSX.",
    );
  }

  const { linhas, mapeamento } = linhasDeGrelha(grelha);
  return {
    linhas,
    mapeamento,
    formato: "pdf",
    aviso:
      "A leitura de PDF é aproximada. Confirma cada linha antes de gravar, " +
      "sobretudo os valores e as datas.",
  };
}
