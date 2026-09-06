/**
 * Corre o leitor de extratos contra um ficheiro real, sem gravar nada.
 *
 *   npx tsx scripts/testar-extrato.ts "C:\\caminho\\para\\extrato.csv"
 *
 * Mostra as colunas reconhecidas, as linhas lidas e a categoria e fração que
 * a conciliação sugeriria. Serve para calibrar antes de importar a sério.
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { lerExtrato } from "../src/lib/extratos/ler-ficheiro.ts";
import { sugerir, type FracaoSimples, type RegraSimples } from "../src/lib/extratos/conciliar.ts";
import { euros } from "../src/lib/formatos.ts";

// Espelha os dados semeados, para o teste correr sem tocar na base de dados.
const FRACOES: FracaoSimples[] = [
  { id: "A", letra: "A", condominoNome: "José Manuel dos Santos Rodrigues", quotaMensal: 35 },
  { id: "B", letra: "B", condominoNome: "Vitor Manuel Rocha Semedo", quotaMensal: 40 },
  { id: "C", letra: "C", condominoNome: "Paulo Jorge da Silva Rua", quotaMensal: 40 },
  { id: "D", letra: "D", condominoNome: "Fernando Jorge Lopes Martins", quotaMensal: 40 },
  { id: "E", letra: "E", condominoNome: "João Pedro Henriques Oliveira", quotaMensal: 40 },
  { id: "F", letra: "F", condominoNome: "Carlos Manuel Gralha Baptista", quotaMensal: 40 },
  { id: "G", letra: "G", condominoNome: "Raquel Nunes Martins", quotaMensal: 40 },
  { id: "H", letra: "H", condominoNome: "João Carlos Palhares Barata", quotaMensal: 40 },
];

const REGRAS: RegraSimples[] = [
  ["comiss", "Despesas bancárias", 10],
  ["manutencao conta", "Despesas bancárias", 10],
  ["manutencao de conta", "Despesas bancárias", 10],
  ["despesas bancarias", "Despesas bancárias", 10],
  ["imposto de selo", "Despesas bancárias", 10],
  ["imp. selo", "Despesas bancárias", 10],
  ["imp.selo", "Despesas bancárias", 10],
  ["seguro", "Seguros", 20],
  ["luz", "Electricidade", 20],
  ["edp", "Electricidade", 20],
  ["electricidade", "Electricidade", 20],
  ["eletricidade", "Electricidade", 20],
  ["agua", "Agua", 20],
  ["smas", "Agua", 20],
  ["saneamento", "Agua", 20],
  ["telhado", "Obras e reparações", 25],
  ["limpeza", "Pagamentos a pessoal", 30],
  ["quota", "Quotizações", 40],
].map(([padrao, categoria, prioridade]) => ({
  padrao: padrao as string,
  categoriaId: categoria as string,
  fracaoId: null,
  fornecedorId: null,
  prioridade: prioridade as number,
}));

async function main() {
  const caminho = process.argv[2];
  if (!caminho) {
    console.error("Indica o caminho do ficheiro do extrato.");
    process.exit(1);
  }

  const dados = await readFile(caminho);
  const leitura = await lerExtrato(
    dados.buffer.slice(
      dados.byteOffset,
      dados.byteOffset + dados.byteLength,
    ) as ArrayBuffer,
    basename(caminho),
  );

  console.log(`Formato: ${leitura.formato}`);
  if (leitura.aviso) console.log(`Aviso: ${leitura.aviso}`);
  console.log(`Colunas reconhecidas: ${JSON.stringify(leitura.mapeamento)}`);
  console.log(`Linhas lidas: ${leitura.linhas.length}\n`);

  let semCategoria = 0;
  let quotasIdentificadas = 0;

  console.log(
    "DATA        VALOR        CATEGORIA              FR  DESCRIÇÃO",
  );
  console.log("-".repeat(100));

  for (const linha of leitura.linhas) {
    const s = sugerir({
      descricao: linha.descricao,
      valor: linha.valor,
      dataMov: linha.dataMov,
      regras: REGRAS,
      fracoes: FRACOES,
      categoriaQuotasId: "Quotizações",
    });

    if (!s.categoriaId) semCategoria++;
    if (s.fracaoId) quotasIdentificadas++;

    console.log(
      [
        linha.dataMov,
        euros(linha.valor).padStart(11),
        (s.categoriaId ?? "— por classificar").padEnd(22),
        (s.fracaoId ?? "—").padEnd(3),
        linha.descricao.slice(0, 44),
      ].join(" "),
    );
  }

  const entradas = leitura.linhas.filter((l) => l.valor > 0);
  const saidas = leitura.linhas.filter((l) => l.valor < 0);

  console.log("\n" + "-".repeat(100));
  console.log(`Entradas: ${entradas.length} linhas`);
  console.log(`Saídas:   ${saidas.length} linhas`);
  console.log(`Quotas com fração identificada: ${quotasIdentificadas}`);
  console.log(`Por classificar à mão: ${semCategoria}`);

  // As impressões digitais têm de ser todas diferentes, senão o índice único
  // da base de dados recusa a importação e perdem-se movimentos.
  const impressoes = leitura.linhas.map((l) => l.impressaoDigital);
  const unicas = new Set(impressoes);
  if (unicas.size === impressoes.length) {
    console.log(`Impressões digitais: ${unicas.size} distintas, todas únicas.`);
  } else {
    const repetidas = impressoes.filter(
      (v, i) => impressoes.indexOf(v) !== i,
    );
    console.log(
      `ATENÇÃO: ${impressoes.length - unicas.size} impressão(ões) repetida(s): ${[
        ...new Set(repetidas),
      ].join(", ")}`,
    );
  }

  // Conferir contra a coluna de saldo do próprio banco, se existir.
  const comSaldo = leitura.linhas.filter((l) => l.saldo !== null);
  if (comSaldo.length >= 2) {
    const primeira = comSaldo[0];
    const ultima = comSaldo[comSaldo.length - 1];
    const variacao =
      Math.round((ultima.saldo! - primeira.saldo!) * 100) / 100;
    const somaMovimentos =
      comSaldo
        .slice(1)
        .reduce((t, l) => t + Math.round(l.valor * 100), 0) / 100;

    console.log(
      `\nSaldo do banco: ${euros(primeira.saldo!)} -> ${euros(ultima.saldo!)}`,
    );
    console.log(`  variação segundo o banco:      ${euros(variacao)}`);
    console.log(`  soma dos movimentos lidos:     ${euros(somaMovimentos)}`);
    console.log(
      variacao === somaMovimentos
        ? "  ok: nenhum movimento se perdeu na leitura."
        : "  ATENÇÃO: os valores não batem, há linhas em falta ou a mais.",
    );
  }
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
