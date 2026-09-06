/** Formatação de valores, datas e meses em português europeu. */

const MOEDA = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DECIMAL = new Intl.NumberFormat("pt-PT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1234.5 -> "1 234,50 €" */
export function euros(valor: number): string {
  return MOEDA.format(arredondar(valor));
}

/** 1234.5 -> "1 234,50" (sem símbolo, para tabelas com cabeçalho em euros) */
export function decimal(valor: number): string {
  return DECIMAL.format(arredondar(valor));
}

/**
 * Arredonda a dois decimais em cêntimos inteiros.
 *
 * As folhas actuais arrastam erros de vírgula flutuante — 102,11 está gravado
 * como 102,10999999999999 e o total de despesas como 1738,6899999999998. Todo
 * o dinheiro passa por aqui antes de ser somado ou apresentado.
 */
export function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Soma uma lista de valores monetários sem acumular erro de vírgula flutuante. */
export function somar(valores: readonly number[]): number {
  const centimos = valores.reduce(
    (total, v) => total + Math.round(v * 100),
    0,
  );
  return centimos / 100;
}

export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

/** Abreviaturas usadas nas descrições dos movimentos: "QUOTA JAN FRACÇÃO G". */
export const MESES_ABREVIADOS = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
] as const;

/** mes de 1 a 12 -> "JANEIRO" */
export function mesPorExtenso(mes: number): string {
  const nome = MESES[mes - 1];
  if (!nome) throw new RangeError(`Mês inválido: ${mes}`);
  return nome.toUpperCase();
}

/**
 * Expande um intervalo de meses de quota ("AAAA-MM-01" a "AAAA-MM-01") numa
 * lista de meses de 1 a 12, para os recibos e para a matriz de Quotas.
 *
 * Um intervalo que atravessasse o ano não seria representável num só recibo
 * "de X" (que assume um único ano), por isso nesse caso raro usa-se só o mês
 * de início.
 */
export function mesesDoIntervalo(
  quotaMes: string,
  quotaMesFim: string | null,
): number[] {
  const anoDe = Number(quotaMes.slice(0, 4));
  const mesDe = Number(quotaMes.slice(5, 7));
  if (!quotaMesFim) return [mesDe];

  const anoAte = Number(quotaMesFim.slice(0, 4));
  const mesAte = Number(quotaMesFim.slice(5, 7));
  if (anoAte !== anoDe) return [mesDe];

  const meses: number[] = [];
  for (let m = mesDe; m <= mesAte; m++) meses.push(m);
  return meses;
}

/** "2026-01" e "2026-08" -> "Janeiro a Agosto de 2026". Para mostrar em modo leitura. */
export function textoIntervaloQuota(
  quotaMes: string | null,
  quotaMesFim: string | null,
): string | null {
  if (!quotaMes) return null;
  const mesDe = Number(quotaMes.slice(5, 7));
  const anoDe = quotaMes.slice(0, 4);
  const nomeDe = MESES[mesDe - 1]?.slice(0, 3);

  if (!quotaMesFim || quotaMesFim === quotaMes) {
    return `${nomeDe} ${anoDe}`;
  }

  const mesAte = Number(quotaMesFim.slice(5, 7));
  const anoAte = quotaMesFim.slice(0, 4);
  const nomeAte = MESES[mesAte - 1]?.slice(0, 3);
  return anoDe === anoAte
    ? `${nomeDe} a ${nomeAte} ${anoDe}`
    : `${nomeDe} ${anoDe} a ${nomeAte} ${anoAte}`;
}

/** "2026-01-28" ou Date -> "28/01/2026" */
export function dataCurta(data: string | Date): string {
  const d = comoData(data);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

/** "2026-01-28" -> "28 DE JANEIRO DE 2026", como nos recibos. */
export function dataPorExtenso(data: string | Date): string {
  const d = comoData(data);
  return `${d.getUTCDate()} DE ${mesPorExtenso(d.getUTCMonth() + 1)} DE ${d.getUTCFullYear()}`;
}

/**
 * As folhas guardam datas como números de série do Excel (46023 = 2026-01-05).
 * O sistema de datas do Excel conta a partir de 1899-12-30 e trata 1900 como
 * ano bissexto, que não foi; o desvio já está incluído nesta origem.
 */
export function dataDeSerieExcel(serie: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + serie * 86_400_000);
}

/** Normaliza para um Date em UTC, sem deslocação de fuso horário. */
function comoData(data: string | Date): Date {
  if (data instanceof Date) return data;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  if (iso) {
    return new Date(
      Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
    );
  }
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Data inválida: ${data}`);
  return d;
}

/** "2026-01" para agrupar por mês. */
export function chaveMes(data: string | Date): string {
  const d = comoData(data);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
