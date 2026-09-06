import test from "node:test";
import assert from "node:assert/strict";
import {
  ABERTURA_VAZIA,
  comSaldoAcumulado,
  construirMapa,
  noPeriodo,
  saldosApos,
  totalDisponibilidades,
  type MovimentoCalculo,
  type SaldosAbertura,
} from "./contas.ts";

const abertura: SaldosAbertura = {
  caixa: 1111.17,
  depositoOrdem: 2707.2,
  depositoPrazo: 0,
  contaPoupanca: 0,
};

function quota(data: string, valor: number, conta: "banco" | "caixa" = "banco"): MovimentoCalculo {
  return {
    data,
    conta,
    receita: valor,
    despesa: 0,
    categoria: "Quotizações",
    natureza: "receita",
    linhaMoaf: "Quotizações",
  };
}

function despesa(
  data: string,
  valor: number,
  categoria: string,
  conta: "banco" | "caixa" = "banco",
): MovimentoCalculo {
  return {
    data,
    conta,
    receita: 0,
    despesa: valor,
    categoria,
    natureza: "despesa",
    linhaMoaf: categoria,
  };
}

/** Um depósito bancário: sai de caixa, entra no banco. */
function deposito(data: string, valor: number): MovimentoCalculo[] {
  const base = {
    data,
    categoria: "Depósito Bancário",
    natureza: "transferencia" as const,
    linhaMoaf: null,
  };
  return [
    { ...base, conta: "caixa", receita: 0, despesa: valor },
    { ...base, conta: "banco", receita: valor, despesa: 0 },
  ];
}

test("saldos de abertura sem movimentos transitam inalterados", () => {
  const s = saldosApos([], abertura);
  assert.equal(s.caixa, 1111.17);
  assert.equal(s.depositoOrdem, 2707.2);
  assert.equal(s.total, 3818.37);
});

test("totalDisponibilidades soma as quatro contas", () => {
  assert.equal(totalDisponibilidades(abertura), 3818.37);
  assert.equal(totalDisponibilidades(ABERTURA_VAZIA), 0);
});

test("receitas e despesas movem a conta certa", () => {
  const movimentos = [
    quota("2026-01-02", 35),
    despesa("2026-01-08", 497.99, "Seguros"),
    despesa("2026-01-28", 18.43, "Agua", "caixa"),
  ];
  const s = saldosApos(movimentos, abertura);

  assert.equal(s.depositoOrdem, 2244.21); // 2707,20 + 35 - 497,99
  assert.equal(s.caixa, 1092.74); // 1111,17 - 18,43
});

test("a célula de controlo do mapa fecha sempre a zero", () => {
  const movimentos = [
    quota("2026-01-02", 35),
    quota("2026-02-10", 40),
    despesa("2026-01-08", 497.99, "Seguros"),
    despesa("2026-01-28", 18.43, "Agua", "caixa"),
    despesa("2026-03-30", 120, "Pagamentos a pessoal", "caixa"),
  ];

  const mapa = construirMapa(movimentos, abertura);

  assert.equal(
    mapa.controlo,
    0,
    "o mapa da folha original tinha 119,99 aqui em vez de zero",
  );
  assert.equal(mapa.origem.total, mapa.aplicacao.total);
});

test("o controlo fecha mesmo com transferências entre contas", () => {
  const movimentos = [
    quota("2026-01-02", 35),
    despesa("2026-01-08", 20, "Agua", "caixa"),
    ...deposito("2026-02-01", 500),
  ];

  const mapa = construirMapa(movimentos, abertura);
  assert.equal(mapa.controlo, 0);
});

test("uma transferência não é receita nem despesa, mas move os saldos", () => {
  const movimentos = deposito("2026-02-01", 500);
  const mapa = construirMapa(movimentos, abertura);

  assert.equal(mapa.origem.atual.subtotal, 0);
  assert.equal(mapa.aplicacao.despesas.subtotal, 0);

  assert.equal(mapa.aplicacao.disponibilidades.caixa, 611.17); // 1111,17 - 500
  assert.equal(mapa.aplicacao.disponibilidades.depositoOrdem, 3207.2);
  // O total disponível não muda: o dinheiro mudou de sítio, não desapareceu.
  assert.equal(mapa.aplicacao.disponibilidades.total, 3818.37);
  assert.equal(mapa.variacao, 0);
});

test("as despesas agrupam por linha do mapa", () => {
  const movimentos = [
    despesa("2026-01-01", 18.43, "Agua", "caixa"),
    despesa("2026-02-15", 16.99, "Agua"),
    despesa("2026-04-20", 13.78, "Agua"),
    despesa("2026-01-08", 497.99, "Seguros"),
  ];

  const mapa = construirMapa(movimentos, abertura);
  const porRotulo = new Map(
    mapa.aplicacao.despesas.linhas.map((l) => [l.rotulo, l.valor]),
  );

  assert.equal(porRotulo.get("Agua"), 49.2);
  assert.equal(porRotulo.get("Seguros"), 497.99);
  assert.equal(mapa.aplicacao.despesas.subtotal, 547.19);
});

test("os rótulos fixos aparecem a zero para o mapa manter a forma", () => {
  const mapa = construirMapa([], abertura, {
    despesas: ["Agua", "Correios", "Seguros"],
  });

  const rotulos = mapa.aplicacao.despesas.linhas.map((l) => l.rotulo);
  assert.deepEqual(rotulos, ["Agua", "Correios", "Seguros"]);
  assert.equal(mapa.aplicacao.despesas.subtotal, 0);
});

test("a variação das disponibilidades reflecte o resultado do período", () => {
  const movimentos = [quota("2026-01-02", 100), despesa("2026-01-08", 30, "Agua")];
  const mapa = construirMapa(movimentos, abertura);
  assert.equal(mapa.variacao, 70);
});

test("noPeriodo é inclusivo nos dois extremos", () => {
  const movimentos = [
    quota("2025-12-31", 10),
    quota("2026-01-01", 20),
    quota("2026-07-30", 30),
    quota("2026-07-31", 40),
  ];
  const dentro = noPeriodo(movimentos, "2026-01-01", "2026-07-30");
  assert.deepEqual(
    dentro.map((m) => m.receita),
    [20, 30],
  );
});

test("o saldo acumulado encadeia por conta e por ordem de data", () => {
  const movimentos = [
    despesa("2026-01-28", 18.43, "Agua", "caixa"),
    quota("2026-01-02", 35),
    despesa("2026-01-08", 497.99, "Seguros"),
  ];

  const linhas = comSaldoAcumulado(movimentos, abertura);

  assert.deepEqual(
    linhas.map((l) => l.data),
    ["2026-01-02", "2026-01-08", "2026-01-28"],
  );
  assert.equal(linhas[0].saldoBanco, 2742.2);
  assert.equal(linhas[1].saldoBanco, 2244.21);
  assert.equal(linhas[2].saldoCaixa, 1092.74);
  // A conta que não é tocada mantém o saldo anterior.
  assert.equal(linhas[1].saldoCaixa, 1111.17);
});

test("muitos movimentos pequenos não acumulam deriva", () => {
  // Cem linhas de 0,07 valem exactamente sete euros.
  const movimentos = Array.from({ length: 100 }, (_, i) =>
    quota(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`, 0.07),
  );
  const s = saldosApos(movimentos, ABERTURA_VAZIA);
  assert.equal(s.depositoOrdem, 7);
});
