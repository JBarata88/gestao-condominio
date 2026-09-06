/**
 * Junta as migrações num único ficheiro para colar no editor de SQL do
 * Supabase, para quem não quer instalar a CLI.
 *
 *   node scripts/gerar-sql-completo.mjs
 *
 * O resultado vai para supabase/migracao-completa.sql. É gerado, não editado à
 * mão: a fonte da verdade são os ficheiros em supabase/migrations/.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const pastaMigracoes = join(raiz, "supabase", "migrations");
const destino = join(raiz, "supabase", "migracao-completa.sql");

const ficheiros = readdirSync(pastaMigracoes)
  .filter((n) => n.endsWith(".sql"))
  .sort();

if (ficheiros.length === 0) {
  console.error("Não encontrei migrações em supabase/migrations/");
  process.exit(1);
}

const partes = [
  "-- ===========================================================================",
  "-- FICHEIRO GERADO. Não editar à mão.",
  "-- Gerado por scripts/gerar-sql-completo.mjs a partir de supabase/migrations/",
  "--",
  "-- Como usar:",
  "--   1. Abre o teu projecto em supabase.com",
  "--   2. Vai a SQL Editor e cria uma query nova",
  "--   3. Cola este ficheiro inteiro e carrega em Run",
  "--",
  "-- Corre uma só vez. Correr duas vezes dá erro de objectos já existentes,",
  "-- o que é o comportamento pretendido: evita duplicar os dados iniciais.",
  "-- ===========================================================================",
  "",
  "begin;",
  "",
];

for (const nome of ficheiros) {
  const conteudo = readFileSync(join(pastaMigracoes, nome), "utf8").trimEnd();
  partes.push(
    "-- ---------------------------------------------------------------------------",
    `-- ${nome}`,
    "-- ---------------------------------------------------------------------------",
    "",
    conteudo,
    "",
  );
}

partes.push("commit;", "");

writeFileSync(destino, partes.join("\n"), "utf8");

console.log(`Gerado ${destino}`);
console.log(`A partir de ${ficheiros.length} migração(ões):`);
for (const n of ficheiros) console.log(`  ${n}`);
