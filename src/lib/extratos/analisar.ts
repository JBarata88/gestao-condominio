/**
 * Leitura de extratos bancários.
 *
 * Os bancos portugueses exportam em formatos diferentes. Alguns dão uma coluna
 * única de importância com sinal, outros separam débito e crédito. Os números
 * vêm à portuguesa, com ponto de milhares e vírgula decimal. As datas tanto
 * aparecem como dd-mm-aaaa como aaaa-mm-dd.
 *
 * Este módulo normaliza tudo para uma linha só: data, descrição e valor com
 * sinal, sendo positivo uma entrada e negativo uma saída.
 */

import { arredondar } from "../formatos";

export type LinhaExtrato = {
  dataMov: string;
  dataValor: string | null;
  descricao: string;
  /** Positivo é entrada, negativo é saída. */
  valor: number;
  saldo: number | null;
  linhaOrigem: number;
  impressaoDigital: string;
};

export type Mapeamento = {
  dataMov: number;
  dataValor: number | null;
  descricao: number;
  /** Coluna única com sinal. */
  importancia: number | null;
  /** Ou duas colunas separadas. */
  debito: number | null;
  credito: number | null;
  saldo: number | null;
};

/**
 * Nomes de coluna por banco.
 *
 * Alguns bancos abreviam "Data" para "D.", e um extrato pode trazer três
 * colunas de data: operação, contabilística e valor. A data do movimento é a
 * da operação, que é quando a coisa aconteceu.
 */
const SINONIMOS = {
  dataMov: [
    "data operacao",
    "d. operacao",
    "d operacao",
    "dt. operacao",
    "dt operacao",
    "data da operacao",
    "data mov",
    "data movimento",
    "d. mov",
    "d mov",
    "data lancamento",
    "data",
  ],
  dataValor: ["data valor", "d. valor", "d valor", "data de valor", "dt. valor"],
  descricao: [
    "descricao",
    "descritivo",
    "historico",
    "designacao",
    "detalhe",
    "movimento",
  ],
  importancia: ["importancia", "montante", "valor", "quantia"],
  debito: ["debito", "debitos", "saida", "saidas"],
  credito: ["credito", "creditos", "entrada", "entradas"],
  saldo: ["saldo", "saldo contabilistico", "saldo apos movimento"],
} as const;

/** Remove acentos e baixa para minúsculas, para comparar cabeçalhos. */
export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converte um número escrito à portuguesa.
 *
 * "1.234,56" -> 1234.56 ; "1 234,56" -> 1234.56 ; "-45,60" -> -45.6
 * Também aceita o formato inglês "1,234.56" quando não há ambiguidade.
 */
export function lerNumero(bruto: string): number | null {
  if (typeof bruto !== "string") return null;
  let s = bruto.trim();
  if (s === "") return null;

  // Parênteses indicam valor negativo em alguns extratos.
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }

  s = s.replace(/[€\s  ]/g, "");
  if (s.startsWith("-")) {
    negativo = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }

  const temPonto = s.includes(".");
  const temVirgula = s.includes(",");

  if (temPonto && temVirgula) {
    // O separador decimal é o que aparece mais à direita.
    s =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (temVirgula) {
    s = s.replace(",", ".");
  }
  // Só com ponto: pode ser decimal inglês ou milhares português. Se houver
  // exactamente três dígitos depois do último ponto e mais de um grupo, é
  // separador de milhares.
  else if (temPonto && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return arredondar(negativo ? -n : n);
}

/** Converte uma data de extrato para ISO. */
export function lerData(bruto: string | Date | null | undefined): string | null {
  if (!bruto) return null;
  if (bruto instanceof Date) return bruto.toISOString().slice(0, 10);

  const s = String(bruto).trim();
  if (s === "") return null;

  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]));

  // Ano a dois dígitos: assume o século 2000, que é o que os bancos usam.
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/.exec(s);
  if (m) return iso(2000 + Number(m[3]), Number(m[2]), Number(m[1]));

  return null;
}

function iso(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // Rejeita datas como 31 de Fevereiro, que o Date faria transbordar.
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d.toISOString().slice(0, 10);
}

type Celula = string | number | Date | null;

/** Proporção de células de uma coluna que satisfazem um teste. */
function proporcao(
  amostra: readonly (readonly Celula[])[],
  coluna: number,
  teste: (v: Celula) => boolean,
): number {
  const valores = amostra
    .map((linha) => (coluna < linha.length ? linha[coluna] : null))
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (valores.length === 0) return 0;
  return valores.filter(teste).length / valores.length;
}

const pareceData = (v: Celula) =>
  v instanceof Date || lerData(typeof v === "string" ? v : String(v)) !== null;

