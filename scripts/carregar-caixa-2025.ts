/**
 * Importa os movimentos de caixa de 2025 a partir das 12 folhas mensais
 * "DOCUMENTOS DE CAIXA" em ASSETS/2025/CX2025MM.xlsx.
 *
 * Cada folha é um livro de caixa manuscrito: uma linha "TRANSPORTE" com o
 * saldo transportado do mês anterior (que corresponde ao saldo de abertura já
 * gravado em saldos_iniciais, por isso é ignorada) e uma linha "A TRANSPORTAR"
 * no fim com os totais acumulados (também ignorada, é só um subtotal).
 *
 *   npx tsx scripts/carregar-caixa-2025.ts            (só mostra o que faria)
 *   npx tsx scripts/carregar-caixa-2025.ts --gravar   (grava mesmo)
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const GRAVAR = process.argv.includes("--gravar");
const RAIZ = process.cwd();
const ANO = 2025;

function carregarAmbiente() {
  const caminho = join(RAIZ, ".env.local");
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(linha);
    if (!m) continue;
    const valor = m[2].trim().replace(/^["']|["']$/g, "");
    if (valor && !process.env[m[1]]) process.env[m[1]] = valor;
  }
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v) {
    const r = (v as { result?: unknown }).result;
    return typeof r === "number" ? r : 0;
  }
  return 0;
}

function txt(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v && typeof v === "object" && "richText" in v) {
    return ((v as { richText?: { text: string }[] }).richText ?? [])
      .map((p) => p.text)
      .join("")
      .trim();
  }
  return v == null ? "" : String(v).trim();
}

function comoData(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
}

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

const MESES: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, MAIO: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};
const PADRAO_MES = /\b(MAIO|JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b/gi;
const PADRAO_FRACAO = /FRAC[ÇC][ÃA]O\s+([A-H])\b/i;

/** Nomes de categoria, tal como existem na tabela categorias. */
const CATEGORIAS = {
  QUOTIZACOES: "Quotizações",
  REFORCO_OBRAS: "Reforço Fundos Obras",
  REUNIAO: "Presença Reunião",
  AGUA: "Agua",
  ELECTRICIDADE: "Electricidade",
  SEGUROS: "Seguros",
  PESSOAL: "Pagamentos a pessoal",
  DEPOSITO: "Depósito Bancário",
  PAPELARIA: "Papelaria",
  FERRAMENTAS: "Ferramentas e utensílios",
} as const;

type Classificacao = {
  categoriaNome: string;
  fracaoLetra: string | null;
  quotaMesIni: number | null;
  quotaMesFim: number | null;
  confianca: "alta" | "duvidosa";
};

