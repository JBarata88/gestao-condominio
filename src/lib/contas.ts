/**
 * Núcleo de cálculo das contas do condomínio.
 *
 * Substitui as fórmulas encadeadas das folhas mensais. Nada aqui lê a base de
 * dados: recebe movimentos e devolve totais, para poder ser testado contra os
 * números reais de 2026 sem ligação ao Supabase.
 */

import { arredondar, somar } from "./formatos";
import type { NaturezaCategoria, TipoConta } from "./tipos-bd";

export type MovimentoCalculo = {
  data: string;
  conta: TipoConta;
  receita: number;
  despesa: number;
  categoria: string;
  natureza: NaturezaCategoria;
  /** Rótulo da linha no mapa. Quando ausente, usa-se o nome da categoria. */
  linhaMoaf?: string | null;
};

export type SaldosAbertura = {
  caixa: number;
  depositoOrdem: number;
  depositoPrazo: number;
  contaPoupanca: number;
};

export const ABERTURA_VAZIA: SaldosAbertura = {
  caixa: 0,
  depositoOrdem: 0,
  depositoPrazo: 0,
  contaPoupanca: 0,
};

export type Disponibilidades = SaldosAbertura & { total: number };

/** Soma dos quatro saldos. */
export function totalDisponibilidades(s: SaldosAbertura): number {
  return somar([s.caixa, s.depositoOrdem, s.depositoPrazo, s.contaPoupanca]);
}

/**
 * Saldos de caixa e de banco depois de aplicados os movimentos.
 *
 * As transferências entre contas entram aqui, ao contrário do que acontece no
 * mapa: um depósito bancário sai de caixa e entra no banco, por isso mexe nos
 * saldos mas não é receita nem despesa do condomínio.
 */
export function saldosApos(
  movimentos: readonly MovimentoCalculo[],
  abertura: SaldosAbertura = ABERTURA_VAZIA,
): Disponibilidades {
  const variacaoDe = (conta: TipoConta) =>
    somar(
      movimentos
        .filter((m) => m.conta === conta)
        .map((m) => arredondar(m.receita - m.despesa)),
    );

  const caixa = somar([abertura.caixa, variacaoDe("caixa")]);
  const depositoOrdem = somar([abertura.depositoOrdem, variacaoDe("banco")]);

  const saldos: SaldosAbertura = {
    caixa,
    depositoOrdem,
    // Sem movimentos associados nas folhas actuais; transitam inalterados.
    depositoPrazo: abertura.depositoPrazo,
    contaPoupanca: abertura.contaPoupanca,
  };

  return { ...saldos, total: totalDisponibilidades(saldos) };
}

export type LinhaMapa = { rotulo: string; valor: number };

export type Mapa = {
  origem: {
    anterior: Disponibilidades;
    atual: { linhas: LinhaMapa[]; subtotal: number };
    total: number;
  };
  aplicacao: {
    despesas: { linhas: LinhaMapa[]; subtotal: number };
    disponibilidades: Disponibilidades;
    total: number;
  };
  variacao: number;
  /** Diferença entre os dois totais. Tem de ser zero. */
  controlo: number;
};

/**
 * Mapa de origem e aplicação de fundos.
 *
 * A folha original escrevia as disponibilidades finais à mão, o que deixava a
 * célula de controlo em 119,99 € em vez de zero. Aqui as disponibilidades são
 * derivadas dos movimentos, portanto o controlo fecha sempre.
 */
export function construirMapa(
  movimentos: readonly MovimentoCalculo[],
  abertura: SaldosAbertura = ABERTURA_VAZIA,
  /** Rótulos a listar mesmo com valor zero, para o mapa ter sempre a mesma forma. */
  rotulosFixos: { receitas?: readonly string[]; despesas?: readonly string[] } = {},
): Mapa {
  // As transferências entre contas não são origem nem aplicação de fundos.
  const correntes = movimentos.filter((m) => m.natureza !== "transferencia");

  const agrupar = (natureza: NaturezaCategoria, fixos: readonly string[]) => {
    const totais = new Map<string, number>();
    for (const rotulo of fixos) totais.set(rotulo, 0);

    for (const m of correntes) {
      if (m.natureza !== natureza) continue;
      const rotulo = m.linhaMoaf ?? m.categoria;
      const valor = natureza === "receita" ? m.receita : m.despesa;
      totais.set(rotulo, somar([totais.get(rotulo) ?? 0, valor]));
    }

    const linhas = [...totais].map(([rotulo, valor]) => ({ rotulo, valor }));
    return { linhas, subtotal: somar(linhas.map((l) => l.valor)) };
  };

  const atual = agrupar("receita", rotulosFixos.receitas ?? []);
  const despesas = agrupar("despesa", rotulosFixos.despesas ?? []);

  const anterior: Disponibilidades = {
    ...abertura,
    total: totalDisponibilidades(abertura),
  };
  const disponibilidades = saldosApos(movimentos, abertura);

  const totalOrigem = somar([anterior.total, atual.subtotal]);
  const totalAplicacao = somar([despesas.subtotal, disponibilidades.total]);

  return {
    origem: { anterior, atual, total: totalOrigem },
    aplicacao: { despesas, disponibilidades, total: totalAplicacao },
    variacao: arredondar(disponibilidades.total - anterior.total),
    controlo: arredondar(totalAplicacao - totalOrigem),
  };
}

/** Filtra movimentos a um intervalo de datas, inclusivo nos dois extremos. */
export function noPeriodo<T extends { data: string }>(
  movimentos: readonly T[],
  inicio: string,
  fim: string,
): T[] {
  return movimentos.filter((m) => m.data >= inicio && m.data <= fim);
}

/**
 * Saldo acumulado linha a linha, como a coluna de saldo das folhas mensais,
 * mas calculado em vez de guardado.
 */
export function comSaldoAcumulado<T extends MovimentoCalculo>(
  movimentos: readonly T[],
  abertura: SaldosAbertura = ABERTURA_VAZIA,
): Array<T & { saldoCaixa: number; saldoBanco: number }> {
  let caixa = abertura.caixa;
  let banco = abertura.depositoOrdem;

  return [...movimentos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((m) => {
      const delta = arredondar(m.receita - m.despesa);
      if (m.conta === "caixa") caixa = somar([caixa, delta]);
      else banco = somar([banco, delta]);
      return { ...m, saldoCaixa: caixa, saldoBanco: banco };
    });
}
