/**
 * Confirma que o Supabase está bem configurado.
 *
 *   npx tsx scripts/verificar-ligacao.ts
 *
 * Verifica três coisas, por ordem de importância:
 *   1. As variáveis de ambiente existem e a ligação funciona.
 *   2. O esquema e os dados iniciais foram aplicados.
 *   3. As políticas de segurança bloqueiam mesmo quem não tem sessão.
 *
 * O terceiro ponto é o que interessa mais: o repositório é público e a chave
 * anónima vai com ele, por isso é o Postgres que tem de recusar o acesso, não
 * o código das páginas.
 *
 * Nunca imprime as chaves, só se estão presentes e se funcionam.
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();

const TABELAS = [
  "condominio",
  "fracoes",
  "profiles",
  "fornecedores",
  "categorias",
  "movimentos",
  "saldos_iniciais",
  "extratos",
  "extrato_linhas",
  "regras_conciliacao",
  "assembleias",
  "recibos",
  "definicoes",
] as const;

/** Tabelas que ninguém sem sessão pode ler, nem uma linha. */
const PRIVADAS = [
  "fracoes",
  "movimentos",
  "fornecedores",
  "definicoes",
  "categorias",
  "condominio",
] as const;

let falhas = 0;
let avisos = 0;

function ok(msg: string) {
  console.log(`  ok    ${msg}`);
}
function falha(msg: string) {
  falhas++;
  console.log(`  FALHA ${msg}`);
}
function aviso(msg: string) {
  avisos++;
  console.log(`  aviso ${msg}`);
}

