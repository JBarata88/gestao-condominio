/**
 * Verificação local do núcleo de cálculo contra a folha real.
 *
 * Lê ASSETS/CONTROLO GESTAO CONDOMINIO 2026.xlsx, constrói o mapa de origem e
 * aplicação de fundos a partir da folha "DATA EXPORT", e compara com os
 * totais da tabela dinâmica da folha "2026".
 *
 * Não é um teste automático porque depende de ficheiros com dados reais, que
 * estão fora do repositório. Correr com:  npx tsx scripts/verificar-mapa.ts
 */

import ExcelJS from "exceljs";
import { join } from "node:path";
import { construirMapa, type MovimentoCalculo } from "../src/lib/contas.ts";
import { arredondar } from "../src/lib/formatos.ts";
import type { NaturezaCategoria } from "../src/lib/tipos-bd.ts";

const FICHEIRO = join(
  process.cwd(),
  "ASSETS",
  "CONTROLO GESTAO CONDOMINIO 2026.xlsx",
);

/** Nome na folha -> categoria da aplicação. */
const CATEGORIAS: Record<string, { nome: string; natureza: NaturezaCategoria }> = {
  "Quotizações 2026": { nome: "Quotizações", natureza: "receita" },
  "Reforço Fundos Obras": { nome: "Reforço Fundos Obras", natureza: "receita" },
  Agua: { nome: "Agua", natureza: "despesa" },
  Correios: { nome: "Correios", natureza: "despesa" },
  Seguros: { nome: "Seguros", natureza: "despesa" },
  "Despesas bancárias": { nome: "Despesas bancárias", natureza: "despesa" },
  Electricidade: { nome: "Electricidade", natureza: "despesa" },
  "Ferramentas e utensilios": {
    nome: "Ferramentas e utensílios",
    natureza: "despesa",
  },
  "Materiais de limpeza": { nome: "Materiais de limpeza", natureza: "despesa" },
  "Obras e reparações": { nome: "Obras e reparações", natureza: "despesa" },
  Papelaria: { nome: "Papelaria", natureza: "despesa" },
  "Pagamentos a pessoal": { nome: "Pagamentos a pessoal", natureza: "despesa" },
  "Presença Reunião": { nome: "Presença Reunião", natureza: "despesa" },
  "Desposito Bancario": {
    nome: "Depósito Bancário",
    natureza: "transferencia",
  },
};

/** Totais da tabela dinâmica da folha "2026", colunas N a P. */
const ESPERADO_DESPESA: Record<string, number> = {
  Agua: 102.11,
  "Despesas bancárias": 47.84,
  Electricidade: 53.17,
  "Obras e reparações": 116.85,
  "Pagamentos a pessoal": 840,
  "Presença Reunião": 25,
  Seguros: 553.72,
};
const ESPERADO_DESPESA_TOTAL = 1738.69;

/**
 * 1565 e não 1445.
 *
 * A célula G23 da folha "2026" mostra 1445, vindo da tabela dinâmica. Mas a
 * soma directa das linhas de DATA EXPORT dá 1565, e a própria tabela dinâmica
 * arruma 120 € numa linha "(blank)", sinal de que a cache foi construída antes
 * de essas linhas terem categoria atribuída.
 *
 * Os saldos que a folha calcula pelas fórmulas mensais confirmam o 1565:
 *   3818,37 de abertura + 1565 - 1738,69 = 3644,68
 *   e a folha tem 392,74 de caixa + 3251,94 de banco = 3644,68.
 *
 * É exactamente esta diferença de 120 € que aparece na célula de controlo da
 * folha como 119,99999999999909. Ou seja, o erro do mapa original não vem das
 * disponibilidades escritas à mão, vem da tabela dinâmica desactualizada.
 */
const ESPERADO_QUOTIZACOES = 1565;

/**
 * O ExcelJS já converte a coluna de datas em Date, porque a célula tem
 * formato de data. O número de série só aparece em células sem formato.
 */
