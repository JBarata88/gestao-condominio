import test from "node:test";
import assert from "node:assert/strict";
import {
  fracoesEmAtraso,
  limiteDoMes,
  matrizQuotas,
  totalPorCobrar,
  type FracaoQuota,
  type PagamentoQuota,
} from "./quotas.ts";

const fracaoA: FracaoQuota = {
  id: "fa",
  letra: "A",
  andar: "1º DTO",
  quotaMensal: 35,
  ativo: true,
};
const fracaoG: FracaoQuota = {
  id: "fg",
  letra: "G",
  andar: "4º DTO",
  quotaMensal: 40,
  ativo: true,
};

function pagamento(fracaoId: string, valor: number): PagamentoQuota {
  return { fracaoId, valor };
}

test("o dia limite de pagamento é o 8, como definido", () => {
  assert.equal(limiteDoMes(2026, 1, 8), "2026-01-08");
  assert.equal(limiteDoMes(2026, 12, 8), "2026-12-08");
});

test("um dia limite acima do fim do mês cai no último dia", () => {
  assert.equal(limiteDoMes(2026, 2, 30), "2026-02-28");
  assert.equal(limiteDoMes(2024, 2, 30), "2024-02-29"); // ano bissexto
  assert.equal(limiteDoMes(2026, 4, 31), "2026-04-30");
});

test("um mês pago na totalidade fica pago", () => {
  const [linha] = matrizQuotas({
    fracoes: [fracaoA],
    pagamentos: [pagamento("fa", 35)],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-06-15",
  });
  assert.equal(linha.celulas[0].estado, "pago");
  assert.equal(linha.celulas[0].emFalta, 0);
});

test("dentro do prazo está pendente, não atrasado", () => {
  const [linha] = matrizQuotas({
    fracoes: [fracaoA],
    pagamentos: [],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-03-05", // antes do dia 8
  });
  assert.equal(linha.celulas[2].estado, "pendente");
});

test("passado o dia 8 sem pagamento fica atrasado", () => {
  const [linha] = matrizQuotas({
    fracoes: [fracaoA],
    pagamentos: [],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-03-09",
  });
  assert.equal(linha.celulas[2].estado, "atrasado");
});

test("o próprio dia 8 ainda está dentro do prazo", () => {
  const [linha] = matrizQuotas({
    fracoes: [fracaoA],
    pagamentos: [],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-03-08",
  });
  assert.equal(linha.celulas[2].estado, "pendente");
});

test("meses futuros sem cobertura não contam como dívida", () => {
  const [linha] = matrizQuotas({
    fracoes: [fracaoA],
    pagamentos: [],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-03-09",
  });
  assert.equal(linha.celulas[11].estado, "futuro"); // Dezembro
  assert.equal(linha.celulas[3].estado, "futuro"); // Abril
});

test("uma fração inactiva não gera dívida", () => {
  const [linha] = matrizQuotas({
    fracoes: [{ ...fracaoA, ativo: false }],
    pagamentos: [],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-06-01",
  });
  assert.equal(linha.celulas[0].estado, "isento");
  assert.equal(linha.totalDevido, 0);
});

test("pagamentos sem fração são ignorados", () => {
  const [linha] = matrizQuotas({
    fracoes: [fracaoA],
    pagamentos: [{ fracaoId: null, valor: 35 }],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-06-01",
  });
  assert.equal(linha.celulas[0].pago, 0);
  assert.equal(linha.celulas[0].estado, "atrasado");
});

// ---------------------------------------------------------------------------
// O modelo de conta corrente: soma-se tudo o que a fração pagou no ano e
// distribui-se em cascata pelos doze meses, por ordem. Não interessa a que
// mês uma transferência em concreto dizia respeito, nem em que ordem as
// linhas de pagamento chegam.
// ---------------------------------------------------------------------------

test("doze pagamentos de 40 € cobrem o ano inteiro", () => {
  const pagamentos = Array.from({ length: 12 }, () => pagamento("fg", 40));
  const [linha] = matrizQuotas({
    fracoes: [fracaoG],
    pagamentos,
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-12-31",
  });
  assert.equal(linha.mesesPagos, 12);
  assert.equal(linha.totalEmFalta, 0);
  assert.ok(linha.celulas.every((c) => c.estado === "pago"));
});

