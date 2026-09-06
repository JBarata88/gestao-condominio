/**
 * Teste ponta a ponta das três peças ligadas ao problema das Quotas:
 *
 *   A. Editar um movimento existente (vindo de um extrato real) para lhe
 *      corrigir o mês da quota, e confirmar que passa a aparecer em Quotas.
 *   B. Registar um pagamento directamente a partir da página de Quotas.
 *   C. Importar um extrato novo em que o reconhecimento automático falha, e
 *      confirmar que o ecrã de revisão grava o mês escolhido à mão.
 *
 * Tudo o que é criado é apagado no fim. O teste A edita um movimento real e
 * devolve-o exactamente ao estado em que estava.
 *
 *   npx tsx scripts/testar-edicao-quotas.ts
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import puppeteer, { type Page } from "puppeteer";
import { euros } from "../src/lib/formatos.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

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

let falhas = 0;
function verificar(descricao: string, condicao: boolean, detalhe = "") {
  if (condicao) console.log(`  ok    ${descricao}`);
  else {
    falhas++;
    console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

async function clicar(pagina: Page, texto: string, dentroDe = "button") {
  const clicou = await pagina.evaluate(
    (t, sel) => {
      const els = [...document.querySelectorAll(sel)];
      const alvo = els.find((b) => b.textContent?.includes(t));
      if (!alvo) return false;
      (alvo as HTMLElement).click();
      return true;
    },
    texto,
    dentroDe,
  );
  if (!clicou) throw new Error(`não encontrei "${texto}" em ${dentroDe}`);
  await new Promise((r) => setTimeout(r, 400));
}

async function main() {
  carregarAmbiente();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !servico) throw new Error("Faltam as variáveis do Supabase.");

  const admin = createClient(url, servico, { auth: { persistSession: false } });

  const email = `teste-quotas-${randomUUID().slice(0, 8)}@exemplo.invalid`;
  const palavraPasse = randomBytes(24).toString("base64url");
  let idUtilizador: string | null = null;
  let idExtratoTeste: string | null = null;
  const ficheiroTemp = join(process.cwd(), `_teste-extrato-${randomUUID().slice(0, 8)}.csv`);

  try {
    const { data: fracoes } = await admin
      .from("fracoes")
      .select("id, letra, quota_mensal")
      .order("ordem");
    if (!fracoes || fracoes.length === 0) throw new Error("sem frações na base de dados");

    const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
      email,
      password: palavraPasse,
      email_confirm: true,
      user_metadata: { nome: "Teste quotas", fracao_id: fracoes[0].id },
    });
    if (erroCriar || !criado.user) throw new Error(`criar utilizador: ${erroCriar?.message}`);
    idUtilizador = criado.user.id;
    await admin.from("profiles").update({ papel: "admin", fracao_id: null }).eq("id", idUtilizador);

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    try {
      const pagina = await browser.newPage();
      await pagina.setViewport({ width: 1440, height: 1400, deviceScaleFactor: 1 });

      await pagina.goto(`${BASE}/entrar`, { waitUntil: "networkidle2" });
      await pagina.type("#email", email);
      await pagina.type("#palavra-passe", palavraPasse);
      await Promise.all([
        pagina.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
        pagina.click('button[type="submit"]'),
      ]);
      await new Promise((r) => setTimeout(r, 1200));

      // =======================================================================
      console.log("=== A. Editar um movimento real para lhe pôr o mês da quota ===\n");

      const { data: categorias } = await admin.from("categorias").select("id, nome");
      const catQuotas = categorias?.find((c) => c.nome === "Quotizações");
      if (!catQuotas) throw new Error("categoria Quotizações não encontrada");

      const { data: quebrados } = await admin
        .from("movimentos")
        .select(
          "id, data, descricao, receita, despesa, fracao_id, categoria_id, quota_mes, extrato_linha_id",
        )
        .eq("categoria_id", catQuotas.id)
        .not("fracao_id", "is", null)
        .is("quota_mes", null)
        .not("extrato_linha_id", "is", null)
        .limit(1);

      if (!quebrados || quebrados.length === 0) {
        console.log(
          "  (nenhum movimento nesse estado — talvez já tenham sido corrigidos; a saltar o teste A)",
        );
      } else {
        const alvo = quebrados[0];
        const original = { ...alvo };
        console.log(
          `  Movimento escolhido: ${alvo.data}  ${euros(Number(alvo.receita))}  "${alvo.descricao}"`,
        );

        const mesEscolhido = `${alvo.data.slice(0, 4)}-${alvo.data.slice(5, 7)}`;

        await pagina.goto(`${BASE}/movimentos`, { waitUntil: "networkidle2" });

        // Encontra a linha certa e clica em "Editar".
        const encontrou = await pagina.evaluate((descricao) => {
          const linha = [...document.querySelectorAll("tr")].find((tr) =>
            tr.textContent?.includes(descricao ?? "###nunca###"),
          );
          if (!linha) return false;
          const botao = [...linha.querySelectorAll("button")].find((b) =>
            b.textContent?.includes("Editar"),
          );
          if (!botao) return false;
          (botao as HTMLElement).click();
          return true;
        }, alvo.descricao);
        verificar("encontrou a linha e o botão Editar", encontrou);
        await new Promise((r) => setTimeout(r, 400));

        verificar(
          "o aviso de movimento vindo de extrato aparece",
          (await pagina.evaluate(() => document.body.innerText)).includes(
            "veio de um extrato bancário",
          ),
        );

        const selectMes = await pagina.$(`#mes-${alvo.id}`);
        verificar("o campo de mês da quota aparece no formulário", selectMes !== null);

        if (selectMes) {
          await pagina.select(`#mes-${alvo.id}`, mesEscolhido);
          await Promise.all([
            pagina.waitForNetworkIdle({ idleTime: 500 }).catch(() => {}),
            clicar(pagina, "Guardar"),
          ]);
          await new Promise((r) => setTimeout(r, 1200));
        }

        const { data: depois } = await admin
          .from("movimentos")
          .select("quota_mes")
          .eq("id", alvo.id)
          .maybeSingle();
        verificar(
          "a base de dados ficou com o novo mês da quota",
          depois?.quota_mes === `${mesEscolhido}-01`,
          `${depois?.quota_mes}`,
        );

        // Confirma que passou a contar em Quotas.
        await pagina.goto(`${BASE}/quotas`, { waitUntil: "networkidle2" });
        const { data: fracaoAlvo } = await admin
          .from("fracoes")
          .select("letra")
          .eq("id", alvo.fracao_id)
          .maybeSingle();
        const textoQuotas = await pagina.evaluate(() => document.body.innerText);
        verificar(
          `a página de Quotas menciona a fração ${fracaoAlvo?.letra}`,
          textoQuotas.includes(fracaoAlvo?.letra ?? "###"),
        );

        // --- Repor o estado original, para não alterar dados reais. -----------
        await pagina.goto(`${BASE}/movimentos`, { waitUntil: "networkidle2" });
        await pagina.evaluate((descricao) => {
          const linha = [...document.querySelectorAll("tr")].find((tr) =>
            tr.textContent?.includes(descricao ?? "###nunca###"),
          );
          const botao = [...(linha?.querySelectorAll("button") ?? [])].find((b) =>
            b.textContent?.includes("Editar"),
          );
          (botao as HTMLElement | undefined)?.click();
        }, alvo.descricao);
        await new Promise((r) => setTimeout(r, 400));
        const selectMesRepor = await pagina.$(`#mes-${alvo.id}`);
        if (selectMesRepor) {
          await pagina.select(`#mes-${alvo.id}`, "");
        }
        await Promise.all([
          pagina.waitForNetworkIdle({ idleTime: 500 }).catch(() => {}),
          clicar(pagina, "Guardar"),
        ]);
        await new Promise((r) => setTimeout(r, 1200));

        const { data: restaurado } = await admin
          .from("movimentos")
          .select("quota_mes, fracao_id, categoria_id, data, descricao, receita, despesa")
          .eq("id", alvo.id)
          .maybeSingle();
        verificar(
          "o movimento voltou exactamente ao estado original",
          restaurado?.quota_mes === null &&
            restaurado?.fracao_id === original.fracao_id &&
            restaurado?.categoria_id === original.categoria_id &&
            restaurado?.data === original.data &&
            Number(restaurado?.receita) === Number(original.receita) &&
            Number(restaurado?.despesa) === Number(original.despesa),
          JSON.stringify(restaurado),
        );
      }

      // =======================================================================
      console.log("\n=== B. Registar um pagamento a partir de Quotas ===\n");

      const fracaoTeste = fracoes[0];
      const marcador = `TESTE-QUOTAS-${randomUUID().slice(0, 8)}`;

      await pagina.goto(`${BASE}/quotas`, { waitUntil: "networkidle2" });
      await clicar(pagina, "Registar pagamento");
      await new Promise((r) => setTimeout(r, 400));

      verificar(
        "o formulário de registo abre",
        (await pagina.$("#rp-fracao")) !== null,
      );

      await pagina.select("#rp-fracao", fracaoTeste.id);
      await pagina.select("#rp-mes", "2026-05");
      await pagina.evaluate(() => {
        const el = document.querySelector<HTMLInputElement>("#rp-valor");
        if (el) el.value = "";
      });
      await pagina.type("#rp-valor", "12,34");
      await pagina.type("#rp-descricao", marcador);

      await Promise.all([
        pagina.waitForNetworkIdle({ idleTime: 500 }).catch(() => {}),
        clicar(pagina, "Registar pagamento"),
      ]);
      await new Promise((r) => setTimeout(r, 1200));

      const { data: registado } = await admin
        .from("movimentos")
        .select("id, receita, quota_mes, fracao_id, conta")
        .eq("descricao", marcador);

      verificar("o pagamento ficou gravado", (registado ?? []).length === 1);
      if (registado && registado.length === 1) {
        verificar("com o valor certo", Number(registado[0].receita) === 12.34);
        verificar("com o mês certo", registado[0].quota_mes === "2026-05-01");
        verificar("com a fração certa", registado[0].fracao_id === fracaoTeste.id);
        verificar("na conta banco por omissão", registado[0].conta === "banco");

        await admin.from("movimentos").delete().eq("id", registado[0].id);
        console.log("  (limpo)");
      }

      // =======================================================================
      console.log("\n=== C. Importar um extrato em que a fração falha e corrigir o mês ===\n");

      const csv =
        "Data mov;Descrição;Importância\n" +
        "2026-06-15;PAGAMENTO SEM NOME RECONHECIVEL;40,00\n";
      writeFileSync(ficheiroTemp, csv, "utf8");

      await pagina.goto(`${BASE}/extratos`, { waitUntil: "networkidle2" });
      const input = await pagina.$('input[type="file"]');
      if (!input) throw new Error("não encontrei o campo de ficheiro");
      await input.uploadFile(ficheiroTemp);
      await Promise.all([
        pagina.waitForNetworkIdle({ idleTime: 500 }).catch(() => {}),
        clicar(pagina, "Ler ficheiro"),
      ]);
      await new Promise((r) => setTimeout(r, 800));

      verificar(
        "a linha aparece sem categoria (reconhecimento falhou de propósito)",
        (await pagina.evaluate(() => document.body.innerText)).includes("1 linhas lidas"),
      );

      // Sem categoria escolhida ainda, a coluna do mês mostra "—".
      const semMesAntes = await pagina.evaluate(() => {
        const linha = document.querySelector("tbody tr");
        return linha?.querySelectorAll("td")[6]?.textContent?.trim();
      });
      verificar("sem categoria, a coluna do mês mostra —", semMesAntes === "—");

      // Escolhe Quotizações na categoria da primeira (única) linha.
      await pagina.select('select[aria-label="Categoria"]', catQuotas.id);
      await new Promise((r) => setTimeout(r, 300));

      const mesSugerido = await pagina.$eval(
        'select[aria-label="Mês da quota"]',
        (s) => (s as HTMLSelectElement).value,
      );
      verificar(
        "o mês vem pré-preenchido com o mês da própria data do movimento",
        mesSugerido === "2026-06-01",
        mesSugerido,
      );

      await pagina.select('select[aria-label="Fração"]', fracaoTeste.id);
      await pagina.evaluate(() => {
        const cb = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (cb && !cb.checked) cb.click();
      });

      await Promise.all([
        pagina.waitForNetworkIdle({ idleTime: 500 }).catch(() => {}),
        clicar(pagina, "Gravar 1 movimento"),
      ]);
      await new Promise((r) => setTimeout(r, 1200));

      const { data: importado } = await admin
        .from("movimentos")
        .select("id, quota_mes, fracao_id, categoria_id, extrato_linha_id")
        .eq("descricao", "PAGAMENTO SEM NOME RECONHECIVEL");

      verificar("o movimento importado existe", (importado ?? []).length === 1);
      if (importado && importado.length === 1) {
        verificar("com o mês escolhido no ecrã", importado[0].quota_mes === "2026-06-01");
        verificar("com a fração escolhida", importado[0].fracao_id === fracaoTeste.id);
        verificar("com a categoria Quotizações", importado[0].categoria_id === catQuotas.id);
        idExtratoTeste = importado[0].extrato_linha_id;
      }
    } finally {
      await browser.close();
    }
  } finally {
    // Limpeza: o movimento de teste C, a linha de extrato e o extrato em si.
    const { data: sobras } = await admin
      .from("movimentos")
      .select("id, extrato_linha_id")
      .eq("descricao", "PAGAMENTO SEM NOME RECONHECIVEL");
    for (const s of sobras ?? []) {
      await admin.from("movimentos").delete().eq("id", s.id);
    }
    if (idExtratoTeste) {
      const { data: linhaExtrato } = await admin
        .from("extrato_linhas")
        .select("extrato_id")
        .eq("id", idExtratoTeste)
        .maybeSingle();
      await admin.from("extrato_linhas").delete().eq("id", idExtratoTeste);
      if (linhaExtrato?.extrato_id) {
        await admin.from("extratos").delete().eq("id", linhaExtrato.extrato_id);
      }
    }
    if (existsSync(ficheiroTemp)) unlinkSync(ficheiroTemp);

    if (idUtilizador) {
      await admin.auth.admin.deleteUser(idUtilizador);
      console.log("\nConta temporária apagada.");
    }
  }

  console.log(
    falhas === 0
      ? "\nTudo passou. A edição de movimentos e o registo de quotas funcionam."
      : `\n${falhas} verificação(ões) falharam.`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
