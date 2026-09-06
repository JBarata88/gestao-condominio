/**
 * Estado de pagamento das quotas, fração a fração e mês a mês.
 *
 * O modelo é o de uma conta corrente, não o de uma etiqueta por movimento.
 * Soma-se tudo o que uma fração já pagou de quotas no ano, banco e caixa
 * juntos, e distribui-se esse total pelos doze meses por ordem, como uma
 * cascata: o primeiro mês fica cheio antes de sobrar dinheiro para o
 * segundo, e assim por diante. Sabe-se assim quantos meses estão cobertos
 * sem ser preciso saber a que mês exacto cada transferência respeitava.
 *
 * A alternativa — exigir que cada movimento diga "isto é a quota de Março" —
 * partia-se sempre que a data do banco e a data de lançamento em livro não
 * coincidiam, o que no dia a dia é a regra e não a excepção.
 *
 * Corresponde ao ficheiro QUOTAS2026.xls, que era uma grelha preenchida à mão.
 * O prazo de pagamento vem das Definições e está a 8 por omissão.
 */

import { arredondar, somar } from "./formatos";

export type EstadoQuota =
  | "pago"
  | "parcial"
  | "pendente"
  | "atrasado"
  | "futuro"
  | "isento";

export type FracaoQuota = {
  id: string;
  letra: string;
  andar: string;
  quotaMensal: number;
  ativo: boolean;
};

export type PagamentoQuota = {
  fracaoId: string | null;
  valor: number;
};

export type CelulaQuota = {
  mes: number;
  devido: number;
  pago: number;
  emFalta: number;
  estado: EstadoQuota;
};

export type LinhaQuotas = {
  fracao: FracaoQuota;
  celulas: CelulaQuota[];
  totalDevido: number;
  totalPago: number;
  totalEmFalta: number;
  /** Meses cheios que o total pago já cobre, incluindo os já vencidos e os futuros. */
  mesesPagos: number;
};

/**
 * Data limite de pagamento de um mês.
 *
 * Se o dia limite não existir no mês, usa-se o último dia. Não acontece com o
 * dia 8, mas evita um prazo inválido se alguém puser 30 nas Definições.
 */
export function limiteDoMes(ano: number, mes: number, diaLimite: number): string {
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dia = Math.min(Math.max(diaLimite, 1), ultimoDia);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function chaveMesQuota(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

export function matrizQuotas({
  fracoes,
  pagamentos,
  ano,
  diaLimite,
  hoje,
}: {
  fracoes: readonly FracaoQuota[];
  /** Todos os recebimentos de quotas da fração no ano, sem precisarem de dizer a que mês respeitam. */
  pagamentos: readonly PagamentoQuota[];
  ano: number;
  diaLimite: number;
  /** Data de referência em ISO, para o cálculo de atrasos. */
  hoje: string;
}): LinhaQuotas[] {
  const totalPorFracao = new Map<string, number>();
  for (const p of pagamentos) {
    if (!p.fracaoId) continue;
    totalPorFracao.set(
      p.fracaoId,
      somar([totalPorFracao.get(p.fracaoId) ?? 0, p.valor]),
    );
  }

  return fracoes.map((fracao) => {
    const devidoPorMes = fracao.ativo ? arredondar(fracao.quotaMensal) : 0;

    // Uma fração inactiva não acumula nem dívida nem crédito: não há
    // obrigação nenhuma a distribuir.
    let saldo = fracao.ativo ? (totalPorFracao.get(fracao.id) ?? 0) : 0;

    const celulas: CelulaQuota[] = [];
    for (let mes = 1; mes <= 12; mes++) {
      // Cascata: este mês consome primeiro o que sobrar do saldo acumulado,
      // até ao limite da própria quota. O resto transita para o mês seguinte.
      const pago =
        devidoPorMes === 0 ? 0 : arredondar(Math.min(Math.max(saldo, 0), devidoPorMes));
      saldo = arredondar(saldo - pago);

      const emFalta = arredondar(Math.max(devidoPorMes - pago, 0));

      celulas.push({
        mes,
        devido: devidoPorMes,
        pago,
        emFalta,
        estado: estadoDe({ devido: devidoPorMes, pago, ano, mes, diaLimite, hoje }),
      });
    }

    return {
      fracao,
      celulas,
      totalDevido: somar(celulas.map((c) => c.devido)),
      totalPago: somar(celulas.map((c) => c.pago)),
      totalEmFalta: somar(celulas.map((c) => c.emFalta)),
      mesesPagos: celulas.filter((c) => c.estado === "pago").length,
    };
  });
}

function estadoDe({
  devido,
  pago,
  ano,
  mes,
  diaLimite,
  hoje,
}: {
  devido: number;
  pago: number;
  ano: number;
  mes: number;
  diaLimite: number;
  hoje: string;
}): EstadoQuota {
  if (devido === 0) return pago > 0 ? "pago" : "isento";
  // Um mês inteiramente coberto está pago mesmo que ainda não tenha começado:
  // um adiantamento não fica invisível só porque o calendário ainda não
  // chegou lá.
  if (pago >= devido) return "pago";

  const limite = limiteDoMes(ano, mes, diaLimite);
  const inicioDoMes = chaveMesQuota(ano, mes);

  // Um mês que ainda não começou não está pendente de ninguém.
  if (hoje < inicioDoMes) return "futuro";
  // Dentro do prazo ainda não é atraso.
  if (hoje <= limite) return pago > 0 ? "parcial" : "pendente";

  return pago > 0 ? "parcial" : "atrasado";
}

/** Frações com pelo menos um mês em atraso, para o indicador do painel. */
export function fracoesEmAtraso(linhas: readonly LinhaQuotas[]): LinhaQuotas[] {
  return linhas.filter((l) =>
    l.celulas.some((c) => c.estado === "atrasado" || c.estado === "parcial"),
  );
}

/** Valor total por cobrar, somando todas as frações. */
export function totalPorCobrar(linhas: readonly LinhaQuotas[]): number {
  return somar(
    linhas.flatMap((l) =>
      l.celulas
        .filter((c) => c.estado === "atrasado" || c.estado === "parcial")
        .map((c) => c.emFalta),
    ),
  );
}
