/**
 * Teste ponta a ponta do lançamento manual de movimentos de caixa.
 *
 *   npx tsx scripts/testar-lancamento.ts
 *
 * Cria uma conta temporária de administração, lança um movimento pela
 * interface, confere que o saldo mudou, apaga-o pela interface e confirma que
 * a base ficou como estava. A conta é apagada no fim, aconteça o que
 * acontecer.
 *
 * Não deixa nada na base de dados. Se falhar a meio, diz o que ficou por
 * limpar.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer, { type Page } from "puppeteer";
import { euros, somar } from "../src/lib/formatos.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MARCADOR = `TESTE AUTOMATICO ${randomUUID().slice(0, 8)}`;
const VALOR = 33.33;

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

/** Clica no primeiro botão cujo texto contenha o que se pede. */
async function clicarBotao(pagina: Page, texto: string) {
  const clicou = await pagina.evaluate((t) => {
    const botoes = [...document.querySelectorAll("button")];
    const alvo = botoes.find((b) => b.textContent?.includes(t));
    if (!alvo) return false;
    alvo.click();
    return true;
  }, texto);
  if (!clicou) throw new Error(`não encontrei o botão "${texto}"`);
  await new Promise((r) => setTimeout(r, 400));
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

  const saldoCaixa = async () => {
    const { data } = await admin
      .from("movimentos")
      .select("receita, despesa")
      .eq("conta", "caixa");
    const linhas = (data ?? []) as Array<{ receita: number; despesa: number }>;
    return somar(
      linhas.map((l) => Number(l.receita) - Number(l.despesa)),
    );
  };

  const email = `teste-${randomUUID().slice(0, 8)}@exemplo.invalid`;
  const palavraPasse = randomBytes(24).toString("base64url");
  let idUtilizador: string | null = null;

  const antes = await saldoCaixa();
  console.log(`Movimento líquido de caixa antes: ${euros(antes)}\n`);

  try {
    const { data: fracoes } = await admin.from("fracoes").select("id").limit(1);
    const { data: criado, error: erroCriar } = await admin.auth.admin.createUser(
      {
        email,
        password: palavraPasse,
        email_confirm: true,
        user_metadata: { nome: "Teste", fracao_id: fracoes?.[0]?.id },
      },
    );
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
      await pagina.setViewport({ width: 1440, height: 1200 });

      await pagina.goto(`${BASE}/entrar`, { waitUntil: "networkidle2" });
      await pagina.type("#email", email);
      await pagina.type("#palavra-passe", palavraPasse);
      await Promise.all([
        pagina.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
        pagina.click('button[type="submit"]'),
      ]);
      await new Promise((r) => setTimeout(r, 1200));

      // --- Lançar ---------------------------------------------------------
      console.log("=== Lançar um movimento de caixa ===\n");
      await pagina.goto(`${BASE}/movimentos`, { waitUntil: "networkidle2" });

      await clicarBotao(pagina, "Lançar movimento à mão");
      verificar(
        "o formulário abre",
        (await pagina.$("#valor-caixa")) !== null,
      );

      await pagina.type("#valor-caixa", "33,33");
      await pagina.type("#descricao-caixa", MARCADOR);
      const categorias = await pagina.$$eval(
        "#categoria-caixa option",
        (os) =>
          os
            .map((o) => ({ valor: (o as HTMLOptionElement).value, texto: o.textContent ?? "" }))
            .filter((o) => o.valor !== ""),
      );
      const limpeza =
        categorias.find((c) => c.texto.includes("Materiais de limpeza")) ??
        categorias[0];
      await pagina.select("#categoria-caixa", limpeza.valor);
      console.log(`  (categoria escolhida: ${limpeza.texto.trim()})`);

      await Promise.all([
        pagina.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
        clicarBotao(pagina, "Lançar movimento"),
      ]);
      await new Promise((r) => setTimeout(r, 1800));

      // --- Confirmar na base de dados -------------------------------------
      const { data: gravado } = await admin
        .from("movimentos")
        .select("id, conta, receita, despesa, descricao, extrato_linha_id")
        .eq("descricao", MARCADOR);

      const linhas = (gravado ?? []) as Array<{
        id: string;
        conta: string;
        despesa: number;
        extrato_linha_id: string | null;
      }>;

      verificar("o movimento ficou gravado", linhas.length === 1,
        `encontrei ${linhas.length}`);
      if (linhas.length === 1) {
        verificar("ficou na conta caixa", linhas[0].conta === "caixa");
        verificar(
          "ficou como despesa de 33,33",
          Number(linhas[0].despesa) === VALOR,
          String(linhas[0].despesa),
        );
        verificar(
          "não ficou ligado a nenhum extrato",
          linhas[0].extrato_linha_id === null,
        );
      }

      const depois = await saldoCaixa();
      verificar(
        "o saldo de caixa desceu 33,33",
        depois === somar([antes, -VALOR]),
        `${euros(antes)} -> ${euros(depois)}`,
      );

      // --- Aparece na página ----------------------------------------------
      await pagina.goto(`${BASE}/movimentos`, { waitUntil: "networkidle2" });
      const textoPagina = await pagina.evaluate(() => document.body.innerText);
      verificar("aparece na tabela de caixa", textoPagina.includes(MARCADOR));

      // --- Apagar pela interface ------------------------------------------
      console.log("\n=== Apagar pela interface ===\n");
      const abriuConfirmacao = await pagina.evaluate((marcador) => {
        const linha = [...document.querySelectorAll("tr")].find((tr) =>
          tr.textContent?.includes(marcador),
        );
        if (!linha) return false;
        const botao = [...linha.querySelectorAll("button")].find((b) =>
          b.textContent?.includes("Apagar"),
        );
        if (!botao) return false;
        botao.click();
        return true;
      }, MARCADOR);
      verificar("a linha tem botão de apagar", abriuConfirmacao);
      await new Promise((r) => setTimeout(r, 400));

      await Promise.all([
        pagina.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
        pagina.evaluate((marcador) => {
          const linha = [...document.querySelectorAll("tr")].find((tr) =>
            tr.textContent?.includes(marcador),
          );
          const botao = [...(linha?.querySelectorAll("button") ?? [])].find((b) =>
            b.textContent?.includes("Confirmar"),
          );
          botao?.click();
        }, MARCADOR),
      ]);
      await new Promise((r) => setTimeout(r, 1800));

      const { data: sobrou } = await admin
        .from("movimentos")
        .select("id")
        .eq("descricao", MARCADOR);
      verificar(
        "o movimento foi apagado",
        (sobrou ?? []).length === 0,
        `sobraram ${(sobrou ?? []).length}`,
      );

      const final = await saldoCaixa();
      verificar(
        "o saldo voltou ao valor inicial",
        final === antes,
        `${euros(final)} vs ${euros(antes)}`,
      );
    } finally {
      await browser.close();
    }
  } finally {
    // Rede de segurança: se o teste falhou antes de apagar, limpa à mesma.
    const { data: restos } = await admin
      .from("movimentos")
      .select("id")
      .eq("descricao", MARCADOR);
    if ((restos ?? []).length > 0) {
      await admin.from("movimentos").delete().eq("descricao", MARCADOR);
      console.log(`\nLimpei ${(restos ?? []).length} movimento(s) de teste.`);
    }
    if (idUtilizador) {
      await admin.auth.admin.deleteUser(idUtilizador);
      console.log(`Conta temporária apagada.`);
    }
  }

  console.log(
    falhas === 0
      ? "\nTudo passou. O lançamento manual funciona ponta a ponta."
      : `\n${falhas} verificação(ões) falharam.`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
