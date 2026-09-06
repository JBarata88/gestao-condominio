/**
 * Cruza os movimentos de Quotizações importados do extrato (com fração mas
 * sem mês) com a folha CONTROLO GESTAO CONDOMINIO, que já tem a atribuição de
 * mês feita à mão, fração a fração.
 *
 * Só PROPÕE. Não escreve nada na base de dados. A correspondência é feita por
 * data exacta dentro da mesma fração: se o banco tem um pagamento a 16/04 da
 * fração A e a folha tem uma linha "QUOTA ABR FRACÇÃO A" também a 16/04, é a
 * mesma transferência vista de dois lados, com uma confiança altíssima.
 *
 * Não se exige que o total da fração bata, porque a folha tem linhas
 * incompletas no fim do ano (valores a zero, repetições), e isso desequilibra
 * a fração inteira mesmo quando cada linha individual bate perfeitamente. Uma
 * data que não tem par do outro lado fica de fora, para decisão manual.
 *
 *   npx tsx scripts/validar-quotas.ts
 */

import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { euros, somar } from "../src/lib/formatos.ts";

const FICHEIRO_FOLHA = join(
  process.cwd(),
  "ASSETS",
  "CONTROLO GESTAO CONDOMINIO 2026.xlsx",
);

const MESES_CURTOS: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};