function classificar(descricao: string): Classificacao {
  const d = descricao.toUpperCase();
  const mFracao = PADRAO_FRACAO.exec(d);
  const fracaoLetra = mFracao ? mFracao[1] : null;

  const meses = [...d.matchAll(PADRAO_MES)].map((m) => MESES[m[1].toUpperCase()]);
  const quotaMesIni = meses.length > 0 ? meses[0] : null;
  const quotaMesFim =
    meses.length > 1 && meses[meses.length - 1] !== quotaMesIni
      ? meses[meses.length - 1]
      : null;

  if (/QUOTA/.test(d)) {
    return { categoriaNome: CATEGORIAS.QUOTIZACOES, fracaoLetra, quotaMesIni, quotaMesFim, confianca: "alta" };
  }
  if (/REFOR[ÇC]O.*OBRAS/.test(d)) {
    return { categoriaNome: CATEGORIAS.REFORCO_OBRAS, fracaoLetra, quotaMesIni: null, quotaMesFim: null, confianca: "alta" };
  }
  if (/REUNI[ÃA]O/.test(d)) {
    return { categoriaNome: CATEGORIAS.REUNIAO, fracaoLetra, quotaMesIni: null, quotaMesFim: null, confianca: "alta" };
  }
  if (/AGUA/.test(d)) {
    return { categoriaNome: CATEGORIAS.AGUA, fracaoLetra: null, quotaMesIni: null, quotaMesFim: null, confianca: "alta" };
  }
  if (/ELE[CT]?TRICIDADE/.test(d)) {
    return { categoriaNome: CATEGORIAS.ELECTRICIDADE, fracaoLetra: null, quotaMesIni: null, quotaMesFim: null, confianca: "alta" };
  }
  if (/SEGURO/.test(d)) {
    return { categoriaNome: CATEGORIAS.SEGUROS, fracaoLetra: null, quotaMesIni: null, quotaMesFim: null, confianca: "alta" };
  }
  if (/LIMPEZA/.test(d)) {
    return { categoriaNome: CATEGORIAS.PESSOAL, fracaoLetra: null, quotaMesIni: null, quotaMesFim: null, confianca: "alta" };
  }
  if (/TRANSFER[ÊE]NCIA/.test(d)) {
    return { categoriaNome: CATEGORIAS.DEPOSITO, fracaoLetra: null, quotaMesIni: null, quotaMesFim: null, confianca: "alta" };
  }
  if (/TINTEIRO/.test(d)) {
    return { categoriaNome: CATEGORIAS.PAPELARIA, fracaoLetra: null, quotaMesIni: null, quotaMesFim: null, confianca: "alta" };
  }
  // Compras avulsas de ferramentaria (lâmpadas, botões de escada, etc.):
  // categoria plausível, mas sem palavra-chave inequívoca. Fica marcada como
  // duvidosa para revisão antes de gravar.
  return { categoriaNome: CATEGORIAS.FERRAMENTAS, fracaoLetra: null, quotaMesIni: null, quotaMesFim: null, confianca: "duvidosa" };
}

type Linha = {
  ficheiro: string;
  data: string;
  doc: string;
  descricao: string;
  receita: number;
  despesa: number;
  classificacao: Classificacao;
};

async function lerFicheiro(mes: number): Promise<Linha[]> {
  const nome = `CX2025${String(mes).padStart(2, "0")}.xlsx`;
  const caminho = join(RAIZ, "ASSETS", "2025", nome);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const ws = wb.worksheets[0];

  const linhas: Linha[] = [];
  ws.eachRow((linha) => {
    const data = comoData(linha.getCell(1).value);
    if (!data) return; // ignora TRANSPORTE / A TRANSPORTAR / cabeçalhos

    const doc = txt(linha.getCell(2).value);
    const descricao = txt(linha.getCell(3).value);
    const receita = arredondar(num(linha.getCell(4).value));
    const despesa = arredondar(num(linha.getCell(5).value));
    if (!receita && !despesa) return;
    if (!descricao) return;

    linhas.push({ ficheiro: nome, data, doc, descricao, receita, despesa, classificacao: classificar(descricao) });
  });
  return linhas;
}

