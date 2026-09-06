/**
 * Carrega os dados reais para o Supabase: identificação do condomínio, frações
 * com os condóminos, fornecedores, saldos de abertura e o histórico de
 * movimentos da folha CONTROLO GESTAO CONDOMINIO.
 *
 *   npx tsx scripts/carregar-dados-reais.ts            (só mostra o que faria)
 *   npx tsx scripts/carregar-dados-reais.ts --gravar   (grava mesmo)
 *
 * Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.
 * Usa a chave de serviço porque corre fora de qualquer sessão de utilizador.
 *
 * Os dados pessoais vêm de dados-locais/condominio.json, que está fora do
 * repositório. Há um modelo em scripts/dados-exemplo.json.
 */

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { arredondar } from "../src/lib/formatos.ts";

const GRAVAR = process.argv.includes("--gravar");

/**
 * Importa apenas os movimentos de caixa.
 *
 * Serve para quando os movimentos bancários já entraram pela importação do
 * extrato, que é a fonte melhor, e só falta o numerário, que só existe na
 * folha de cálculo.
 */
const SO_CAIXA = process.argv.includes("--so-caixa");
const RAIZ = process.cwd();
const FICHEIRO_DADOS = join(RAIZ, "dados-locais", "condominio.json");
const FICHEIRO_FOLHA = join(
  RAIZ,
  "ASSETS",
  "CONTROLO GESTAO CONDOMINIO 2026.xlsx",
);

/** Nome da categoria na folha -> nome na base de dados. */
const CATEGORIAS: Record<string, string> = {
  "Quotizações 2026": "Quotizações",
  "Reforço Fundos Obras": "Reforço Fundos Obras",
  Agua: "Agua",
  Correios: "Correios",
  Seguros: "Seguros",
  "Despesas bancárias": "Despesas bancárias",
  Electricidade: "Electricidade",
  "Ferramentas e utensilios": "Ferramentas e utensílios",
  "Materiais de limpeza": "Materiais de limpeza",
  "Obras e reparações": "Obras e reparações",
  Papelaria: "Papelaria",
  "Pagamentos a pessoal": "Pagamentos a pessoal",
  "Presença Reunião": "Presença Reunião",
  "Desposito Bancario": "Depósito Bancário",
};

const MESES_CURTOS: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};