function carregarAmbiente() {
  const c = join(process.cwd(), ".env.local");
  if (!existsSync(c)) return;
  for (const l of readFileSync(c, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(l);
    if (m && m[2].trim() && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
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

type PagamentoBanco = {
  id: string;
  data: string;
  descricao: string | null;
  valor: number;
};
type PagamentoFolha = {
  data: string;
  descricao: string;
  valor: number;
  mes: number;
  ano: number;
};

async function main() {
  carregarAmbiente();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Faltam as variáveis do Supabase.");
  if (!existsSync(FICHEIRO_FOLHA)) {
    throw new Error(`Não encontrei ${FICHEIRO_FOLHA}.`);
  }

  const admin = createClient(url, chave, { auth: { persistSession: false } });

  // --- 1. Os 39 movimentos do banco, sem mês ------------------------------
  const { data: categorias } = await admin.from("categorias").select("id, nome");
  const catQuotas = categorias?.find((c) => c.nome === "Quotizações");
  if (!catQuotas) throw new Error("categoria Quotizações não encontrada");

  const { data: fracoesBd } = await admin
    .from("fracoes")
    .select("id, letra")
    .order("ordem");
  const letraPorId = new Map((fracoesBd ?? []).map((f) => [f.id, f.letra]));

  const { data: quebrados } = await admin
    .from("movimentos")
    .select("id, data, descricao, receita, fracao_id")
    .eq("categoria_id", catQuotas.id)
    .not("fracao_id", "is", null)
    .is("quota_mes", null)
    .not("extrato_linha_id", "is", null)
    .order("data");

  const porFracaoBanco = new Map<string, PagamentoBanco[]>();
  for (const m of quebrados ?? []) {
    const letra = letraPorId.get(m.fracao_id!);
    if (!letra) continue;
    const lista = porFracaoBanco.get(letra) ?? [];
    lista.push({
      id: m.id,
      data: m.data,
      descricao: m.descricao,
      valor: Number(m.receita),
    });
    porFracaoBanco.set(letra, lista);
  }

  const totalBanco = [...porFracaoBanco.values()].flat().length;
  console.log(`Movimentos do banco sem mês: ${totalBanco}\n`);

  // --- 2. A folha original, com o mês já atribuído ------------------------
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.readFile(FICHEIRO_FOLHA);
  const folha = livro.getWorksheet("DATA EXPORT");
  if (!folha) throw new Error('Folha "DATA EXPORT" não encontrada.');

  const porFracaoFolha = new Map<string, PagamentoFolha[]>();
  folha.eachRow((linha, n) => {
    if (n === 1) return;
    const data = comoData(linha.getCell(1).value);
    if (!data) return;
    const categoria = txt(linha.getCell(3).value);
    if (categoria !== "Quotizações 2026") return;

    const descricao = txt(linha.getCell(4).value);
    const mbRec = num(linha.getCell(5).value);
    const cxRec = num(linha.getCell(7).value);
    const valor = mbRec + cxRec;
    if (valor <= 0) return;

    const mFracao = /FRAC[ÇC][ÃA]O\s+([A-H])/i.exec(descricao);
    const mMes = /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b/i.exec(
      descricao,
    );
    if (!mFracao || !mMes) return;

    const letra = mFracao[1].toUpperCase();
    const lista = porFracaoFolha.get(letra) ?? [];
    lista.push({
      data,
      descricao,
      valor: Math.round(valor * 100) / 100,
      mes: MESES_CURTOS[mMes[1].toUpperCase()],
      ano: Number(data.slice(0, 4)),
    });
    porFracaoFolha.set(letra, lista);
  });

  // --- 3. Cruzar fração a fração, por data exacta --------------------------
  const letras = [...new Set([...porFracaoBanco.keys(), ...porFracaoFolha.keys()])].sort();

  type Proposta = {
    id: string;
    data: string;
    descricao: string | null;
    valor: number;
    quotaMes: string;
    origemFolha: string;
    valorBate: boolean;
  };
  const propostas: Proposta[] = [];
  const semCorrespondencia: {
    letra: string;
    data: string;
    valor: number;
    descricao: string | null;
  }[] = [];

  for (const letra of letras) {
    const banco = (porFracaoBanco.get(letra) ?? []).sort((a, b) =>
      a.data.localeCompare(b.data),
    );
    const folhaFracao = porFracaoFolha.get(letra) ?? [];

    if (banco.length === 0) continue;

    console.log(`--- Fração ${letra} ---`);
    console.log(
      `  banco: ${banco.length} pagamento(s), ${euros(somar(banco.map((b) => b.valor)))}`,
    );
    console.log(
      `  folha: ${folhaFracao.length} pagamento(s), ${euros(somar(folhaFracao.map((f) => f.valor)))}`,
    );

    // Um dia pode ter mais do que uma linha do mesmo lado (ex.: duas quotas
    // pagas juntas), por isso agrupa por data em vez de assumir unicidade.
    const folhaPorData = new Map<string, PagamentoFolha[]>();
    for (const f of folhaFracao) {
      const l = folhaPorData.get(f.data) ?? [];
      l.push(f);
      folhaPorData.set(f.data, l);
    }
    const usadas = new Set<number>(); // índices já emparelhados, por data

    for (const b of banco) {
      const candidatas = (folhaPorData.get(b.data) ?? []).filter(
        (_, i) => !usadas.has(i),
      );

      if (candidatas.length === 0) {
        console.log(
          `  ??  banco ${b.data} ${euros(b.valor).padStart(9)}  sem linha da folha nessa data exacta`,
        );
        semCorrespondencia.push({
          letra,
          data: b.data,
          valor: b.valor,
          descricao: b.descricao,
        });
        continue;
      }

      // Havendo mais do que uma candidata na mesma data, prefere a de valor
      // igual; sem essa, fica a primeira por ordem na folha.
      const escolhida =
        candidatas.find((f) => Math.abs(f.valor - b.valor) < 0.01) ??
        candidatas[0];
      const indiceReal = (folhaPorData.get(b.data) ?? []).indexOf(escolhida);
      usadas.add(indiceReal);

      const bate = Math.abs(b.valor - escolhida.valor) < 0.01;
      const quotaMes = `${escolhida.ano}-${String(escolhida.mes).padStart(2, "0")}-01`;

      console.log(
        `  ${bate ? "ok  " : "??  "} banco ${b.data} ${euros(b.valor).padStart(9)}  ->  folha "${escolhida.descricao}" (${quotaMes})${bate ? "" : `  [folha diz ${euros(escolhida.valor)}, ver com atenção]`}`,
      );

      propostas.push({
        id: b.id,
        data: b.data,
        descricao: b.descricao,
        valor: b.valor,
        quotaMes,
        origemFolha: escolhida.descricao,
        valorBate: bate,
      });
    }
    console.log("");
  }

  const altaConfianca = propostas.filter((p) => p.valorBate);
  const baixaConfianca = propostas.filter((p) => !p.valorBate);

  console.log("=".repeat(70));
  console.log(
    `Proposta: ${altaConfianca.length} de ${totalBanco} movimentos com correspondência exacta de data e valor.`,
  );
  if (baixaConfianca.length > 0) {
    console.log(
      `${baixaConfianca.length} com a mesma data mas valor diferente, a rever com atenção:`,
    );
    for (const p of baixaConfianca) {
      console.log(
        `  ${p.data}  banco ${euros(p.valor)} vs folha "${p.origemFolha}"`,
      );
    }
  }
  if (semCorrespondencia.length > 0) {
    console.log(
      `${semCorrespondencia.length} sem nenhuma linha da folha nessa data:`,
    );
    for (const s of semCorrespondencia) {
      console.log(
        `  fração ${s.letra}  ${s.data}  ${euros(s.valor)}  "${s.descricao}"`,
      );
    }
  }
  console.log(
    "\nNada foi gravado. Esta é só a proposta, para revisares antes de aplicar." +
      "\nPara gravar as de alta confiança: npx tsx scripts/validar-quotas.ts --gravar",
  );

  if (process.argv.includes("--gravar") && altaConfianca.length > 0) {
    console.log(`\nA gravar ${altaConfianca.length} correcção(ões)...`);
    for (const p of altaConfianca) {
      const { error } = await admin
        .from("movimentos")
        .update({ quota_mes: p.quotaMes })
        .eq("id", p.id);
      if (error) {
        console.log(`  FALHA ${p.data} ${p.id}: ${error.message}`);
      }
    }
    console.log("Gravado.");
  }
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