function comoData(valor: unknown): string | null {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "number" && valor > 0) {
    return new Date(Date.UTC(1899, 11, 30) + valor * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  return null;
}

function numero(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (valor && typeof valor === "object" && "result" in valor) {
    const r = (valor as { result?: unknown }).result;
    return typeof r === "number" ? r : 0;
  }
  return 0;
}

function texto(valor: unknown): string {
  if (typeof valor === "string") return valor.trim();
  if (valor && typeof valor === "object" && "richText" in valor) {
    const rt = (valor as { richText?: Array<{ text: string }> }).richText ?? [];
    return rt.map((p) => p.text).join("").trim();
  }
  return "";
}

async function main() {
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.readFile(FICHEIRO);

  const folha = livro.getWorksheet("DATA EXPORT");
  if (!folha) throw new Error('Folha "DATA EXPORT" não encontrada.');

  const movimentos: MovimentoCalculo[] = [];
  const semCategoria: number[] = [];
  let ignoradas = 0;

  folha.eachRow((linha, numeroLinha) => {
    if (numeroLinha === 1) return; // cabeçalho

    const data = comoData(linha.getCell(1).value);
    if (!data) return;

    const nomeCategoria = texto(linha.getCell(3).value);
    const mbReceita = arredondar(numero(linha.getCell(5).value));
    const mbDespesa = arredondar(numero(linha.getCell(6).value));
    const cxReceita = arredondar(numero(linha.getCell(7).value));
    const cxDespesa = arredondar(numero(linha.getCell(8).value));

    if (!mbReceita && !mbDespesa && !cxReceita && !cxDespesa) {
      ignoradas++;
      return;
    }

    const cat = CATEGORIAS[nomeCategoria];
    if (!cat) {
      semCategoria.push(numeroLinha);
      return;
    }

    const base = {
      data,
      categoria: cat.nome,
      natureza: cat.natureza,
      linhaMoaf: cat.natureza === "transferencia" ? null : cat.nome,
    };

    // Uma linha da folha podia carregar valores de banco e de caixa ao mesmo
    // tempo. Aqui cada movimento pertence a uma só conta.
    if (mbReceita || mbDespesa) {
      movimentos.push({
        ...base,
        conta: "banco",
        receita: mbReceita,
        despesa: mbDespesa,
      });
    }
    if (cxReceita || cxDespesa) {
      movimentos.push({
        ...base,
        conta: "caixa",
        receita: cxReceita,
        despesa: cxDespesa,
      });
    }
  });

  console.log(`Linhas convertidas em ${movimentos.length} movimentos.`);
  console.log(`Linhas sem valores, ignoradas: ${ignoradas}`);
  if (semCategoria.length) {
    console.log(
      `Linhas sem categoria reconhecida: ${semCategoria.join(", ")}`,
    );
  }

  const abertura = {
    caixa: 1111.17,
    depositoOrdem: 2707.2,
    depositoPrazo: 0,
    contaPoupanca: 0,
  };

  const mapa = construirMapa(movimentos, abertura);

  console.log("\n--- Despesas por categoria ---");
  let falhas = 0;
  for (const [rotulo, esperado] of Object.entries(ESPERADO_DESPESA)) {
    const obtido =
      mapa.aplicacao.despesas.linhas.find((l) => l.rotulo === rotulo)?.valor ?? 0;
    const ok = obtido === esperado;
    if (!ok) falhas++;
    console.log(
      `${ok ? "ok   " : "FALHA"} ${rotulo.padEnd(24)} ${String(obtido).padStart(10)}  (folha: ${esperado})`,
    );
  }

  console.log("\n--- Totais ---");
  const verificar = (nome: string, obtido: number, esperado: number) => {
    const ok = obtido === esperado;
    if (!ok) falhas++;
    console.log(
      `${ok ? "ok   " : "FALHA"} ${nome.padEnd(24)} ${String(obtido).padStart(10)}  (folha: ${esperado})`,
    );
  };

  verificar(
    "Subtotal despesas",
    mapa.aplicacao.despesas.subtotal,
    ESPERADO_DESPESA_TOTAL,
  );

  const quotizacoes =
    mapa.origem.atual.linhas.find((l) => l.rotulo === "Quotizações")?.valor ?? 0;
  verificar("Quotizações", quotizacoes, ESPERADO_QUOTIZACOES);

  console.log("\n--- Célula de controlo ---");
  verificar("Controlo", mapa.controlo, 0);
  console.log(
    "       A folha tem 119,99999999999909 nesta célula, que são os 120 € que\n" +
      "       a tabela dinâmica desactualizada não conta nas quotizações.",
  );

  console.log("\n--- Disponibilidades finais ---");
  console.log(`  Caixa            ${mapa.aplicacao.disponibilidades.caixa}`);
  console.log(
    `  Depósitos à ordem ${mapa.aplicacao.disponibilidades.depositoOrdem}`,
  );
  console.log(`  Total            ${mapa.aplicacao.disponibilidades.total}`);
  console.log(`  Variação         ${mapa.variacao}`);

  console.log(
    falhas === 0
      ? "\nTudo bate certo com a folha."
      : `\n${falhas} divergência(s) face à folha.`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