const pareceNumero = (v: Celula) =>
  typeof v === "number" || (typeof v === "string" && lerNumero(v) !== null);

/**
 * Descobre que coluna é cada coisa.
 *
 * Primeiro pelo nome do cabeçalho, que é o caminho fiável. Quando o banco usa
 * nomes que não reconhecemos, cai para a análise do conteúdo das células: uma
 * coluna cujos valores são quase todos datas é a coluna da data.
 *
 * Devolve null quando não encontra o mínimo indispensável.
 */
export function detectarMapeamento(
  cabecalho: readonly string[],
  amostra: readonly (readonly Celula[])[] = [],
): Mapeamento | null {
  const normalizado = cabecalho.map(normalizarTexto);
  const usados = new Set<number>();

  const procurar = (chaves: readonly string[]): number | null => {
    // Correspondência exacta primeiro, depois por prefixo, para que "data"
    // não roube a coluna de "data valor".
    for (const chave of chaves) {
      const i = normalizado.indexOf(chave);
      if (i !== -1 && !usados.has(i)) {
        usados.add(i);
        return i;
      }
    }
    for (const chave of chaves) {
      const i = normalizado.findIndex(
        (c, j) => !usados.has(j) && c.startsWith(chave),
      );
      if (i !== -1) {
        usados.add(i);
        return i;
      }
    }
    return null;
  };

  // A data da operação é procurada antes da data-valor, porque é a que conta
  // como data do movimento.
  let dataMov = procurar(SINONIMOS.dataMov);
  let dataValor = procurar(SINONIMOS.dataValor);

  // Se só apanhámos a data-valor, ela serve de data do movimento.
  if (dataMov === null && dataValor !== null) {
    dataMov = dataValor;
    dataValor = null;
  }

  let descricao = procurar(SINONIMOS.descricao);
  const debito = procurar(SINONIMOS.debito);
  const credito = procurar(SINONIMOS.credito);
  let importancia =
    debito !== null && credito !== null ? null : procurar(SINONIMOS.importancia);
  const saldo = procurar(SINONIMOS.saldo);

  // --- Último recurso: olhar para o conteúdo -------------------------------
  if (amostra.length > 0) {
    if (dataMov === null) {
      const i = indiceComMaior(amostra, (c) =>
        usados.has(c) ? -1 : proporcao(amostra, c, pareceData),
      );
      if (i !== null) {
        dataMov = i;
        usados.add(i);
      }
    }

    if (importancia === null && debito === null && credito === null) {
      const i = indiceComMaior(amostra, (c) =>
        usados.has(c) ? -1 : proporcao(amostra, c, pareceNumero),
      );
      if (i !== null) {
        importancia = i;
        usados.add(i);
      }
    }

    if (descricao === null) {
      // A descrição é a coluna com mais texto que não é data nem número.
      const i = indiceComMaior(amostra, (c) =>
        usados.has(c)
          ? -1
          : proporcao(amostra, c, (v) => !pareceData(v) && !pareceNumero(v)),
      );
      if (i !== null) {
        descricao = i;
        usados.add(i);
      }
    }
  }

  if (dataMov === null || descricao === null) return null;
  if (importancia === null && debito === null && credito === null) return null;

  return {
    dataMov,
    dataValor: dataValor === dataMov ? null : dataValor,
    descricao,
    importancia,
    debito,
    credito,
    saldo,
  };
}

/** Índice da coluna com a pontuação mais alta, se passar dos 60 por cento. */
function indiceComMaior(
  amostra: readonly (readonly Celula[])[],
  pontuar: (coluna: number) => number,
): number | null {
  const colunas = Math.max(...amostra.map((l) => l.length), 0);
  let melhor: number | null = null;
  let melhorPontuacao = 0.6;

  for (let c = 0; c < colunas; c++) {
    const p = pontuar(c);
    if (p > melhorPontuacao) {
      melhorPontuacao = p;
      melhor = c;
    }
  }
  return melhor;
}

/** Chave de agrupamento de movimentos indistinguíveis entre si. */
function chaveMovimento(
  dataMov: string,
  descricao: string,
  valor: number,
): string {
  return `${dataMov}|${normalizarTexto(descricao)}|${Math.round(valor * 100)}`;
}

/**
 * Impressão digital de uma linha, para detectar importações repetidas.
 *
 * Não usa o número de linha nem o ficheiro de origem, para que o mesmo
 * movimento vindo de dois extratos sobrepostos seja reconhecido como um só.
 *
 * O parâmetro "ocorrencia" distingue movimentos genuinamente repetidos: o
 * mesmo condómino pode transferir duas vezes o mesmo valor no mesmo dia, e
 * essas duas linhas são pagamentos diferentes. Sem isto, a segunda seria
 * tomada por repetição da primeira e nunca chegaria a ser gravada.
 *
 * A contagem é feita pela ordem em que as linhas aparecem no ficheiro, por
 * isso reimportar o mesmo extrato dá exactamente as mesmas impressões.
 */