test("o total não depende da ordem em que os pagamentos chegam", () => {
  const emOrdem = matrizQuotas({
    fracoes: [fracaoG],
    pagamentos: [pagamento("fg", 40), pagamento("fg", 40), pagamento("fg", 40)],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-12-31",
  })[0];
  const baralhado = matrizQuotas({
    fracoes: [fracaoG],
    pagamentos: [pagamento("fg", 40), pagamento("fg", 40), pagamento("fg", 40)].reverse(),
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-12-31",
  })[0];
  assert.equal(emOrdem.mesesPagos, baralhado.mesesPagos);
  assert.equal(emOrdem.totalPago, baralhado.totalPago);
});

test("dois pagamentos de valor diferente somam antes de repartir pelos meses", () => {
  // Caso real do histórico: a fração H pagou 35 e depois 5 para completar 40.
  const [linha] = matrizQuotas({
    fracoes: [{ ...fracaoG, id: "fh", letra: "H" }],
    pagamentos: [pagamento("fh", 35), pagamento("fh", 5)],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-03-01",
  });
  assert.equal(linha.celulas[0].pago, 40);
  assert.equal(linha.celulas[0].estado, "pago");
  assert.equal(linha.celulas[1].pago, 0);
});

test("uma soma que não é múltiplo exacto da quota deixa crédito no mês seguinte", () => {
  // 205 € a 40 €/mês: cinco meses cheios e 5 € de crédito no sexto.
  const [linha] = matrizQuotas({
    fracoes: [fracaoG],
    pagamentos: [pagamento("fg", 205)],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-12-31",
  });
  const estados = linha.celulas.map((c) => c.estado);
  assert.deepEqual(estados.slice(0, 5), Array(5).fill("pago"));
  assert.equal(linha.celulas[5].pago, 5);
  assert.equal(linha.celulas[5].emFalta, 35);
  assert.equal(linha.mesesPagos, 5);
});

test("um adiantamento cobre um mês futuro mesmo antes de o calendário lá chegar", () => {
  // Pago o ano inteiro em Janeiro; hoje ainda é Fevereiro.
  const [linha] = matrizQuotas({
    fracoes: [fracaoG],
    pagamentos: [pagamento("fg", 480)],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-02-01",
  });
  assert.equal(linha.celulas[11].estado, "pago"); // Dezembro, já coberto
  assert.equal(linha.mesesPagos, 12);
});

test("um crédito parcial num mês futuro fica neutro, não em atraso", () => {
  // 60 € a 40 €/mês: Janeiro fica cheio, Fevereiro fica com 20 € a menos.
  // Hoje ainda estamos em Janeiro, por isso Fevereiro não pode estar em falta.
  const [linha] = matrizQuotas({
    fracoes: [fracaoG],
    pagamentos: [pagamento("fg", 60)],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-01-15",
  });
  assert.equal(linha.celulas[1].pago, 20);
  assert.equal(linha.celulas[1].estado, "futuro");
});

test("totais anuais por fração", () => {
  const [linha] = matrizQuotas({
    fracoes: [fracaoG],
    pagamentos: [pagamento("fg", 40), pagamento("fg", 40)],
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-12-31",
  });
  assert.equal(linha.totalDevido, 480); // 40 x 12
  assert.equal(linha.totalPago, 80);
  assert.equal(linha.totalEmFalta, 400);
});

/** A pagou 105 € (três meses); G pagou só 40 € (um mês). */
const PAGAMENTOS_MISTOS: PagamentoQuota[] = [
  pagamento("fa", 35),
  pagamento("fa", 35),
  pagamento("fa", 35),
  pagamento("fg", 40),
];

test("dentro do prazo do mês corrente, só G está em atraso", () => {
  const linhas = matrizQuotas({
    fracoes: [fracaoA, fracaoG],
    pagamentos: PAGAMENTOS_MISTOS,
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-04-05", // Abril ainda dentro do prazo para ambas
  });

  const atraso = fracoesEmAtraso(linhas);
  assert.equal(atraso.length, 1);
  assert.equal(atraso[0].fracao.letra, "G");

  // A cobriu Jan-Mar com os 105 €. G deve Fevereiro e Março; Abril ainda não conta.
  assert.equal(totalPorCobrar(linhas), 80);
});

test("passado o dia 8, o mês corrente entra na dívida de todos", () => {
  const linhas = matrizQuotas({
    fracoes: [fracaoA, fracaoG],
    pagamentos: PAGAMENTOS_MISTOS,
    ano: 2026,
    diaLimite: 8,
    hoje: "2026-04-09",
  });

  // Agora A também deve Abril.
  assert.deepEqual(
    fracoesEmAtraso(linhas).map((l) => l.fracao.letra),
    ["A", "G"],
  );

  // A deve 35 de Abril; G deve 40 de Fevereiro, Março e Abril.
  assert.equal(totalPorCobrar(linhas), 155);
});
