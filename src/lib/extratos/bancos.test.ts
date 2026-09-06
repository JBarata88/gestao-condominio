/**
 * Formatos de extrato de bancos concretos.
 *
 * Cada caso aqui nasceu de um ficheiro real que a aplicação não conseguiu ler.
 * Os cabeçalhos são os verdadeiros; os nomes e valores das linhas são
 * inventados, porque este repositório é público.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { detectarMapeamento, linhasDeGrelha } from "./analisar.ts";

test("cabeçalho com datas abreviadas em D.", () => {
  // O banco escreve "D. OPERAÇÃO" onde outros escrevem "Data operação".
  const m = detectarMapeamento([
    "D. VALOR",
    "D. CONTABILÍSTICA",
    "D. OPERAÇÃO",
    "TIPO OPERAÇÃO",
    "DESCRIÇÃO",
    "REFERÊNCIA",
    "MONTANTE",
    "SALDO",
    "MOEDA",
  ]);

  assert.ok(m, "o cabeçalho tem de ser reconhecido");
  // A data do movimento é a da operação, não a data-valor.
  assert.equal(m.dataMov, 2);
  assert.equal(m.dataValor, 0);
  assert.equal(m.descricao, 4);
  assert.equal(m.importancia, 6);
  assert.equal(m.saldo, 7);
});

test("extrato completo com preâmbulo antes do cabeçalho", () => {
  const grelha = [
    ["PT50000000000000000000000"],
    ["", "", "", "", "", "", "", "", ""],
    ["CONSULTAR POR::", "Data operação", "", "", "", "", "", "", ""],
    ["PERÍODO:", "2025-10-01 - 2026-09-30", "", "", "", "", "", "", ""],
    ["TIPO OPERAÇÃO:", "Todas", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", ""],
    [
      "D. VALOR",
      "D. CONTABILÍSTICA",
      "D. OPERAÇÃO",
      "TIPO OPERAÇÃO",
      "DESCRIÇÃO",
      "REFERÊNCIA",
      "MONTANTE",
      "SALDO",
      "MOEDA",
    ],
    [
      "2026-01-08",
      "2026-01-08",
      "2026-01-08",
      "RECIBOS VÁRIOS",
      "DD.COMPANHIA DE SEGUROS EXEMPLO.BBPI",
      "00000000000",
      "-497,99",
      "2 244,21",
      "EUR",
    ],
    [
      "2026-01-29",
      "2026-01-29",
      "2026-01-29",
      "TRANSFERÊNCIAS DE OUTRAS ENTIDADES",
      "SEPA DE NOME EXEMPLO",
      "",
      "40,00",
      "2 343,61",
      "EUR",
    ],
  ];

  const { linhas, cabecalhoEm } = linhasDeGrelha(grelha);

  assert.equal(cabecalhoEm, 6, "o cabeçalho está na sétima linha");
  assert.equal(linhas.length, 2);

  assert.equal(linhas[0].dataMov, "2026-01-08");
  assert.equal(linhas[0].valor, -497.99);
  // O saldo vem com espaço não separável como separador de milhares.
  assert.equal(linhas[0].saldo, 2244.21);

  assert.equal(linhas[1].valor, 40);
  assert.equal(linhas[1].saldo, 2343.61);
});

test("data-valor e data-operação diferentes escolhem a da operação", () => {
  const grelha = [
    ["D. VALOR", "D. OPERAÇÃO", "DESCRIÇÃO", "MONTANTE"],
    ["2026-03-30", "2026-03-28", "MANUTENCAO TELHADO", "-116,85"],
  ];
  const { linhas } = linhasDeGrelha(grelha);
  assert.equal(linhas[0].dataMov, "2026-03-28");
  assert.equal(linhas[0].dataValor, "2026-03-30");
});

test("dois movimentos idênticos no mesmo dia são linhas distintas", () => {
  // Caso real: o mesmo condómino transferiu duas vezes 40 € no mesmo dia.
  // Mesma data, mesma descrição, mesmo valor. Se a impressão digital não os
  // distinguir, o segundo é tomado por repetido e nunca chega a ser gravado.
  const grelha = [
    ["D. OPERAÇÃO", "DESCRIÇÃO", "MONTANTE", "SALDO"],
    ["2026-02-02", "NOME EXEMPLO", "40,00", "2 383,61"],
    ["2026-02-02", "NOME EXEMPLO", "40,00", "2 423,61"],
  ];

  const { linhas } = linhasDeGrelha(grelha);

  assert.equal(linhas.length, 2, "as duas linhas têm de sobreviver");
  assert.notEqual(
    linhas[0].impressaoDigital,
    linhas[1].impressaoDigital,
    "impressões digitais iguais fariam o segundo pagamento desaparecer",
  );
});

test("reimportar o mesmo ficheiro dá as mesmas impressões digitais", () => {
  // A distinção entre movimentos repetidos não pode custar a detecção de
  // ficheiros importados duas vezes.
  const grelha = [
    ["D. OPERAÇÃO", "DESCRIÇÃO", "MONTANTE"],
    ["2026-02-02", "NOME EXEMPLO", "40,00"],
    ["2026-02-02", "NOME EXEMPLO", "40,00"],
    ["2026-02-03", "OUTRO NOME", "35,00"],
  ];

  const primeira = linhasDeGrelha(grelha).linhas.map((l) => l.impressaoDigital);
  const segunda = linhasDeGrelha(grelha).linhas.map((l) => l.impressaoDigital);

  assert.deepEqual(primeira, segunda);
  assert.equal(new Set(primeira).size, 3, "as três têm de ser distintas");
});

test("cabeçalho sem nome reconhecível mas com datas nas células", () => {
  // Último recurso: se nenhuma coluna se chamar "data", procura-se uma cujos
  // valores sejam datas.
  const grelha = [
    ["Coluna 1", "Coluna 2", "Coluna 3"],
    ["2026-01-08", "PAGAMENTO EXEMPLO", "-10,00"],
    ["2026-01-09", "OUTRO PAGAMENTO", "-20,00"],
  ];
  const { linhas } = linhasDeGrelha(grelha);
  assert.equal(linhas.length, 2);
  assert.equal(linhas[0].dataMov, "2026-01-08");
  assert.equal(linhas[0].valor, -10);
});
