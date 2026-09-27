import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  formatarPermilagem,
  frasePorExtensoDaData,
  gerarActa,
  gerarFolhaPresencas,
  MARCADOR_SEGUROS,
  partesDoComentario,
  partirAndar,
  temTabelaSeguros,
  type DadosActa,
} from "./acta.ts";

// Cabeçalho, tópicos e presentes da Acta nº 35 (ASSETS/Acta nº 35_2026.pdf),
// com permilagens de exemplo.
const ACTA_35: DadosActa = {
  numero: 35,
  data: "2026-01-18",
  horaInicio: "11.00",
  horaFim: "12,00",
  local:
    "na sala de reuniões de condóminos, no 5º piso do prédio em regime de " +
    "propriedade horizontal situado na Praceta Poetas da Povoa Nº4",
  topicos: [
    { titulo: "Assuntos de interesse geral;", decisao: null, comentario: "Primeiro parágrafo.\n\nSegundo parágrafo." },
    { titulo: "Aumento Quotas para 2026", decisao: "aprovado_unanimidade", comentario: "Valor passa a 40€." },
    { titulo: "Orçamento para 2026.", decisao: "reprovado", comentario: "" },
  ],
  presencas: [
    { andar: "1º DTO", letra: "A", nome: "José Manuel dos Santos Rodrigues", forma: "Procuração fração F", permilagem: 125 },
    { andar: "2º DTO", letra: "C", nome: "Paulo Jorge da Silva Rua", forma: "Presencial", permilagem: 125 },
    { andar: "4º DTO", letra: "G", nome: "Raquel Nunes Martins", forma: "Presencial", permilagem: 62.5 },
  ],
};