async function main() {
  carregarAmbiente();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (GRAVAR && (!url || !chave)) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  }
  const supabase = url && chave ? createClient(url, chave, { auth: { persistSession: false } }) : null;

  console.log(GRAVAR ? "MODO GRAVAÇÃO\n" : "SIMULAÇÃO (usa --gravar para gravar)\n");

  const todasAsLinhas: Linha[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    todasAsLinhas.push(...(await lerFicheiro(mes)));
  }

  // --- Categorias e frações reais, para resolver nome -> id ----------------
  let idCategoria = new Map<string, string>();
  let idFracao = new Map<string, string>();
  if (supabase) {
    const { data: categorias } = await supabase.from("categorias").select("id, nome");
    const { data: fracoes } = await supabase.from("fracoes").select("id, letra");
    idCategoria = new Map((categorias ?? []).map((c) => [c.nome, c.id as string]));
    idFracao = new Map((fracoes ?? []).map((f) => [f.letra, f.id as string]));
  }

  // --- Relatório -------------------------------------------------------------
  let receitaTotal = 0;
  let despesaTotal = 0;
  const duvidosas: Linha[] = [];
  const semFracao: Linha[] = [];

  for (const l of todasAsLinhas) {
    receitaTotal += l.receita;
    despesaTotal += l.despesa;
    if (l.classificacao.confianca === "duvidosa") duvidosas.push(l);
    if (
      (l.classificacao.categoriaNome === CATEGORIAS.QUOTIZACOES ||
        l.classificacao.categoriaNome === CATEGORIAS.REFORCO_OBRAS ||
        l.classificacao.categoriaNome === CATEGORIAS.REUNIAO) &&
      !l.classificacao.fracaoLetra
    ) {
      semFracao.push(l);
    }
  }

  console.log(`Linhas lidas: ${todasAsLinhas.length}`);
  console.log(`  receita total  ${receitaTotal.toFixed(2)} €`);
  console.log(`  despesa total  ${despesaTotal.toFixed(2)} €`);
  console.log(`  saldo esperado 2025 (882,16 € abertura + isto) = ${(882.16 + receitaTotal - despesaTotal).toFixed(2)} €`);

  console.log("\nPor categoria:");
  const porCategoria = new Map<string, { n: number; receita: number; despesa: number }>();
  for (const l of todasAsLinhas) {
    const c = porCategoria.get(l.classificacao.categoriaNome) ?? { n: 0, receita: 0, despesa: 0 };
    c.n++;
    c.receita += l.receita;
    c.despesa += l.despesa;
    porCategoria.set(l.classificacao.categoriaNome, c);
  }
  for (const [nome, c] of porCategoria) {
    console.log(`  ${nome.padEnd(24)} ${String(c.n).padStart(3)} linhas   +${c.receita.toFixed(2).padStart(8)} €  -${c.despesa.toFixed(2).padStart(8)} €`);
  }

  if (duvidosas.length > 0) {
    console.log(`\nLinhas com categoria duvidosa (${duvidosas.length}), a confirmar:`);
    for (const l of duvidosas) {
      console.log(`  ${l.ficheiro}  ${l.data}  "${l.descricao}"  R=${l.receita} D=${l.despesa}  -> sugestão: ${l.classificacao.categoriaNome}`);
    }
  }
  if (semFracao.length > 0) {
    console.log(`\nLinhas de quota/reforço/reunião sem fração reconhecida (${semFracao.length}):`);
    for (const l of semFracao) {
      console.log(`  ${l.ficheiro}  ${l.data}  "${l.descricao}"`);
    }
  }

  if (!GRAVAR) {
    console.log("\nNada foi gravado. Revê a classificação acima e corre com --gravar para importar.");
    return;
  }

  if (!supabase) throw new Error("Sem ligação ao Supabase.");

  const { count } = await supabase
    .from("movimentos")
    .select("id", { count: "exact", head: true })
    .eq("conta", "caixa")
    .gte("data", `${ANO}-01-01`)
    .lte("data", `${ANO}-12-31`);
  if ((count ?? 0) > 0) {
    console.log(`\nJá existem ${count} movimentos de caixa em ${ANO}. Nada foi importado, para não duplicar.`);
    return;
  }

  const registos = todasAsLinhas.map((l) => {
    const categoriaId = idCategoria.get(l.classificacao.categoriaNome);
    if (!categoriaId) throw new Error(`Categoria "${l.classificacao.categoriaNome}" não existe na BD.`);
    const fracaoId = l.classificacao.fracaoLetra ? idFracao.get(l.classificacao.fracaoLetra) ?? null : null;
    const quotaMes = l.classificacao.quotaMesIni
      ? `${l.data.slice(0, 4)}-${String(l.classificacao.quotaMesIni).padStart(2, "0")}-01`
      : null;
    const quotaMesFim = l.classificacao.quotaMesFim
      ? `${l.data.slice(0, 4)}-${String(l.classificacao.quotaMesFim).padStart(2, "0")}-01`
      : null;

    return {
      data: l.data,
      doc: l.doc || null,
      categoria_id: categoriaId,
      descricao: l.descricao,
      conta: "caixa" as const,
      receita: l.receita,
      despesa: l.despesa,
      fracao_id: fracaoId,
      quota_mes: quotaMes,
      quota_mes_fim: quotaMesFim,
    };
  });

  for (let i = 0; i < registos.length; i += 200) {
    const bloco = registos.slice(i, i + 200);
    const { error } = await supabase.from("movimentos").insert(bloco);
    if (error) throw new Error(`movimentos: ${error.message}`);
  }
  console.log(`\n${registos.length} movimentos de caixa gravados para ${ANO}.`);
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
