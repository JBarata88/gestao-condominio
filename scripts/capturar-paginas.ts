/**
 * Tira capturas de ecrã das páginas autenticadas.
 *
 *   npx tsx scripts/capturar-paginas.ts
 *
 * Cria uma conta temporária de administração, entra com ela, fotografa as
 * páginas e apaga a conta no fim, aconteça o que acontecer. A conta existe
 * durante poucos segundos e tem uma palavra-passe aleatória.
 *
 * Não usa a conta do administrador real: entrar numa conta de outra pessoa
 * para tirar fotografias não seria correcto, e além disso a palavra-passe
 * dela não está aqui.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";

const PASTA = "temporary screenshots";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const PAGINAS: Array<{ caminho: string; etiqueta: string }> = [
  { caminho: "/", etiqueta: "painel" },
  { caminho: "/movimentos", etiqueta: "movimentos" },
  { caminho: "/movimentos?mes=1", etiqueta: "movimentos-janeiro" },
  { caminho: "/quotas", etiqueta: "quotas" },
  { caminho: "/relatorios", etiqueta: "relatorios" },
  { caminho: "/recibos", etiqueta: "recibos" },
  { caminho: "/definicoes", etiqueta: "definicoes" },
  { caminho: "/definicoes/fracoes", etiqueta: "definicoes-fracoes" },
  { caminho: "/definicoes/contas", etiqueta: "definicoes-contas" },
  { caminho: "/definicoes/extratos", etiqueta: "definicoes-extratos" },
];

function carregarAmbiente() {
  const caminho = join(process.cwd(), ".env.local");
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(linha);
    if (m && m[2].trim() && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

function proximoNumero() {
  mkdirSync(PASTA, { recursive: true });
  const usados = readdirSync(PASTA)
    .map((n) => /^screenshot-(\d+)/.exec(n)?.[1])
    .filter(Boolean)
    .map(Number);
  return usados.length === 0 ? 1 : Math.max(...usados) + 1;
}

async function main() {
  carregarAmbiente();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !servico) throw new Error("Faltam as variáveis do Supabase.");

  const admin = createClient(url, servico, { auth: { persistSession: false } });

  const email = `captura-${randomUUID().slice(0, 8)}@exemplo.invalid`;
  const palavraPasse = randomBytes(24).toString("base64url");
  let idUtilizador: string | null = null;

  try {
    // --- Conta temporária -------------------------------------------------
    //
    // O gatilho cria qualquer utilizador novo como condómino, e a restrição
    // condomino_tem_fracao exige que um condómino tenha fração. Por isso é
    // preciso indicar uma nos metadados, mesmo para uma conta que a seguir
    // vai ser promovida a administração.
    const { data: fracoes } = await admin
      .from("fracoes")
      .select("id")
      .limit(1);
    const fracaoId = fracoes?.[0]?.id;
    if (!fracaoId) throw new Error("não há frações na base de dados.");

    const { data: criado, error: erroCriar } = await admin.auth.admin.createUser(
      {
        email,
        password: palavraPasse,
        email_confirm: true,
        user_metadata: { nome: "Captura de ecrã", fracao_id: fracaoId },
      },
    );
    if (erroCriar || !criado.user) {
      throw new Error(`criar utilizador: ${erroCriar?.message}`);
    }
    idUtilizador = criado.user.id;
    console.log(`Conta temporária criada: ${email}`);

    // O gatilho cria o perfil como condómino, porque já existe outro
    // utilizador. Para fotografar as páginas de administração é preciso
    // promovê-la.
    const { error: erroPapel } = await admin
      .from("profiles")
      .update({ papel: "admin", nome: "Captura de ecrã", fracao_id: null })
      .eq("id", idUtilizador);
    if (erroPapel) throw new Error(`promover: ${erroPapel.message}`);

    // --- Navegador --------------------------------------------------------
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    try {
      const pagina = await browser.newPage();
      await pagina.setViewport({
        width: 1440,
        height: 900,
        deviceScaleFactor: 2,
      });

      await pagina.goto(`${BASE}/entrar`, { waitUntil: "networkidle2" });
      await pagina.type("#email", email);
      await pagina.type("#palavra-passe", palavraPasse);
      await Promise.all([
        pagina.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
        pagina.click('button[type="submit"]'),
      ]);
      await new Promise((r) => setTimeout(r, 1500));

      if (pagina.url().includes("/entrar")) {
        const erro = await pagina
          .$eval('[role="alert"]', (e) => e.textContent)
          .catch(() => null);
        throw new Error(`não entrou na aplicação. ${erro ?? ""}`);
      }
      console.log("Sessão iniciada.\n");

      let numero = proximoNumero();
      for (const { caminho, etiqueta } of PAGINAS) {
        const resposta = await pagina.goto(`${BASE}${caminho}`, {
          waitUntil: "networkidle2",
          timeout: 60_000,
        });
        await pagina.evaluate(() => document.fonts.ready);
        await new Promise((r) => setTimeout(r, 500));

        const destino = join(PASTA, `screenshot-${numero}-${etiqueta}.png`);
        await pagina.screenshot({ path: destino, fullPage: true });
        console.log(`  ${resposta?.status()}  ${caminho.padEnd(24)} -> ${destino}`);
        numero++;
      }

      // O formulário de lançamento manual só aparece depois de clicado, por
      // isso precisa de uma captura própria.
      await pagina.goto(`${BASE}/movimentos?mes=1`, {
        waitUntil: "networkidle2",
      });
      const abriu = await pagina.evaluate(() => {
        const botao = [...document.querySelectorAll("button")].find((b) =>
          b.textContent?.includes("Lançar movimento à mão"),
        );
        if (!botao) return false;
        botao.click();
        return true;
      });

      if (abriu) {
        await new Promise((r) => setTimeout(r, 600));
        const destino = join(
          PASTA,
          `screenshot-${numero}-lancamento-manual.png`,
        );
        await pagina.screenshot({ path: destino, fullPage: true });
        console.log(`  ---  formulário de lançamento -> ${destino}`);
      } else {
        console.log("  ---  não encontrei o botão de lançamento manual");
      }
    } finally {
      await browser.close();
    }
  } finally {
    if (idUtilizador) {
      const { error } = await admin.auth.admin.deleteUser(idUtilizador);
      console.log(
        error
          ? `\nATENÇÃO: não consegui apagar a conta ${email}: ${error.message}`
          : `\nConta temporária ${email} apagada.`,
      );
    }
  }
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
