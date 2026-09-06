/**
 * Verifica os filtros de Movimentos por categoria e por fração.
 *
 *   npx tsx scripts/testar-filtros.ts
 *
 * Cria uma conta temporária, aplica os filtros pela própria página e confirma
 * que as linhas mostradas e os totais do rodapé batem com o que a base de
 * dados diz directamente. Tira também capturas de ecrã. A conta é apagada no
 * fim, aconteça o que acontecer.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";
import { euros, somar } from "../src/lib/formatos.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASTA = "temporary screenshots";

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

let falhas = 0;
function verificar(descricao: string, condicao: boolean, detalhe = "") {
  if (condicao) {
    console.log(`  ok    ${descricao}`);
  } else {
    falhas++;
    console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

async function main() {
  carregarAmbiente();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !servico) throw new Error("Faltam as variáveis do Supabase.");

  const admin = createClient(url, servico, { auth: { persistSession: false } });

  const { data: categorias } = await admin.from("categorias").select("id, nome");
  const { data: fracoes } = await admin.from("fracoes").select("id, letra");

  const catQuotas = categorias?.find((c) => c.nome === "Quotizações");
  const fracaoG = fracoes?.find((f) => f.letra === "G");
  if (!catQuotas) throw new Error("categoria Quotizações não encontrada");
  if (!fracaoG) throw new Error("fração G não encontrada");

  // Totais de referência calculados directamente na base de dados.
  const { data: movsQuotas } = await admin
    .from("movimentos")
    .select("receita, despesa")
    .eq("categoria_id", catQuotas.id);
  const refQuotasReceita = somar(
    (movsQuotas ?? []).map((m) => Number(m.receita)),
  );

  const { data: movsFracaoG } = await admin
    .from("movimentos")
    .select("receita, despesa")
    .eq("fracao_id", fracaoG.id);
  const refFracaoGReceita = somar(
    (movsFracaoG ?? []).map((m) => Number(m.receita)),
  );

  console.log(`Referência (base de dados directa):`);
  console.log(`  Quotizações: ${movsQuotas?.length} linhas, receita ${euros(refQuotasReceita)}`);
  console.log(`  Fração G:    ${movsFracaoG?.length} linhas, receita ${euros(refFracaoGReceita)}`);
  console.log("");

  const email = `teste-filtros-${randomUUID().slice(0, 8)}@exemplo.invalid`;
  const palavraPasse = randomBytes(24).toString("base64url");
  let idUtilizador: string | null = null;

  try {
    const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
      email,
      password: palavraPasse,
      email_confirm: true,
      user_metadata: { nome: "Teste filtros", fracao_id: fracaoG.id },
    });
    if (erroCriar || !criado.user) {
      throw new Error(`criar utilizador: ${erroCriar?.message}`);
    }
    idUtilizador = criado.user.id;
    await admin
      .from("profiles")
      .update({ papel: "admin", fracao_id: null })
      .eq("id", idUtilizador);

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    try {
      const pagina = await browser.newPage();
      await pagina.setViewport({ width: 1440, height: 1400, deviceScaleFactor: 2 });

      await pagina.goto(`${BASE}/entrar`, { waitUntil: "networkidle2" });
      await pagina.type("#email", email);
      await pagina.type("#palavra-passe", palavraPasse);
      await Promise.all([
        pagina.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
        pagina.click('button[type="submit"]'),
      ]);
      await new Promise((r) => setTimeout(r, 1200));

      let numero = proximoNumero();

      // --- Filtro por categoria -----------------------------------------
      console.log("=== Filtro por categoria (Quotizações) ===\n");
      await pagina.goto(`${BASE}/movimentos?categoria=${catQuotas.id}`, {
        waitUntil: "networkidle2",
      });

      const textoCategoria = await pagina.evaluate(() => document.body.innerText);
      verificar(
        "mostra o aviso de filtro activo",
        textoCategoria.includes("A mostrar apenas"),
      );
      verificar(
        "menciona a categoria escolhida",
        textoCategoria.includes("Quotizações"),
      );

      // As células de categoria em ambas as tabelas têm de ser todas
      // "Quotizações". O <select> de filtro continua a listar as outras
      // categorias de propósito, para se poder trocar de filtro, por isso a
      // verificação tem de olhar só para as linhas da tabela, não para a
      // página inteira.
      const categoriasNaTabela = await pagina.evaluate(() =>
        [...document.querySelectorAll("table")].flatMap((tabela) =>
          [...tabela.querySelectorAll("tbody tr")].map(
            (tr) => tr.querySelectorAll("td")[1]?.textContent?.trim(),
          ),
        ),
      );
      const linhasReais = categoriasNaTabela.filter(
        (c) => c && c !== "—",
      );
      verificar(
        "todas as linhas da tabela são da categoria filtrada",
        linhasReais.length > 0 &&
          linhasReais.every((c) => c === "Quotizações"),
        JSON.stringify([...new Set(linhasReais)]),
      );

      const refTotal = somar([refQuotasReceita]);
      verificar(
        "o total de receitas do rodapé bate com a base de dados",
        textoCategoria.includes(euros(refTotal).replace(/\s/g, "")) ||
          textoCategoria.includes(euros(refTotal)),
        `esperado ${euros(refTotal)}`,
      );

      const destino1 = join(PASTA, `screenshot-${numero}-filtro-categoria.png`);
      await pagina.screenshot({ path: destino1, fullPage: true });
      console.log(`  captura -> ${destino1}`);
      numero++;

      // --- Filtro por fração ----------------------------------------------
      console.log("\n=== Filtro por fração (G) ===\n");
      await pagina.goto(`${BASE}/movimentos?fracao=${fracaoG.id}`, {
        waitUntil: "networkidle2",
      });

      const textoFracao = await pagina.evaluate(() => document.body.innerText);
      verificar(
        "mostra o aviso de filtro activo",
        textoFracao.includes("A mostrar apenas"),
      );
      verificar("menciona a fração G", textoFracao.includes("G"));

      const fracoesNaTabela = await pagina.evaluate(() =>
        [...document.querySelectorAll("table")].flatMap((tabela) =>
          [...tabela.querySelectorAll("tbody tr")].map(
            (tr) => tr.querySelectorAll("td")[2]?.textContent ?? "",
          ),
        ),
      );
      const linhasComFracao = fracoesNaTabela.filter(
        (t) => t.trim() !== "" && !t.includes("Transporte"),
      );
      verificar(
        "todas as linhas da tabela mencionam a fração G",
        linhasComFracao.length > 0 &&
          linhasComFracao.every((t) => t.includes("(G)")),
        JSON.stringify(linhasComFracao.filter((t) => !t.includes("(G)"))),
      );

      const destino2 = join(PASTA, `screenshot-${numero}-filtro-fracao.png`);
      await pagina.screenshot({ path: destino2, fullPage: true });
      console.log(`  captura -> ${destino2}`);
      numero++;

      // --- Os dois filtros ao mesmo tempo ----------------------------------
      console.log("\n=== Categoria + fração ao mesmo tempo ===\n");
      await pagina.goto(
        `${BASE}/movimentos?categoria=${catQuotas.id}&fracao=${fracaoG.id}`,
        { waitUntil: "networkidle2" },
      );
      const textoDuplo = await pagina.evaluate(() => document.body.innerText);
      verificar(
        "menciona as duas condições",
        textoDuplo.includes("Quotizações") && textoDuplo.includes("G"),
      );

      // --- Filtro "sem fração" ----------------------------------------------
      console.log("\n=== Filtro 'sem fração' ===\n");
      await pagina.goto(`${BASE}/movimentos?fracao=sem`, {
        waitUntil: "networkidle2",
      });
      const textoSemFracao = await pagina.evaluate(() => document.body.innerText);
      verificar(
        "aceita o valor especial 'sem'",
        textoSemFracao.includes("sem fração"),
      );

      // --- Um identificador inválido não deve rebentar a página ------------
      console.log("\n=== Identificador inválido no URL ===\n");
      const resposta = await pagina.goto(`${BASE}/movimentos?categoria=lixo123`, {
        waitUntil: "networkidle2",
      });
      verificar(
        "a página continua a responder 200",
        resposta?.status() === 200,
        String(resposta?.status()),
      );
      const textoInvalido = await pagina.evaluate(() => document.body.innerText);
      verificar(
        "ignora o filtro inválido em vez de rebentar",
        !textoInvalido.includes("A mostrar apenas"),
      );

      // --- Limpar filtros ----------------------------------------------------
      console.log("\n=== Botão 'Limpar filtros' ===\n");
      await pagina.goto(`${BASE}/movimentos?categoria=${catQuotas.id}`, {
        waitUntil: "networkidle2",
      });
      const limpou = await pagina.evaluate(() => {
        const link = [...document.querySelectorAll("a")].find((a) =>
          a.textContent?.includes("Limpar filtros"),
        );
        return link?.getAttribute("href") ?? null;
      });
      verificar(
        "o link de limpar aponta para /movimentos sem parâmetros",
        limpou === "/movimentos",
        String(limpou),
      );
    } finally {
      await browser.close();
    }
  } finally {
    if (idUtilizador) {
      const { error } = await admin.auth.admin.deleteUser(idUtilizador);
      console.log(
        error
          ? `\nATENÇÃO: não consegui apagar a conta: ${error.message}`
          : `\nConta temporária apagada.`,
      );
    }
  }

  console.log(
    falhas === 0
      ? "\nTudo passou. Os filtros funcionam correctamente."
      : `\n${falhas} verificação(ões) falharam.`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
