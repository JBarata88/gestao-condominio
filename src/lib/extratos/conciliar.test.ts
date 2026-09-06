import test from "node:test";
import assert from "node:assert/strict";
import { sugerir, type FracaoSimples, type RegraSimples } from "./conciliar.ts";

const FRACOES: FracaoSimples[] = [
  { id: "fa", letra: "A", condominoNome: "José Manuel dos Santos Rodrigues", quotaMensal: 35 },
  { id: "fg", letra: "G", condominoNome: "Raquel Nunes Martins", quotaMensal: 40 },
  { id: "fh", letra: "H", condominoNome: "João Carlos Palhares Barata", quotaMensal: 40 },
];

const REGRAS: RegraSimples[] = [
  { padrao: "comissao", categoriaId: "cat-banco", fracaoId: null, fornecedorId: null, prioridade: 10 },
  { padrao: "seguro", categoriaId: "cat-seguros", fracaoId: null, fornecedorId: null, prioridade: 20 },
  { padrao: "luz", categoriaId: "cat-luz", fracaoId: null, fornecedorId: null, prioridade: 20 },
  { padrao: "agua", categoriaId: "cat-agua", fracaoId: null, fornecedorId: null, prioridade: 20 },
];

function correr(descricao: string, valor: number, dataMov = "2026-03-10") {
  return sugerir({
    descricao,
    valor,
    dataMov,
    regras: REGRAS,
    fracoes: FRACOES,
    categoriaQuotasId: "cat-quotas",
  });
}

test("identifica uma quota pelo nome do condómino e valor exacto", () => {
  const s = correr("TRF RAQUEL NUNES MARTINS", 40);
  assert.equal(s.categoriaId, "cat-quotas");
  assert.equal(s.fracaoId, "fg");
  assert.ok(s.confianca >= 0.9);
});

test("identifica a fração pela menção explícita na descrição", () => {
  const s = correr("QUOTA JAN FRACCAO G", 40, "2026-03-10");
  assert.equal(s.fracaoId, "fg");
  assert.equal(s.categoriaId, "cat-quotas");
  // O mês vem da descrição, não da data do movimento.
  assert.equal(s.quotaMes, "2026-01-01");
});

test("aceita a grafia com cedilha e til", () => {
  const s = correr("QUOTA FEV FRACÇÃO H", 40);
  assert.equal(s.fracaoId, "fh");
  assert.equal(s.quotaMes, "2026-02-01");
});

test("sem mês na descrição, usa o mês do movimento", () => {
  const s = correr("TRANSFERENCIA RAQUEL NUNES MARTINS", 40, "2026-05-03");
  assert.equal(s.quotaMes, "2026-05-01");
});

test("baixa a confiança quando o valor não bate com a quota", () => {
  const s = correr("TRF RAQUEL NUNES MARTINS", 25);
  assert.equal(s.fracaoId, "fg");
  assert.ok(s.confianca < 0.8, "não deve vir pré-seleccionada");
});

test("um só apelido não chega para atribuir uma fração", () => {
  // "Martins" sozinho podia ser outra pessoa qualquer.
  const s = correr("TRF MARTINS", 40);
  assert.equal(s.fracaoId, null);
});

test("aplica as regras de texto às despesas", () => {
  assert.equal(correr("COMISSAO MANUTENCAO CONTA", -15.6).categoriaId, "cat-banco");
  assert.equal(correr("SEGURO CONDOMINIO", -497.99).categoriaId, "cat-seguros");
  assert.equal(correr("LUZ FEV 2026", -20.4).categoriaId, "cat-luz");
  assert.equal(correr("AGUA FEV 2026", -16.99).categoriaId, "cat-agua");
});

test("as regras ignoram acentos e maiúsculas", () => {
  assert.equal(correr("Comissão de manutenção", -15.6).categoriaId, "cat-banco");
});

test("a regra de menor prioridade numérica ganha", () => {
  // "comissao" tem prioridade 10 e "seguro" tem 20.
  const s = correr("COMISSAO SOBRE SEGURO", -5);
  assert.equal(s.categoriaId, "cat-banco");
});

test("sem correspondência devolve sugestão vazia", () => {
  const s = correr("PAGAMENTO DIVERSOS XPTO", -33.33);
  assert.equal(s.categoriaId, null);
  assert.equal(s.confianca, 0);
});

test("uma saída não é confundida com quota mesmo com nome de condómino", () => {
  const s = correr("TRF PARA RAQUEL NUNES MARTINS", -40);
  assert.notEqual(s.categoriaId, "cat-quotas");
});
