import test from "node:test";
import assert from "node:assert/strict";
import {
  arredondar,
  chaveMes,
  dataCurta,
  dataDeSerieExcel,
  dataPorExtenso,
  euros,
  mesPorExtenso,
  somar,
} from "./formatos.ts";

test("números de série do Excel batem com as datas das folhas", () => {
  // Pares retirados de CONTROLO GESTAO CONDOMINIO 2026.xlsx, folha DATA EXPORT.
  const casos: Array<[number, string]> = [
    [46023, "01/01/2026"], // AGUA, primeira linha do ano
    [46030, "08/01/2026"], // SEGURO CONDOMINIO
    [46203, "30/06/2026"], // Limpeza JUN 2026
    [46265, "31/08/2026"], // Limpeza AGO 2026, última linha
  ];
  for (const [serie, esperado] of casos) {
    assert.equal(dataCurta(dataDeSerieExcel(serie)), esperado, `série ${serie}`);
  }
});

test("arredondamento corrige o ruído das folhas", () => {
  assert.equal(arredondar(102.10999999999999), 102.11);
  assert.equal(arredondar(1738.6899999999998), 1738.69);
  assert.equal(arredondar(3251.9399999999987), 3251.94);
});

test("somar é exacto sobre os subtotais do mapa", () => {
  // Subtotais de despesa de 01/01 a 30/07 de 2026, com o ruído tal como está
  // gravado na folha. Nesta ordem a soma ingénua ainda calha certa.
  const subtotais = [102.10999999999999, 47.84, 53.17, 116.85, 840, 25, 553.72];
  assert.equal(somar(subtotais), 1738.69);
});

test("somar evita a deriva que a folha acumula linha a linha", () => {
  // O erro não aparece ao somar os sete subtotais, aparece ao somar as
  // dezenas de linhas individuais de despesa, que é o que a folha faz.
  const linhas = [
    18.43, 497.99, 15.6, 5, 5, 5, 5, 5, 120, 20.4, 120, 16.99, 116.85, 55.73,
    1.04, 13.78, 15.6, 16.29, 120, 17.08, 120, 16.54, 16.48, 120, 15.6, 19.29,
  ];

  assert.equal(somar(linhas), 1498.69);

  const ingenua = linhas.reduce((a, b) => a + b, 0);
  assert.notEqual(ingenua, 1498.69);
  assert.equal(arredondar(ingenua), 1498.69);
});

test("formatação de moeda em português europeu", () => {
  // O separador de milhares em pt-PT é um espaço estreito não separável.
  assert.match(euros(1234.5), /^1\s?234,50\s?€$/u);
  assert.match(euros(35), /^35,00\s?€$/u);
});

test("meses e datas por extenso como nos recibos", () => {
  assert.equal(mesPorExtenso(1), "JANEIRO");
  assert.equal(mesPorExtenso(12), "DEZEMBRO");
  assert.equal(dataPorExtenso("2026-04-30"), "30 DE ABRIL DE 2026");
  assert.equal(dataPorExtenso("2026-05-06"), "6 DE MAIO DE 2026");
  assert.throws(() => mesPorExtenso(13), RangeError);
});

test("chaveMes agrupa por ano e mês", () => {
  assert.equal(chaveMes("2026-01-28"), "2026-01");
  assert.equal(chaveMes("2026-12-01"), "2026-12");
});

test("datas ISO não deslizam por causa do fuso horário", () => {
  // Um Date local em fusos a oeste de Greenwich recuaria um dia.
  assert.equal(dataCurta("2026-01-01"), "01/01/2026");
  assert.equal(dataCurta("2026-12-31"), "31/12/2026");
});
