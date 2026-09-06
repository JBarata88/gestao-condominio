/**
 * Descobre e corre os testes em src/.
 *
 * O Node 20 não expande globos nem reconhece ficheiros .ts na descoberta
 * automática do --test, por isso a lista é montada aqui e passada explícita.
 */
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const origem = join(raiz, "src");

function procurar(dir) {
  const encontrados = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...procurar(caminho));
    } else if (/\.test\.tsx?$/.test(entrada.name)) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

const testes = procurar(origem);

if (testes.length === 0) {
  console.error("Nenhum ficheiro de teste encontrado em src/");
  process.exit(1);
}

console.log(
  `A correr ${testes.length} ficheiro(s):\n${testes
    .map((t) => `  ${relative(raiz, t)}`)
    .join("\n")}\n`,
);

// O tsx expõe um ponto de entrada de CommonJS que se regista como loader.
// Invocá-lo pelo Node directamente evita depender do .cmd do Windows, que o
// spawnSync não consegue executar sem shell.
const registador = join(raiz, "node_modules", "tsx", "dist", "loader.mjs");

const resultado = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...testes],
  { stdio: "inherit", cwd: raiz },
);

if (resultado.error) {
  console.error("Falha ao arrancar o runner de testes:", resultado.error);
  console.error("Loader esperado em:", registador);
  process.exit(1);
}

process.exit(resultado.status ?? 1);
