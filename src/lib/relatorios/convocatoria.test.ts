import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { capitalizarMorada, dataDaConvocatoria, gerarConvocatorias } from "./convocatoria.ts";

test("a morada em maiúsculas passa a nome próprio", () => {
  assert.equal(capitalizarMorada("PRACETA POETAS DA POVOA, Nº 4"), "Praceta Poetas da Povoa, Nº 4");
  assert.equal(capitalizarMorada("PÓVOA DE SANTA IRIA"), "Póvoa de Santa Iria");
});

test("a data escreve-se como no original", () => {
  assert.equal(dataDaConvocatoria("2025-01-12"), "12 do mês de janeiro de 2025");
});

test("uma convocatória por condómino, com a ordem de trabalhos e a segunda convocação", async () => {
  const ficheiro = await gerarConvocatorias({
    data: "2025-01-12",
    hora: "11",
    dataSegunda: "2025-01-19",
    horaSegunda: "11",
    sala: "na sala de reuniões dos condóminos, no 5.º piso",
    morada: "PRACETA POETAS DA POVOA, Nº 4",
    codigoPostal: "2625-062",
    localidade: "PÓVOA DE SANTA IRIA",
    topicos: ["Assuntos de interesse geral;", "Orçamento para 2025"],
    destinatarios: [
      { nome: "José Manuel dos Santos Rodrigues", letra: "A", tratamento: "masculino" },
      { nome: "Raquel Nunes Martins", letra: "G", tratamento: "feminino" },
    ],
  });
  const xml = await (await JSZip.loadAsync(ficheiro)).file("word/document.xml")!.async("string");
  const texto = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("|");

  const ordem = [
    "CONVOCATÓRIA",
    "Exmo. Senhor: José Manuel dos Santos Rodrigues", "Fração: A",
    "fica V.Ex.ª convocado para a Assembleia de condóminos do prédio sito na Praceta Poetas da Povoa, Nº 4",
    "12 do mês de janeiro de 2025, pelas 11 horas",
    "1.\tAssuntos de interesse geral;", "2.\tOrçamento para 2025;",
    "Aguarda-se a sua comparência.",
    "2625-062 Póvoa de Santa Iria",
    "19 do mês de janeiro de 2025, pelas 11 horas",
    "CONVOCATÓRIA",
    "Exma. Senhora: Raquel Nunes Martins", "Fração: G",
    "fica V.Ex.ª convocada",
  ];
  let desde = 0;
  for (const trecho of ordem) {
    const i = texto.indexOf(trecho, desde);
    assert.ok(i >= 0, `falta "${trecho}" depois da posição ${desde}`);
    desde = i + trecho.length;
  }
  assert.equal((xml.match(/<w:br w:type="page"\/>/g) ?? []).length, 1, "uma quebra de página entre as duas");
});
