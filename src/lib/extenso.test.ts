import test from "node:test";
import assert from "node:assert/strict";
import { valorPorExtenso, valorPorExtensoMaiusculas } from "./extenso.ts";

test("valores que aparecem nos recibos de ASSETS", () => {
  const casos: Array<[number, string]> = [
    [5, "CINCO EUROS"],
    [35, "TRINTA E CINCO EUROS"],
    [40, "QUARENTA EUROS"],
    [120, "CENTO E VINTE EUROS"],
  ];
  for (const [valor, esperado] of casos) {
    assert.equal(valorPorExtensoMaiusculas(valor), esperado, `valor ${valor}`);
  }
});

test("ortografia europeia e não brasileira", () => {
  assert.equal(valorPorExtenso(14), "catorze euros");
  assert.equal(valorPorExtenso(16), "dezasseis euros");
  assert.equal(valorPorExtenso(17), "dezassete euros");
  assert.equal(valorPorExtenso(19), "dezanove euros");
});

test("centenas e a forma 'cem'", () => {
  assert.equal(valorPorExtenso(100), "cem euros");
  assert.equal(valorPorExtenso(101), "cento e um euros");
  assert.equal(valorPorExtenso(200), "duzentos euros");
});

test("ligação com 'e' entre milhares e resto", () => {
  assert.equal(valorPorExtenso(1000), "mil euros");
  assert.equal(valorPorExtenso(1500), "mil e quinhentos euros");
  assert.equal(valorPorExtenso(1050), "mil e cinquenta euros");
  assert.equal(valorPorExtenso(1234), "mil duzentos e trinta e quatro euros");
  assert.equal(valorPorExtenso(2000), "dois mil euros");
});

test("singular e plural de euro e cêntimo", () => {
  assert.equal(valorPorExtenso(1), "um euro");
  assert.equal(valorPorExtenso(2), "dois euros");
  assert.equal(valorPorExtenso(0.01), "um cêntimo");
  assert.equal(valorPorExtenso(0.02), "dois cêntimos");
  assert.equal(valorPorExtenso(1.5), "um euro e cinquenta cêntimos");
  assert.equal(valorPorExtenso(0), "zero euros");
});

test("absorve o ruído de vírgula flutuante das folhas de cálculo", () => {
  // A folha original guarda 102,11 como 102,10999999999999.
  assert.equal(
    valorPorExtenso(102.10999999999999),
    "cento e dois euros e onze cêntimos",
  );
  assert.equal(
    valorPorExtenso(553.72),
    "quinhentos e cinquenta e três euros e setenta e dois cêntimos",
  );
  assert.equal(
    valorPorExtenso(1738.69),
    "mil setecentos e trinta e oito euros e sessenta e nove cêntimos",
  );
});

test("rejeita valores fora do domínio", () => {
  assert.throws(() => valorPorExtenso(Number.NaN), RangeError);
  assert.throws(() => valorPorExtenso(Number.POSITIVE_INFINITY), RangeError);
});
