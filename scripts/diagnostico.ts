/**
 * Mostra o estado financeiro da base de dados e explica como se chega aos
 * saldos que a aplicação apresenta.
 *
 *   npx tsx scripts/diagnostico.ts
 *   npx tsx scripts/diagnostico.ts 2026
 *
 * Serve para perceber uma diferença entre o que a aplicação mostra e o que o
 * extrato do banco diz.
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { euros, somar } from "../src/lib/formatos.ts";

function carregarAmbiente() {
  const caminho = join(process.cwd(), ".env.local");
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(linha);
    if (!m) continue;
    const valor = m[2].trim().replace(/^["']|["']$/g, "");
    if (valor && !process.env[m[1]]) process.env[m[1]] = valor;
  }
}

type Mov = {
  data: string;
  conta: "banco" | "caixa";
  receita: number;
  despesa: number;
  descricao: string | null;
  categorias: { nome: string } | null;
};

async function main() {
  carregarAmbiente();
  const ano = Number(process.argv[2] ?? 2026);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Faltam as variáveis do Supabase.");

  const supabase = createClient(url, chave, { auth: { persistSession: false } });

  // --- Saldos de abertura -------------------------------------------------
  const { data: saldos } = await supabase
    .from("saldos_iniciais")
    .select("*")
    .eq("ano", ano)
    .maybeSingle();

  console.log(`\n=== Saldos de abertura de ${ano} ===\n`);
  if (!saldos) {
    console.log("  NÃO EXISTE registo de saldos de abertura para este ano.");
  } else {
    console.log(`  Caixa              ${euros(Number(saldos.caixa))}`);
    console.log(`  Depósitos à ordem  ${euros(Number(saldos.deposito_ordem))}`);
    console.log(`  Depósitos a prazo  ${euros(Number(saldos.deposito_prazo))}`);
    console.log(`  Conta poupança     ${euros(Number(saldos.conta_poupanca))}`);
    if (
      Number(saldos.caixa) === 0 &&
      Number(saldos.deposito_ordem) === 0
    ) {
      console.log(
        "\n  ATENÇÃO: estão a zero. Se o condomínio já tinha dinheiro no",
      );
      console.log(
        "  início do ano, os saldos da aplicação vão sair mais baixos do",
      );
      console.log("  que os do banco por esse valor.");
    }
  }

  // --- Movimentos ---------------------------------------------------------
  const { data, error } = await supabase
    .from("movimentos")
    .select("data, conta, receita, despesa, descricao, categorias(nome)")
    .order("data", { ascending: true });
  if (error) throw new Error(error.message);

  const movimentos = (data ?? []) as unknown as Mov[];
  const doAno = movimentos.filter((m) => m.data.startsWith(String(ano)));
  const foraDoAno = movimentos.filter((m) => !m.data.startsWith(String(ano)));

  console.log(`\n=== Movimentos ===\n`);
  console.log(`  Total na base de dados: ${movimentos.length}`);
  console.log(`  De ${ano}: ${doAno.length}`);
  if (foraDoAno.length > 0) {
    const anos = [...new Set(foraDoAno.map((m) => m.data.slice(0, 4)))].sort();
    console.log(
      `  Fora de ${ano}: ${foraDoAno.length} (anos ${anos.join(", ")})`,
    );
    console.log(
      "    Estes não entram nos saldos do exercício, mas podem indicar",
    );
    console.log("    linhas importadas a mais.");
  }

  if (doAno.length > 0) {
    console.log(
      `  Intervalo: ${doAno[0].data} a ${doAno[doAno.length - 1].data}`,
    );
  }

  // --- Saldos calculados --------------------------------------------------
  const porConta = (conta: "banco" | "caixa") => {
    const linhas = doAno.filter((m) => m.conta === conta);
    const receita = somar(linhas.map((m) => Number(m.receita)));
    const despesa = somar(linhas.map((m) => Number(m.despesa)));
    return { linhas: linhas.length, receita, despesa };
  };

  const banco = porConta("banco");
  const caixa = porConta("caixa");

  const aberturaBanco = Number(saldos?.deposito_ordem ?? 0);
  const aberturaCaixa = Number(saldos?.caixa ?? 0);

  const saldoBanco = somar([aberturaBanco, banco.receita, -banco.despesa]);
  const saldoCaixa = somar([aberturaCaixa, caixa.receita, -caixa.despesa]);

  console.log(`\n=== Como se chega ao saldo do banco ===\n`);
  console.log(`  abertura                ${euros(aberturaBanco).padStart(12)}`);
  console.log(
    `  + receitas (${String(banco.linhas).padStart(3)} linhas) ${euros(banco.receita).padStart(12)}`,
  );
  console.log(`  - despesas              ${euros(banco.despesa).padStart(12)}`);
  console.log(`  ${"-".repeat(38)}`);
  console.log(`  = saldo                 ${euros(saldoBanco).padStart(12)}`);

  console.log(`\n=== Como se chega ao saldo de caixa ===\n`);
  console.log(`  abertura                ${euros(aberturaCaixa).padStart(12)}`);
  console.log(
    `  + receitas (${String(caixa.linhas).padStart(3)} linhas) ${euros(caixa.receita).padStart(12)}`,
  );
  console.log(`  - despesas              ${euros(caixa.despesa).padStart(12)}`);
  console.log(`  ${"-".repeat(38)}`);
  console.log(`  = saldo                 ${euros(saldoCaixa).padStart(12)}`);

  console.log(`\n  Total disponível        ${euros(somar([saldoBanco, saldoCaixa])).padStart(12)}`);

  // --- Outros dados -------------------------------------------------------
  const { count: nFracoesComNome } = await supabase
    .from("fracoes")
    .select("id", { count: "exact", head: true })
    .not("condomino_nome", "is", null);
  const { count: nCondominio } = await supabase
    .from("condominio")
    .select("id", { count: "exact", head: true });
  const { count: nExtratos } = await supabase
    .from("extratos")
    .select("id", { count: "exact", head: true });

  console.log(`\n=== Outros dados ===\n`);
  console.log(`  Frações com condómino preenchido: ${nFracoesComNome ?? 0} de 8`);
  console.log(`  Identificação do condomínio: ${nCondominio ? "preenchida" : "EM FALTA"}`);
  console.log(`  Extratos importados: ${nExtratos ?? 0}`);
  console.log("");
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
