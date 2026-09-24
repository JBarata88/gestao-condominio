/**
 * Estado de pagamento de um reforço extraordinário, fração a fração.
 *
 * Ao contrário da quota mensal, um reforço não é recorrente: é um valor único
 * por fração, com um único prazo de pagamento. A lógica de conta corrente é a
 * mesma das quotas (soma-se tudo o que a fração já pagou, sem ser preciso
 * saber a que movimento exacto correspondia), só que sem os doze meses.
 */

import { arredondar, somar } from "./formatos";

export type EstadoReforco = "pago" | "parcial" | "pendente" | "atrasado" | "isento";

export type FracaoReforco = {
  id: string;
  letra: string;
  andar: string;
  ativo: boolean;
};

export type PagamentoReforco = {
  fracaoId: string | null;
  valor: number;
};

export type LinhaReforco = {
  fracao: FracaoReforco;
  devido: number;
  pago: number;
  emFalta: number;
  estado: EstadoReforco;
};

export function matrizReforco({
  fracoes,
  pagamentos,
  valorFracao,
  dataLimite,
  hoje,
}: {
  fracoes: readonly FracaoReforco[];
  /** Todos os recebimentos deste reforço no ano, por fração. */
  pagamentos: readonly PagamentoReforco[];
  valorFracao: number;
  dataLimite: string;
  /** Data de referência em ISO, para o cálculo de atrasos. */
  hoje: string;
}): LinhaReforco[] {
  const totalPorFracao = new Map<string, number>();
  for (const p of pagamentos) {
    if (!p.fracaoId) continue;
    totalPorFracao.set(
      p.fracaoId,
      somar([totalPorFracao.get(p.fracaoId) ?? 0, p.valor]),
    );
  }

  return fracoes.map((fracao) => {
    const devido = fracao.ativo ? arredondar(valorFracao) : 0;
    const pagoBruto = fracao.ativo ? (totalPorFracao.get(fracao.id) ?? 0) : 0;
    const pago = devido === 0 ? 0 : arredondar(Math.min(Math.max(pagoBruto, 0), devido));
    const emFalta = arredondar(Math.max(devido - pago, 0));

    let estado: EstadoReforco;
    if (devido === 0) {
      estado = pago > 0 ? "pago" : "isento";
    } else if (pago >= devido) {
      estado = "pago";
    } else if (hoje <= dataLimite) {
      estado = pago > 0 ? "parcial" : "pendente";
    } else {
      estado = pago > 0 ? "parcial" : "atrasado";
    }

    return { fracao, devido, pago, emFalta, estado };
  });
}

export type TotaisReforco = {
  pago: number;
  atrasado: number;
  porPagar: number;
};

/** Totais em euros para os KPIs do reforço. */
export function totaisReforco(linhas: readonly LinhaReforco[]): TotaisReforco {
  return {
    pago: somar(linhas.filter((l) => l.estado === "pago").map((l) => l.devido)),
    atrasado: somar(linhas.filter((l) => l.estado === "atrasado").map((l) => l.emFalta)),
    porPagar: somar(linhas.map((l) => l.emFalta)),
  };
}
