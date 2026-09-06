/**
 * Alinha as regras de conciliação da base de dados com a lista canónica.
 *
 *   npx tsx scripts/aplicar-regras.ts            (mostra o que faria)
 *   npx tsx scripts/aplicar-regras.ts --gravar   (aplica)
 *
 * É idempotente: correr duas vezes não duplica nada. Serve para actualizar uma
 * base já criada sem ter de aplicar migrações à mão.
 *
 * A lista aqui tem de acompanhar supabase/migrations/0003 e 0004, que são o
 * que uma instalação de raiz recebe.
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const GRAVAR = process.argv.includes("--gravar");

/** padrão, categoria, prioridade. Menor prioridade ganha. */
const REGRAS: Array<[string, string, number]> = [
  // Encargos bancários. "comiss" cobre "comissão" e "comissões".
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
];

/** Padrões que deixaram de ser usados e devem sair. */
const OBSOLETAS = ["comissao"];

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

async function main() {
  carregarAmbiente();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.",
    );
  }

  const supabase = createClient(url, chave, { auth: { persistSession: false } });

  console.log(GRAVAR ? "MODO GRAVAÇÃO\n" : "SIMULAÇÃO (usa --gravar para aplicar)\n");

  const { data: categorias, error: erroCategorias } = await supabase
    .from("categorias")
    .select("id, nome");
  if (erroCategorias) throw new Error(erroCategorias.message);

  const idPorNome = new Map(
    (categorias ?? []).map((c: { id: string; nome: string }) => [c.nome, c.id]),
  );

  const { data: existentes, error: erroExistentes } = await supabase
    .from("regras_conciliacao")
    .select("id, padrao");
  if (erroExistentes) throw new Error(erroExistentes.message);

  const padroesExistentes = new Map(
    (existentes ?? []).map((r: { id: string; padrao: string }) => [
      r.padrao,
      r.id,
    ]),
  );

  const aInserir: Array<{
    padrao: string;
    categoria_id: string;
    prioridade: number;
  }> = [];

  for (const [padrao, categoria, prioridade] of REGRAS) {
    const categoriaId = idPorNome.get(categoria);
    if (!categoriaId) {
      console.log(`  AVISO categoria "${categoria}" não existe; ignorada`);
      continue;
    }
    if (padroesExistentes.has(padrao)) {
      console.log(`  ja existe   ${padrao.padEnd(22)} -> ${categoria}`);
    } else {
      console.log(`  a acrescentar ${padrao.padEnd(20)} -> ${categoria}`);
      aInserir.push({ padrao, categoria_id: categoriaId, prioridade });
    }
  }

  const aRemover = OBSOLETAS.filter((p) => padroesExistentes.has(p));
  for (const padrao of aRemover) {
    console.log(`  a remover     ${padrao} (obsoleta)`);
  }

  console.log(
    `\n${aInserir.length} regra(s) a acrescentar, ${aRemover.length} a remover.`,
  );

  if (!GRAVAR) return;

  if (aInserir.length > 0) {
    const { error } = await supabase.from("regras_conciliacao").insert(aInserir);
    if (error) throw new Error(`inserir: ${error.message}`);
  }
  if (aRemover.length > 0) {
    const { error } = await supabase
      .from("regras_conciliacao")
      .delete()
      .in("padrao", aRemover);
    if (error) throw new Error(`remover: ${error.message}`);
  }

  const { count } = await supabase
    .from("regras_conciliacao")
    .select("id", { count: "exact", head: true });
  console.log(`\nAplicado. A base tem agora ${count} regra(s).`);
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