function carregarAmbiente() {
  const caminho = join(RAIZ, ".env.local");
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(linha);
    if (!m) continue;
    const valor = m[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = valor;
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
  return "";
}

function comoData(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 0) {
    return new Date(Date.UTC(1899, 11, 30) + v * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  return null;
}

async function main() {
  carregarAmbiente();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Só a gravação precisa de credenciais. A simulação corre offline, para
  // poderes conferir o que seria importado antes de ligar o Supabase.
  if (GRAVAR && (!url || !chave)) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.",
    );
  }
  const ligado = Boolean(url && chave);

  if (!existsSync(FICHEIRO_DADOS)) {
    throw new Error(
      `Não encontrei ${FICHEIRO_DADOS}.\n` +
        "Copia scripts/dados-exemplo.json para dados-locais/condominio.json e preenche.",
    );
  }

  const dados = JSON.parse(readFileSync(FICHEIRO_DADOS, "utf8"));
  const supabase = ligado
    ? createClient(url!, chave!, { auth: { persistSession: false } })
    : null;

  console.log(GRAVAR ? "MODO GRAVAÇÃO\n" : "SIMULAÇÃO (usa --gravar para gravar)\n");
  if (!ligado) {
    console.log("Sem credenciais do Supabase: só é feita a leitura local.\n");
  }

  // --- Condomínio ---------------------------------------------------------
  const c = dados.condominio;
  console.log(`Condomínio: ${c.nome}, ${c.morada}`);
  if (GRAVAR && supabase) {
    const { error } = await supabase.from("condominio").upsert({
      id: 1,
      nome: c.nome,
      morada: c.morada,
      codigo_postal: c.codigo_postal,
      localidade: c.localidade,
      nif: c.nif,
      nib: c.nib,
      iban: c.iban,
    });
    if (error) throw new Error(`condominio: ${error.message}`);
  }

  // --- Saldos de abertura -------------------------------------------------
  const s = dados.saldos_iniciais;
  console.log(
    `Saldos de abertura de ${s.ano}: caixa ${s.caixa}, banco ${s.deposito_ordem}`,
  );
  if (GRAVAR && supabase) {
    const { error } = await supabase.from("saldos_iniciais").upsert({
      ano: s.ano,
      caixa: s.caixa,
      deposito_ordem: s.deposito_ordem,
      deposito_prazo: s.deposito_prazo,
      conta_poupanca: s.conta_poupanca,
    });
    if (error) throw new Error(`saldos_iniciais: ${error.message}`);
  }

  // --- Frações ------------------------------------------------------------
  console.log(`\nFrações: ${dados.fracoes.length}`);
  for (const f of dados.fracoes) {
    console.log(
      `  ${f.letra} ${f.andar.padEnd(8)} ${String(f.condomino_nome).padEnd(34)} ${f.quota_mensal} €`,
    );
    if (GRAVAR && supabase) {
      const { error } = await supabase
        .from("fracoes")
        .update({
          andar: f.andar,
          condomino_nome: f.condomino_nome,
          tratamento: f.tratamento,
          email: f.email,
          telefone: f.telefone,
          quota_mensal: f.quota_mensal,
        })
        .eq("letra", f.letra);
      if (error) throw new Error(`fracoes ${f.letra}: ${error.message}`);
    }
  }

  // --- Fornecedores -------------------------------------------------------
  for (const f of dados.fornecedores ?? []) {
    console.log(`Fornecedor: ${f.nome} (${f.tipo ?? "sem tipo"})`);
    if (GRAVAR && supabase) {
      const { error } = await supabase.from("fornecedores").insert({
        nome: f.nome,
        tipo: f.tipo,
        email: f.email,
        telefone: f.telefone,
        iban: f.iban,
      });
      if (error && error.code !== "23505") {
        throw new Error(`fornecedores: ${error.message}`);
      }
    }
  }

  // --- Histórico de movimentos -------------------------------------------
  if (!existsSync(FICHEIRO_FOLHA)) {
    console.log(
      `\nSem histórico para importar: não encontrei ${FICHEIRO_FOLHA}.`,
    );
    return;
  }

  let idCategoria: Map<string, string>;
  let idFracao: Map<string, string>;

  if (supabase) {
    const { data: categorias } = await supabase
      .from("categorias")
      .select("id, nome");
    const { data: fracoesBd } = await supabase
      .from("fracoes")
      .select("id, letra");
    idCategoria = new Map(
      (categorias ?? []).map((c: { id: string; nome: string }) => [c.nome, c.id]),
    );
    idFracao = new Map(
      (fracoesBd ?? []).map((f: { id: string; letra: string }) => [f.letra, f.id]),
    );
  } else {
    // Identificadores de simulação, só para o resumo poder ser calculado.
    idCategoria = new Map(Object.values(CATEGORIAS).map((n) => [n, `sim-${n}`]));
    idFracao = new Map(
      dados.fracoes.map((f: { letra: string }) => [f.letra, `sim-${f.letra}`]),
    );
  }

  const livro = new ExcelJS.Workbook();
  await livro.xlsx.readFile(FICHEIRO_FOLHA);
  const folha = livro.getWorksheet("DATA EXPORT");
  if (!folha) throw new Error('A folha "DATA EXPORT" não existe.');

  type Movimento = {
    data: string;
    categoria_id: string;
    descricao: string | null;
    conta: "banco" | "caixa";
    receita: number;
    despesa: number;
    fracao_id: string | null;
    quota_mes: string | null;
  };

  const movimentos: Movimento[] = [];
  const problemas: string[] = [];

  folha.eachRow((linha, n) => {
    if (n === 1) return;

    const data = comoData(linha.getCell(1).value);
    if (!data) return;

    const nomeFolha = txt(linha.getCell(3).value);
    const nomeBd = CATEGORIAS[nomeFolha];
    const descricao = txt(linha.getCell(4).value) || null;

    const mbRec = arredondar(num(linha.getCell(5).value));
    const mbDesp = arredondar(num(linha.getCell(6).value));
    const cxRec = arredondar(num(linha.getCell(7).value));
    const cxDesp = arredondar(num(linha.getCell(8).value));

    if (!mbRec && !mbDesp && !cxRec && !cxDesp) return;

    if (!nomeBd) {
      problemas.push(`linha ${n}: categoria desconhecida "${nomeFolha}"`);
      return;
    }
    const categoriaId = idCategoria.get(nomeBd);
    if (!categoriaId) {
      problemas.push(`linha ${n}: categoria "${nomeBd}" não existe na BD`);
      return;
    }

    // "QUOTA JAN FRACÇÃO G" -> fração G, mês de Janeiro.
    let fracaoId: string | null = null;
    let quotaMes: string | null = null;
    if (nomeBd === "Quotizações" && descricao) {
      const mFracao = /FRAC[ÇC][ÃA]O\s+([A-H])/i.exec(descricao);
      if (mFracao) fracaoId = idFracao.get(mFracao[1].toUpperCase()) ?? null;

      const mMes = /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b/i.exec(
        descricao,
      );
      const ano = data.slice(0, 4);
      if (mMes) {
        const mes = MESES_CURTOS[mMes[1].toUpperCase()];
        quotaMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
      }
      if (fracaoId && !quotaMes) {
        problemas.push(`linha ${n}: quota sem mês reconhecido em "${descricao}"`);
      }
    }

    const base = {
      data,
      categoria_id: categoriaId,
      descricao,
      fracao_id: fracaoId,
      quota_mes: quotaMes,
    };

    // Uma linha da folha podia ter valores de banco e de caixa ao mesmo tempo.
    if (mbRec || mbDesp) {
      movimentos.push({
        ...base,
        conta: "banco",
        receita: mbRec,
        despesa: mbDesp,
      });
    }
    if (cxRec || cxDesp) {
      movimentos.push({
        ...base,
        conta: "caixa",
        receita: cxRec,
        despesa: cxDesp,
      });
    }
  });

  const aImportar = SO_CAIXA
    ? movimentos.filter((m) => m.conta === "caixa")
    : movimentos;

  const receita =
    aImportar.reduce((t, m) => t + Math.round(m.receita * 100), 0) / 100;
  const despesa =
    aImportar.reduce((t, m) => t + Math.round(m.despesa * 100), 0) / 100;
  const comQuota = aImportar.filter((m) => m.quota_mes).length;

  console.log(
    `\nHistórico: ${aImportar.length} movimentos` +
      (SO_CAIXA ? ` de caixa (de ${movimentos.length} no total)` : ""),
  );
  console.log(`  receita total ${receita} €`);
  console.log(`  despesa total ${despesa} €`);
  console.log(`  quotas com fração e mês atribuídos: ${comQuota}`);

  if (SO_CAIXA) {
    console.log(
      `  saldo de caixa esperado: ${
        Math.round((s.caixa + receita - despesa) * 100) / 100
      } €`,
    );
  } else {
    console.log(
      `  saldo final esperado: ${
        Math.round((s.caixa + s.deposito_ordem + receita - despesa) * 100) / 100
      } €`,
    );
  }

  if (problemas.length > 0) {
    console.log(`\nAvisos (${problemas.length}):`);
    problemas.forEach((p) => console.log(`  ${p}`));
  }

  if (GRAVAR && supabase) {
    // Em modo --so-caixa só interessa saber se já há movimentos de caixa; os
    // bancários vieram da importação do extrato e devem ficar como estão.
    const consulta = supabase
      .from("movimentos")
      .select("id", { count: "exact", head: true });
    const { count } = SO_CAIXA
      ? await consulta.eq("conta", "caixa")
      : await consulta;

    if ((count ?? 0) > 0) {
      console.log(
        `\nJá existem ${count} movimentos${SO_CAIXA ? " de caixa" : ""} na base de dados. ` +
          "Nada foi importado, para não duplicar. " +
          "Apaga-os primeiro se quiseres reimportar.",
      );
      return;
    }

    // Em blocos, porque o Postgrest tem limite de tamanho no corpo do pedido.
    for (let i = 0; i < aImportar.length; i += 200) {
      const bloco = aImportar.slice(i, i + 200);
      const { error } = await supabase.from("movimentos").insert(bloco);
      if (error) throw new Error(`movimentos: ${error.message}`);
    }
    console.log(`\n${aImportar.length} movimentos gravados.`);
  }
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
