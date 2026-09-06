/**
 * Conversão de valores em numerário para extenso, em português europeu.
 *
 * Os pacotes existentes no npm usam ortografia do Brasil, que difere nas
 * dezenas de 14, 16, 17 e 19 ("catorze" e não "quatorze", "dezasseis" e não
 * "dezesseis", "dezassete", "dezanove"). Os recibos do condomínio são
 * documentos com valor legal, por isso a grafia tem de ser a portuguesa.
 */

const UNIDADES = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "catorze",
  "quinze",
  "dezasseis",
  "dezassete",
  "dezoito",
  "dezanove",
];

const DEZENAS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];

const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

/** Converte um número de 1 a 999. */
function grupo(n: number): string {
  if (n === 100) return "cem";

  const centenas = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (centenas > 0) partes.push(CENTENAS[centenas]);

  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto]);
    } else {
      const dezena = Math.floor(resto / 10);
      const unidade = resto % 10;
      partes.push(
        unidade > 0
          ? `${DEZENAS[dezena]} e ${UNIDADES[unidade]}`
          : DEZENAS[dezena],
      );
    }
  }

  return partes.join(" e ");
}

/** Converte um inteiro não negativo até 999 999 999. */
export function inteiroPorExtenso(n: number): string {
  if (!Number.isFinite(n) || n < 0) {
    throw new RangeError(`Valor não convertível para extenso: ${n}`);
  }
  if (n === 0) return "zero";
  if (n > 999_999_999) {
    throw new RangeError(`Valor acima do suportado para extenso: ${n}`);
  }

  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const partes: string[] = [];
  if (milhoes > 0) {
    partes.push(milhoes === 1 ? "um milhão" : `${grupo(milhoes)} milhões`);
  }
  if (milhares > 0) {
    partes.push(milhares === 1 ? "mil" : `${grupo(milhares)} mil`);
  }
  if (resto > 0) {
    partes.push(grupo(resto));
  }

  if (partes.length === 1) return partes[0];

  // Em português, liga-se o último grupo com "e" quando o resto é inferior a
  // cem ou é uma centena exacta: "mil e quinhentos", mas "mil duzentos e trinta".
  const ultimo = partes[partes.length - 1];
  const iniciais = partes.slice(0, -1).join(", ");
  const ligaComE = resto === 0 || resto < 100 || resto % 100 === 0;

  return ligaComE ? `${iniciais} e ${ultimo}` : `${iniciais} ${ultimo}`;
}

/**
 * Converte um valor em euros para extenso.
 *
 * @example valorPorExtenso(35) === "trinta e cinco euros"
 * @example valorPorExtenso(120) === "cento e vinte euros"
 * @example valorPorExtenso(1.5) === "um euro e cinquenta cêntimos"
 */
export function valorPorExtenso(valor: number): string {
  if (!Number.isFinite(valor)) {
    throw new RangeError(`Valor não convertível para extenso: ${valor}`);
  }
  if (valor < 0) {
    return `menos ${valorPorExtenso(Math.abs(valor))}`;
  }

  // Trabalhar em cêntimos evita os erros de vírgula flutuante que já existem
  // nas folhas de cálculo actuais, onde 102,11 aparece como 102,10999999999999.
  const totalCentimos = Math.round(valor * 100);
  const euros = Math.floor(totalCentimos / 100);
  const centimos = totalCentimos % 100;

  const partes: string[] = [];
  if (euros > 0) {
    partes.push(`${inteiroPorExtenso(euros)} ${euros === 1 ? "euro" : "euros"}`);
  }
  if (centimos > 0) {
    partes.push(
      `${inteiroPorExtenso(centimos)} ${centimos === 1 ? "cêntimo" : "cêntimos"}`,
    );
  }

  if (partes.length === 0) return "zero euros";
  return partes.join(" e ");
}

/** Igual a valorPorExtenso, em maiúsculas, como aparece nos recibos. */
export function valorPorExtensoMaiusculas(valor: number): string {
  return valorPorExtenso(valor).toUpperCase();
}
