/**
 * Compara os recibos gerados com os ficheiros Word originais.
 *
 *   npx tsx scripts/verificar-recibos.ts
 *
 * Grava também os ficheiros gerados em "temporary screenshots/" para poderes
 * abri-los no Word e confirmar a formatação a olho.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

import { gerarRecibos } from "../src/lib/relatorios/recibos.ts";
import type { CabecalhoCondominio } from "../src/lib/relatorios/moaf.ts";

const CONDOMINIO: CabecalhoCondominio = {
  nome: "CONDOMINIO DO LOTE 1",
  nomeRecibos: "CONDOMÍNIO DO Nº 4 ",
  morada: "PRACETA POETAS DA POVOA Nº4",
  codigoPostal: "2625-062",
  localidade: "PÓVOA DE SANTA IRIA",
  nif: "900 986 190",
};

/** Extrai o texto de um .docx sem dependências externas. */
async function lerTextoDocx(caminho: string): Promise<string[]> {
  const dados = await readFile(caminho);
  const xml = extrairDoZip(dados, "word/document.xml");
  const paragrafos: string[] = [];
  for (const bloco of xml.split("<w:p")) {
    const textos = [...bloco.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(
      (m) => m[1],
    );
    if (textos.length === 0) continue;
    const linha = textos
      .join("")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    if (linha.trim()) paragrafos.push(linha);
  }
  return paragrafos;
}

/** Lê um ficheiro de dentro de um zip, procurando a entrada pelo nome. */
function extrairDoZip(dados: Buffer, alvo: string): string {
  // Percorrer os cabeçalhos locais do zip até encontrar a entrada pedida.
  let deslocamento = 0;
  while (deslocamento < dados.length - 4) {
    if (dados.readUInt32LE(deslocamento) !== 0x04034b50) break;

    const metodo = dados.readUInt16LE(deslocamento + 8);
    const tamanhoComprimido = dados.readUInt32LE(deslocamento + 18);
    const tamanhoNome = dados.readUInt16LE(deslocamento + 26);
    const tamanhoExtra = dados.readUInt16LE(deslocamento + 28);
    const inicioNome = deslocamento + 30;
    const nome = dados
      .subarray(inicioNome, inicioNome + tamanhoNome)
      .toString("utf8");
    const inicioDados = inicioNome + tamanhoNome + tamanhoExtra;
    const bruto = dados.subarray(inicioDados, inicioDados + tamanhoComprimido);

    if (nome === alvo) {
      // Método 0 é sem compressão; 8 é deflate cru, sem cabeçalho zlib.
      if (metodo === 0) return bruto.toString("utf8");
      return inflateRawSync(bruto).toString("utf8");
    }

    deslocamento = inicioDados + tamanhoComprimido;
  }
  throw new Error(`Entrada ${alvo} não encontrada no ficheiro.`);
}

function normalizar(s: string): string {
  // Uniformiza espaços, incluindo o espaço estreito que o Intl usa antes do €.
  return s.replace(/[\s  ]+/g, " ").trim();
}

async function main() {
  const saida = "temporary screenshots";
  mkdirSync(saida, { recursive: true });

  // --- Recibo de quota, igual ao primeiro de RECIBOS_AVULSO_2026.docx ------
  const quota = await gerarRecibos({
    condominio: CONDOMINIO,
    pedidos: [
      {
        tipo: "quota",
        condomino: {
          nome: "José Manuel dos Santos Rodrigues",
          letra: "A",
          andar: "1º DTO",
          tratamento: "masculino",
        },
        valor: 35,
        meses: [4],
        ano: 2026,
        data: "2026-04-30",
      },
    ],
  });
  writeFileSync(join(saida, "gerado-recibo-quota.docx"), quota);

  // --- Recibo de presença -------------------------------------------------
  const presenca = await gerarRecibos({
    condominio: CONDOMINIO,
    pedidos: [
      {
        tipo: "presenca",
        condomino: {
          nome: "José Manuel dos Santos Rodrigues",
          letra: "A",
          andar: "1º DTO",
          tratamento: "masculino",
        },
        valor: 5,
        dataAssembleia: "2025-01-18",
        data: "2026-01-31",
      },
    ],
  });
  writeFileSync(join(saida, "gerado-recibo-presenca.docx"), presenca);

  // --- Documento de caixa -------------------------------------------------
  const pagamento = await gerarRecibos({
    condominio: { ...CONDOMINIO, nomeRecibos: "CONDOMINIO DO LOTE 1" },
    pedidos: [
      {
        tipo: "pagamento",
        destinatario: "D. MARIA JOSÉ OLIVEIRA",
        valor: 120,
        servico: "SERVIÇOS DE LIMPEZA",
        periodo: "DEZEMBRO DE 2025",
        data: "2025-12-28",
      },
    ],
  });
  writeFileSync(join(saida, "gerado-recibo-pagamento.docx"), pagamento);

  const gerado = await lerTextoDocx(join(saida, "gerado-recibo-quota.docx"));
  const original = await lerTextoDocx("ASSETS/RECIBOS_AVULSO_2026.docx");

  console.log("--- Recibo de quota gerado ---");
  gerado.forEach((l) => console.log("  " + l));

  console.log("\n--- Primeiro recibo do ficheiro original ---");
  original.slice(0, 12).forEach((l) => console.log("  " + l));

  // Frases que têm de bater exactamente.
  const obrigatorias = [
    "Recebemos do condómino José Manuel dos Santos Rodrigues fracção A andar 1º DTO a quantia de TRINTA E CINCO EUROS.",
    "Póvoa de Santa Iria",
    "30 DE ABRIL DE 2026",
    "Euros: 35,00 €",
  ];

  console.log("\n--- Verificação ---");
  let falhas = 0;
  const geradoNorm = gerado.map(normalizar);
  for (const frase of obrigatorias) {
    const ok = geradoNorm.includes(normalizar(frase));
    if (!ok) falhas++;
    console.log(`${ok ? "ok   " : "FALHA"} ${frase}`);
  }

  const presencaTexto = (
    await lerTextoDocx(join(saida, "gerado-recibo-presenca.docx"))
  ).map(normalizar);
  const frasePresenca =
    "Eu abaixo assinado, José Manuel dos Santos Rodrigues fracção A andar 1º DTO declaro que recebi a quantia de CINCO EUROS, relativo à presença na assembleia de condóminos realizada no dia 18/01/2025.";
  const okPresenca = presencaTexto.includes(normalizar(frasePresenca));
  if (!okPresenca) falhas++;
  console.log(`${okPresenca ? "ok   " : "FALHA"} recibo de presença`);

  const pagamentoTexto = (
    await lerTextoDocx(join(saida, "gerado-recibo-pagamento.docx"))
  ).map(normalizar);
  const frasePagamento =
    "Pagamento a D. MARIA JOSÉ OLIVEIRA a quantia de CENTO E VINTE EUROS referente a SERVIÇOS DE LIMPEZA relativos a DEZEMBRO DE 2025.";
  const okPagamento = pagamentoTexto.includes(normalizar(frasePagamento));
  if (!okPagamento) falhas++;
  console.log(`${okPagamento ? "ok   " : "FALHA"} documento de caixa`);

  console.log(
    "\nDiferença deliberada: o ficheiro original escreve\n" +
      '  "Valor das quotas de ABRIL DE 2026." para um único mês neste recibo,\n' +
      '  mas "Valor da quota de MAIO DE 2026." noutro recibo igualmente de um mês.\n' +
      "  A aplicação usa sempre o singular para um mês e o plural para vários.",
  );

  console.log(
    falhas === 0
      ? "\nTodas as frases obrigatórias batem certo."
      : `\n${falhas} divergência(s).`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
