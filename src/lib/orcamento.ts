/**
 * Comparação entre o orçamento aprovado em assembleia e o realizado.
 *
 * Reaproveita o Mapa já calculado por construirMapa (o mesmo que os
 * Relatórios mostram) e junta-lhe, linha a linha, o valor previsto. A
 * administração anterior não tem valor previsto próprio: o orçamento é
 * escrito já a saber os saldos de abertura, por isso previsto e real
 * coincidem sempre aí.
 */

import { arredondar, somar } from "./formatos";
import { totalDisponibilidades, type Mapa, type SaldosAbertura } from "./contas";

export type LinhaOrcamento = {
  rotulo: string;
  orcamentado: number;
  realizado: number;
  desvioValor: number;
  /** Em percentagem (25 significa 25%). Fica a 0 quando não há valor orçamentado. */
  desvioPercentagem: number;
};

function linha(rotulo: string, orcamentado: number, realizado: number): LinhaOrcamento {
  const desvioValor = arredondar(realizado - orcamentado);
  // Divide pelo valor absoluto: um orçamentado negativo (só acontece na
  // variação das disponibilidades, quando se prevê gastar mais do que entra)
  // não deve inverter o sinal da percentagem — um desvio positivo é sempre
  // "acima do previsto", nunca o contrário.
  const desvioPercentagem =
    orcamentado === 0 ? 0 : arredondar((desvioValor / Math.abs(orcamentado)) * 100);
  return { rotulo, orcamentado, realizado, desvioValor, desvioPercentagem };
}

function somarLinhas(linhas: readonly LinhaOrcamento[], campo: "orcamentado" | "realizado"): number {
  return somar(linhas.map((l) => l[campo]));
}

export type MapaOrcamento = {
  origem: {
    anterior: LinhaOrcamento[];
    anteriorSubtotal: LinhaOrcamento;
    atual: LinhaOrcamento[];
    atualSubtotal: LinhaOrcamento;
    total: LinhaOrcamento;
  };
  aplicacao: {
    despesas: LinhaOrcamento[];
    despesasSubtotal: LinhaOrcamento;
    disponibilidades: LinhaOrcamento[];
    disponibilidadesSubtotal: LinhaOrcamento;
    total: LinhaOrcamento;
  };
  variacao: LinhaOrcamento;
  /** Diferença entre os dois totais. Tem de ser zero em cada coluna. */
  controloOrcamentado: number;
  controloRealizado: number;
};

const RUBRICAS_ANTERIOR = [
  { chave: "caixa", rotulo: "Caixa" },
  { chave: "depositoOrdem", rotulo: "Depósitos à ordem" },
  { chave: "depositoPrazo", rotulo: "Depósitos a prazo/Certificados de aforro" },
  { chave: "contaPoupanca", rotulo: "Conta poupança - condominio" },
] as const;

export function construirMapaOrcamento({
  mapaReal,
  orcamentoReceitas,
  orcamentoDespesas,
  disponibilidadesOrcamento,
}: {
  mapaReal: Mapa;
  /** Valor previsto por rótulo de receita (linha_moaf ou nome da categoria). */
  orcamentoReceitas: Map<string, number>;
  /** Valor previsto por rótulo de despesa. */
  orcamentoDespesas: Map<string, number>;
  disponibilidadesOrcamento: SaldosAbertura;
}): MapaOrcamento {
  // A administração anterior é sempre igual ao real: o orçamento é escrito já
  // a conhecer os saldos de abertura do ano.
  const anterior = RUBRICAS_ANTERIOR.map(({ chave, rotulo }) =>
    linha(rotulo, mapaReal.origem.anterior[chave], mapaReal.origem.anterior[chave]),
  );
  const anteriorSubtotal = linha(
    "SUB-TOTAL",
    mapaReal.origem.anterior.total,
    mapaReal.origem.anterior.total,
  );

  const atual = mapaReal.origem.atual.linhas.map((l) =>
    linha(l.rotulo, orcamentoReceitas.get(l.rotulo) ?? 0, l.valor),
  );
  const atualSubtotal = linha(
    "SUB-TOTAL",
    somarLinhas(atual, "orcamentado"),
    mapaReal.origem.atual.subtotal,
  );

  const totalOrigem = linha(
    "TOTAL",
    somar([anteriorSubtotal.orcamentado, atualSubtotal.orcamentado]),
    mapaReal.origem.total,
  );

  const despesas = mapaReal.aplicacao.despesas.linhas.map((l) =>
    linha(l.rotulo, orcamentoDespesas.get(l.rotulo) ?? 0, l.valor),
  );
  const despesasSubtotal = linha(
    "SUB-TOTAL",
    somarLinhas(despesas, "orcamentado"),
    mapaReal.aplicacao.despesas.subtotal,
  );

  const disponibilidades = RUBRICAS_ANTERIOR.map(({ chave, rotulo }) =>
    linha(rotulo, disponibilidadesOrcamento[chave], mapaReal.aplicacao.disponibilidades[chave]),
  );
  const disponibilidadesSubtotal = linha(
    "SUB-TOTAL",
    totalDisponibilidades(disponibilidadesOrcamento),
    mapaReal.aplicacao.disponibilidades.total,
  );

  const totalAplicacao = linha(
    "TOTAL",
    somar([despesasSubtotal.orcamentado, disponibilidadesSubtotal.orcamentado]),
    mapaReal.aplicacao.total,
  );

  const variacao = linha(
    "Variação das disponibilidades",
    arredondar(disponibilidadesSubtotal.orcamentado - anteriorSubtotal.orcamentado),
    mapaReal.variacao,
  );

  return {
    origem: { anterior, anteriorSubtotal, atual, atualSubtotal, total: totalOrigem },
    aplicacao: {
      despesas,
      despesasSubtotal,
      disponibilidades,
      disponibilidadesSubtotal,
      total: totalAplicacao,
    },
    variacao,
    controloOrcamentado: arredondar(totalAplicacao.orcamentado - totalOrigem.orcamentado),
    controloRealizado: arredondar(totalAplicacao.realizado - totalOrigem.realizado),
  };
}