export function impressaoDigital(
  dataMov: string,
  descricao: string,
  valor: number,
  ocorrencia = 0,
): string {
  const chave = chaveMovimento(dataMov, descricao, valor);
  const base = ocorrencia === 0 ? chave : `${chave}|#${ocorrencia}`;
  // Hash FNV-1a de 32 bits, suficiente para distinguir movimentos de um
  // condomínio e sem dependências.
  let h = 0x811c9dc5;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, "0")}-${base.length.toString(16)}`;
}

/** Converte uma grelha de células já lida para linhas de extrato. */
export function linhasDeGrelha(
  grelha: readonly (readonly (string | number | Date | null)[])[],
): { linhas: LinhaExtrato[]; mapeamento: Mapeamento; cabecalhoEm: number } {
  // Duas passagens. A primeira só olha para os nomes das colunas, que é o
  // critério fiável. A segunda, só se a primeira falhar em todas as linhas,
  // adivinha pelo conteúdo das células.
  //
  // A ordem importa: se a análise de conteúdo corresse desde logo, uma linha
  // de preâmbulo como "Extrato de conta" seria aceite como cabeçalho, porque
  // as linhas por baixo têm de facto datas, texto e números.
  for (const usarConteudo of [false, true]) {
    for (let i = 0; i < Math.min(grelha.length, 25); i++) {
      const candidato = grelha[i].map((c) => (c == null ? "" : String(c)));
      const amostra = usarConteudo ? grelha.slice(i + 1, i + 21) : [];
      const mapeamento = detectarMapeamento(candidato, amostra);
      if (!mapeamento) continue;

      const linhas: LinhaExtrato[] = [];
      // Conta quantas vezes cada movimento indistinguível já apareceu, para
      // dar impressões digitais diferentes a pagamentos genuinamente repetidos.
      const vistos = new Map<string, number>();

      for (let j = i + 1; j < grelha.length; j++) {
        const linha = converterLinha(grelha[j], mapeamento, j + 1, vistos);
        if (linha) linhas.push(linha);
      }
      if (linhas.length > 0) return { linhas, mapeamento, cabecalhoEm: i };
    }
  }

  throw new Error(
    "Não foi possível reconhecer as colunas do extrato. " +
      "É preciso uma coluna de data, uma de descrição e uma de valor.",
  );
}

function converterLinha(
  celulas: readonly (string | number | Date | null)[],
  m: Mapeamento,
  numeroLinha: number,
  /** Quantas vezes cada movimento indistinguível já foi visto no ficheiro. */
  vistos: Map<string, number>,
): LinhaExtrato | null {
  const bruto = (i: number | null) =>
    i === null || i >= celulas.length ? null : celulas[i];

  const comoTexto = (v: unknown) =>
    v == null ? "" : v instanceof Date ? v.toISOString() : String(v);

  const dataMov = lerData(bruto(m.dataMov) as string | Date | null);
  if (!dataMov) return null;

  const descricao = comoTexto(bruto(m.descricao)).trim();
  if (!descricao) return null;

  let valor: number | null = null;
  if (m.importancia !== null) {
    const v = bruto(m.importancia);
    valor = typeof v === "number" ? arredondar(v) : lerNumero(comoTexto(v));
  } else {
    const d = bruto(m.debito);
    const c = bruto(m.credito);
    const debito =
      typeof d === "number" ? arredondar(d) : lerNumero(comoTexto(d)) ?? 0;
    const credito =
      typeof c === "number" ? arredondar(c) : lerNumero(comoTexto(c)) ?? 0;
    // Nas colunas separadas, o débito costuma vir sem sinal.
    valor = arredondar(Math.abs(credito) - Math.abs(debito));
  }

  if (valor === null || valor === 0) return null;

  const saldoBruto = bruto(m.saldo);
  const saldo =
    typeof saldoBruto === "number"
      ? arredondar(saldoBruto)
      : lerNumero(comoTexto(saldoBruto));

  const chave = chaveMovimento(dataMov, descricao, valor);
  const ocorrencia = vistos.get(chave) ?? 0;
  vistos.set(chave, ocorrencia + 1);

  return {
    dataMov,
    dataValor: lerData(bruto(m.dataValor) as string | Date | null),
    descricao,
    valor,
    saldo,
    linhaOrigem: numeroLinha,
    impressaoDigital: impressaoDigital(dataMov, descricao, valor, ocorrencia),
  };
}