function carregarAmbiente() {
  const caminho = join(RAIZ, ".env.local");
  if (!existsSync(caminho)) return false;
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(linha);
    if (!m) continue;
    const valor = m[2].trim().replace(/^["']|["']$/g, "");
    if (valor && !process.env[m[1]]) process.env[m[1]] = valor;
  }
  return true;
}

async function main() {
  console.log("\n=== 1. Variáveis de ambiente ===\n");

  if (!carregarAmbiente()) {
    falha("não existe .env.local na raiz do projecto");
    console.log("\n        Copia o .env.example para .env.local e preenche.");
    process.exit(1);
  }
  ok(".env.local encontrado");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) falha("NEXT_PUBLIC_SUPABASE_URL está vazia");
  else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url.trim())) {
    aviso(`NEXT_PUBLIC_SUPABASE_URL tem um formato invulgar: ${url}`);
  } else ok(`NEXT_PUBLIC_SUPABASE_URL aponta para ${new URL(url).hostname}`);

  if (!anon) falha("NEXT_PUBLIC_SUPABASE_ANON_KEY está vazia");
  else ok(`NEXT_PUBLIC_SUPABASE_ANON_KEY preenchida (${anon.length} caracteres)`);

  if (!servico) falha("SUPABASE_SERVICE_ROLE_KEY está vazia");
  else if (servico === anon) {
    falha("SUPABASE_SERVICE_ROLE_KEY é igual à chave anónima; troca-as");
  } else {
    ok(`SUPABASE_SERVICE_ROLE_KEY preenchida (${servico.length} caracteres)`);
  }

  if (falhas > 0) {
    console.log("\nPreenche o .env.local e volta a correr.\n");
    process.exit(1);
  }

  const admin = createClient(url!, servico!, {
    auth: { persistSession: false },
  });
  const publico = createClient(url!, anon!, {
    auth: { persistSession: false },
  });

  // -------------------------------------------------------------------------
  console.log("\n=== 2. Esquema e dados iniciais ===\n");

  const contagens = new Map<string, number>();

  for (const tabela of TABELAS) {
    const { error, count } = await admin
      .from(tabela)
      .select("*", { count: "exact", head: true });

    if (error) {
      falha(`tabela "${tabela}": ${error.message}`);
    } else {
      contagens.set(tabela, count ?? 0);
      ok(`tabela "${tabela}" existe (${count ?? 0} linha(s))`);
    }
  }

  if (falhas > 0) {
    console.log(
      "\n        Falta aplicar as migrações. Abre o SQL Editor do Supabase e" +
        "\n        cola o ficheiro supabase/migracao-completa.sql.\n",
    );
    process.exit(1);
  }

  console.log("");
  const categorias = contagens.get("categorias") ?? 0;
  if (categorias >= 16) ok(`${categorias} categorias semeadas`);
  else falha(`só ${categorias} categorias; esperava 16`);

  const fracoes = contagens.get("fracoes") ?? 0;
  if (fracoes >= 8) ok(`${fracoes} frações semeadas`);
  else falha(`só ${fracoes} frações; esperava 8`);

  const definicoes = contagens.get("definicoes") ?? 0;
  if (definicoes >= 5) ok(`${definicoes} definições semeadas`);
  else falha(`só ${definicoes} definições; esperava 5`);

  const { data: diaLimite } = await admin
    .from("definicoes")
    .select("valor")
    .eq("chave", "dia_limite_quota")
    .maybeSingle();

  if (diaLimite && Number(diaLimite.valor) === 8) {
    ok("dia limite de pagamento das quotas está a 8");
  } else {
    aviso(`dia limite de pagamento inesperado: ${JSON.stringify(diaLimite)}`);
  }

  const { data: comNome } = await admin
    .from("fracoes")
    .select("letra")
    .not("condomino_nome", "is", null);

  if ((comNome?.length ?? 0) === 0) {
    aviso(
      "nenhuma fração tem condómino preenchido — corre depois" +
        " scripts/carregar-dados-reais.ts --gravar",
    );
  } else {
    ok(`${comNome!.length} fração(ões) já com condómino preenchido`);
  }

  // -------------------------------------------------------------------------
  console.log("\n=== 3. Segurança: acesso sem sessão ===\n");
  console.log(
    "  A chave anónima é pública e vai no repositório. Nenhuma destas\n" +
      "  leituras pode devolver dados.\n",
  );

  for (const tabela of PRIVADAS) {
    const { data, error } = await publico.from(tabela).select("*").limit(1);

    if (error) {
      ok(`"${tabela}" recusa o acesso anónimo (${error.code ?? "erro"})`);
    } else if (!data || data.length === 0) {
      ok(`"${tabela}" não devolve nada a quem não tem sessão`);
    } else {
      falha(
        `"${tabela}" DEVOLVEU ${data.length} linha(s) a um cliente anónimo. ` +
          "As políticas de segurança não estão activas.",
      );
    }
  }

  // -------------------------------------------------------------------------
  console.log("\n=== 4. Contas de utilizador ===\n");

  const { data: utilizadores, error: erroUtilizadores } =
    await admin.auth.admin.listUsers();

  if (erroUtilizadores) {
    aviso(`não consegui listar utilizadores: ${erroUtilizadores.message}`);
  } else {
    const total = utilizadores.users.length;
    if (total === 0) {
      aviso(
        "ainda não há nenhum utilizador. Cria o teu em Authentication > Users;" +
          " o primeiro fica automaticamente como administrador",
      );
    } else {
      ok(`${total} utilizador(es) registados`);

      const { data: perfis } = await admin
        .from("profiles")
        .select("id, nome, papel");

      const admins = (perfis ?? []).filter((p) => p.papel === "admin");
      if ((perfis?.length ?? 0) < total) {
        falha(
          `${total} utilizadores mas só ${perfis?.length ?? 0} perfis; ` +
            "o gatilho ao_criar_utilizador pode não ter sido criado",
        );
      } else if (admins.length === 0) {
        falha("nenhum utilizador tem o papel de administrador");
      } else {
        ok(`${admins.length} administrador(es)`);
      }
    }
  }

  // -------------------------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  if (falhas === 0 && avisos === 0) {
    console.log("Tudo pronto. Podes arrancar com npm run dev.");
  } else if (falhas === 0) {
    console.log(`Sem falhas, ${avisos} aviso(s) a resolver quando puderes.`);
  } else {
    console.log(`${falhas} falha(s) e ${avisos} aviso(s).`);
  }
  console.log("=".repeat(60) + "\n");

  process.exit(falhas > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("\nErro inesperado:", e.message);
  console.error(
    "\nSe for um erro de rede, confirma o NEXT_PUBLIC_SUPABASE_URL.\n",
  );
  process.exit(1);
});
