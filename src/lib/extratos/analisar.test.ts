import test from "node:test";
import assert from "node:assert/strict";
import {
  detectarMapeamento,
  impressaoDigital,
  lerData,
  lerNumero,
  linhasDeGrelha,
  normalizarTexto,
} from "./analisar.ts";

test("normalizarTexto tira acentos e maiúsculas", () => {
  assert.equal(normalizarTexto("DESCRIÇÃO"), "descricao");
  assert.equal(normalizarTexto("Importância"), "importancia");
  assert.equal(normalizarTexto("  Saldo   Contabilístico "), "saldo contabilistico");
});

test("lerNumero aceita o formato português", () => {
  assert.equal(lerNumero("1.234,56"), 1234.56);
  assert.equal(lerNumero("1 234,56"), 1234.56);
  assert.equal(lerNumero("45,60"), 45.6);
  assert.equal(lerNumero("-45,60"), -45.6);
  assert.equal(lerNumero("15,60 €"), 15.6);
  assert.equal(lerNumero("120"), 120);
});

test("lerNumero aceita parênteses como negativo", () => {
  assert.equal(lerNumero("(45,60)"), -45.6);
});

test("lerNumero desambigua ponto de milhares e ponto decimal", () => {
  assert.equal(lerNumero("1.234"), 1234); // milhares à portuguesa
  assert.equal(lerNumero("12.34"), 12.34); // decimal à inglesa
  assert.equal(lerNumero("1,234.56"), 1234.56); // inglês completo
});

test("lerNumero rejeita lixo", () => {
  assert.equal(lerNumero(""), null);
  assert.equal(lerNumero("   "), null);
  assert.equal(lerNumero("abc"), null);
});

test("lerData aceita os formatos dos bancos", () => {
  assert.equal(lerData("2026-01-28"), "2026-01-28");
  assert.equal(lerData("28-01-2026"), "2026-01-28");
  assert.equal(lerData("28/01/2026"), "2026-01-28");
  assert.equal(lerData("28.01.2026"), "2026-01-28");
  assert.equal(lerData("28/01/26"), "2026-01-28");
  assert.equal(lerData(new Date(Date.UTC(2026, 0, 28))), "2026-01-28");
});

test("lerData rejeita datas impossíveis", () => {
  assert.equal(lerData("31/02/2026"), null);
  assert.equal(lerData("32/01/2026"), null);
  assert.equal(lerData("abc"), null);
  assert.equal(lerData(null), null);
});

test("detecta cabeçalho com coluna única de importância", () => {
  const m = detectarMapeamento([
    "Data movimento",
    "Data valor",
    "Descrição",
    "Importância",
    "Saldo contabilístico",
  ]);
  assert.ok(m);
  assert.equal(m.dataMov, 0);
  assert.equal(m.dataValor, 1);
  assert.equal(m.descricao, 2);
  assert.equal(m.importancia, 3);
  assert.equal(m.saldo, 4);
});

test("detecta cabeçalho com débito e crédito separados", () => {
  const m = detectarMapeamento([
    "Data mov.",
    "Data valor",
    "Descrição",
    "Débito",
    "Crédito",
    "Saldo",
  ]);
  assert.ok(m);
  assert.equal(m.debito, 3);
  assert.equal(m.credito, 4);
  assert.equal(m.importancia, null);
});

test("'data' sozinha não rouba a coluna de 'data valor'", () => {
  const m = detectarMapeamento(["Data", "Data valor", "Descritivo", "Valor"]);
  assert.ok(m);
  assert.equal(m.dataMov, 0);
  assert.equal(m.dataValor, 1);
});

test("devolve null quando faltam colunas essenciais", () => {
  assert.equal(detectarMapeamento(["Titular", "Conta", "IBAN"]), null);
  assert.equal(detectarMapeamento(["Data", "Descrição"]), null);
});

test("converte uma grelha com coluna única de importância", () => {
  const grelha = [
    ["Extrato de conta"],
    ["Conta: 0079 0000 6858 8187 101 89"],
    [],
    ["Data movimento", "Data valor", "Descrição", "Importância", "Saldo"],
    ["08-01-2026", "08-01-2026", "SEGURO CONDOMINIO", "-497,99", "2.244,21"],
    ["02-01-2026", "02-01-2026", "TRF QUOTA JAN FRACCAO G", "35,00", "2.742,20"],
  ];

  const { linhas, cabecalhoEm } = linhasDeGrelha(grelha);
  assert.equal(cabecalhoEm, 3);
  assert.equal(linhas.length, 2);

  assert.equal(linhas[0].dataMov, "2026-01-08");
  assert.equal(linhas[0].descricao, "SEGURO CONDOMINIO");
  assert.equal(linhas[0].valor, -497.99);
  assert.equal(linhas[0].saldo, 2244.21);

  assert.equal(linhas[1].valor, 35);
});

test("converte uma grelha com débito e crédito separados", () => {
  const grelha = [
    ["Data mov.", "Descrição", "Débito", "Crédito", "Saldo"],
    ["08-01-2026", "COMISSAO MANUTENCAO CONTA", "15,60", "", "2.228,61"],
    ["02-01-2026", "TRF QUOTA JAN", "", "35,00", "2.742,20"],
  ];

  const { linhas } = linhasDeGrelha(grelha);
  assert.equal(linhas.length, 2);
  // O débito vem sem sinal na folha e sai negativo na leitura.
  assert.equal(linhas[0].valor, -15.6);
  assert.equal(linhas[1].valor, 35);
});

test("linhas sem data, sem descrição ou de valor zero são descartadas", () => {
  const grelha = [
    ["Data", "Descrição", "Importância"],
    ["08-01-2026", "BOM", "10,00"],
    ["", "SEM DATA", "10,00"],
    ["09-01-2026", "", "10,00"],
    ["10-01-2026", "VALOR ZERO", "0,00"],
    ["Totais", "", "10,00"],
  ];
  const { linhas } = linhasDeGrelha(grelha);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].descricao, "BOM");
});

test("aceita células já tipadas como número e data", () => {
  const grelha = [
    ["Data", "Descrição", "Importância"],
    [new Date(Date.UTC(2026, 0, 8)), "SEGURO", -497.99],
  ];
  const { linhas } = linhasDeGrelha(grelha);
  assert.equal(linhas[0].dataMov, "2026-01-08");
  assert.equal(linhas[0].valor, -497.99);
});

test("a impressão digital ignora maiúsculas e acentos da descrição", () => {
  const a = impressaoDigital("2026-01-08", "SEGURO CONDOMÍNIO", -497.99);
  const b = impressaoDigital("2026-01-08", "seguro condominio", -497.99);
  assert.equal(a, b);
});

test("a impressão digital distingue movimentos diferentes", () => {
  const base = impressaoDigital("2026-01-08", "SEGURO", -497.99);
  assert.notEqual(base, impressaoDigital("2026-01-09", "SEGURO", -497.99));
  assert.notEqual(base, impressaoDigital("2026-01-08", "AGUA", -497.99));
  assert.notEqual(base, impressaoDigital("2026-01-08", "SEGURO", -497.98));
});

test("erro claro quando o ficheiro não parece um extrato", () => {
  assert.throws(
    () => linhasDeGrelha([["a", "b"], ["1", "2"]]),
    /Não foi possível reconhecer as colunas/,
  );
});