async function textoDoDocumento(dados: DadosActa): Promise<string> {
  const zip = await JSZip.loadAsync(await gerarActa(dados));
  const xml = await zip.file("word/document.xml")!.async("string");
  // Junta os <w:t> por ordem, que é o texto que o Word mostra.
  return [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("|");
}

test("o marcador parte o comentário no sítio da tabela de seguros", () => {
  const partes = partesDoComentario(
    `Antes da tabela.\n\n${MARCADOR_SEGUROS}\n\nDepois da tabela.`,
  );
  assert.deepEqual(partes, [
    { tipo: "texto", blocos: ["Antes da tabela."] },
    { tipo: "seguros" },
    { tipo: "texto", blocos: ["Depois da tabela."] },
  ]);
  assert.equal(temTabelaSeguros("  [Tabela de Apólices e Recibos]  "), true);
  assert.equal(temTabelaSeguros("sem tabela"), false);
});

test("a tabela de seguros entra no tópico, no lugar do marcador", async () => {
  const texto = await textoDoDocumento({
    ...ACTA_35,
    topicos: [
      {
        titulo: "Entrega de Cópias e recibos de Apólices de Seguro de Casa",
        decisao: null,
        comentario: `Falta a entrega das frações abaixo:\n\n${MARCADOR_SEGUROS}\n\nA administração vai notificar.`,
      },
    ],
    seguros: [
      { andar: "1º DTO", letra: "A", nome: "José Manuel dos Santos Rodrigues", apolice: false, recibo: false },
      { andar: "1º ESQ", letra: "B", nome: "Vitor Manuel Rocha Semedo", apolice: true, recibo: false },
      { andar: "2º DTO", letra: "C", nome: "Paulo Jorge da Silva Rua", apolice: true, recibo: true },
    ],
  });

  const ordem = ["Falta a entrega das frações abaixo:", "SEGURO", "RECIBO", "Vitor Manuel Rocha Semedo", "SIM", "Paulo Jorge da Silva Rua", "SIM", "SIM", "A administração vai notificar."];
  let desde = 0;
  for (const trecho of ordem) {
    const i = texto.indexOf(trecho, desde);
    assert.ok(i >= 0, `falta "${trecho}" depois da posição ${desde}`);
    desde = i + trecho.length;
  }
  assert.ok(!texto.includes(MARCADOR_SEGUROS), "o marcador não aparece no documento");
  // Três "SIM": o seguro da B e o seguro e o recibo da C.
  assert.equal((texto.match(/\bSIM\b/g) ?? []).length, 3);
});

test("a data da acta escreve-se por extenso como no original", () => {
  assert.equal(frasePorExtensoDaData("2026-01-18"), "Aos 18 dias do mês de janeiro de 2026");
  assert.equal(frasePorExtensoDaData("2026-03-01"), "Ao primeiro dia do mês de março de 2026");
});

test("permilagens sem zeros à direita e com vírgula", () => {
  assert.equal(formatarPermilagem(125), "125");
  assert.equal(formatarPermilagem(62.5), "62,5");
  assert.equal(formatarPermilagem(null), "—");
});

test("o andar parte-se nas duas colunas de ANDARES", () => {
  assert.deepEqual(partirAndar("1º DTO"), ["1º", "DTO"]);
  assert.deepEqual(partirAndar("R/C"), ["R/C", ""]);
});

test("o documento tem a estrutura da Acta 35", async () => {
  const texto = await textoDoDocumento(ACTA_35);

  const ordem = [
    "Ata n.º 35",
    "Aos 18 dias do mês de janeiro de 2026, pelas 11.00 horas, na sala de reuniões",
    "1.", "Assuntos de interesse geral;",
    "2.", "Aumento Quotas para 2026;",
    "Estiveram presentes os condóminos das seguintes frações:",
    "PERMILAGEM",
    "Procuração fração F",
    "62,5",
    "Verificada a presença",
    "Assuntos de interesse geral.",
    "Primeiro parágrafo.", "Segundo parágrafo.",
    "Colocado à votação, foi aprovado por unanimidade.",
    "Colocado à votação, foi reprovado.",
    "por volta das 12,00 horas",
    "ASSINATURA",
    "Por procuração",
  ];
  let desde = 0;
  for (const trecho of ordem) {
    const i = texto.indexOf(trecho, desde);
    assert.ok(i >= 0, `falta "${trecho}" depois da posição ${desde}`);
    desde = i + trecho.length;
  }

  // O tópico só informativo não leva frase de votação: há exactamente duas.
  assert.equal(texto.split("Colocado à votação").length - 1, 2);
});

test("a folha de presenças lista todas as frações com permilagem e assinatura", async () => {
  const zip = await JSZip.loadAsync(
    await gerarFolhaPresencas({
      data: "2026-01-18",
      fracoes: [
        { andar: "1º DTO", letra: "A", nome: "José Manuel dos Santos Rodrigues", permilagem: 125 },
        { andar: "1º ESQ", letra: "B", nome: "Vitor Manuel Rocha Semedo", permilagem: 120.5 },
        { andar: "2º DTO", letra: "C", nome: "Paulo Jorge da Silva Rua", permilagem: null },
      ],
    }),
  );
  const xml = await zip.file("word/document.xml")!.async("string");
  const texto = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("|");

  const ordem = [
    "Folha de presenças",
    "Assembleia de condóminos de 18 de janeiro de 2026",
    "PERMILAGEM", "ASSINATURA",
    "José Manuel dos Santos Rodrigues", "125",
    "Vitor Manuel Rocha Semedo", "120,5",
    "Paulo Jorge da Silva Rua", "—",
  ];
  let desde = 0;
  for (const trecho of ordem) {
    const i = texto.indexOf(trecho, desde);
    assert.ok(i >= 0, `falta "${trecho}" depois da posição ${desde}`);
    desde = i + trecho.length;
  }
});

test("as tabelas de presentes e a folha de presenças não têm linha de total", async () => {
  for (const ficheiro of [
    await gerarActa(ACTA_35),
    await gerarFolhaPresencas({ data: "2026-01-18", fracoes: [{ andar: "1º DTO", letra: "A", nome: "X", permilagem: 125 }] }),
  ]) {
    const xml = await (await JSZip.loadAsync(ficheiro)).file("word/document.xml")!.async("string");
    assert.ok(!/<w:t(?: [^>]*)?>TOTAL<\/w:t>/.test(xml), "não deve haver TOTAL");
  }
});
