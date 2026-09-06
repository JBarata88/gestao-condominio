/**
 * Teste ponta a ponta: o recibo de quota usa o valor e a data do movimento.
 *
 *   npx tsx scripts/testar-recibos-quota.ts
 *
 * Cria um movimento de teste com um valor e uma data que não batem com
 * nenhum cálculo simples (quota mensal vezes meses), gera o recibo pela
 * interface, e confere que o ficheiro tem exactamente esse valor e essa
 * data, não a data de hoje nem quota×meses. Confirma também que o registo
 * fica gravado em "recibos" e que gerar duas vezes não duplica.
 *
 * Tudo o que é criado é apagado no fim.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import puppeteer from "puppeteer";
import { euros } from "../src/lib/formatos.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASTA_DOWNLOAD = join(process.cwd(), `_downloads-teste-${randomUUID().slice(0, 8)}`);

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

// --- leitura de .docx, igual à de verificar-recibos.ts ---------------------
async function lerTextoDocx(caminho: string): Promise<string[]> {
  const dados = readFileSync(caminho);
  const xml = extrairDoZip(dados, "word/document.xml");
  const paragrafos: string[] = [];
  for (const bloco of xml.split("<w:p")) {
    const textos = [...bloco.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]);
    if (textos.length === 0) continue;
    const linha = textos
      .join("")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    if (linha.trim()) paragrafos.push(linha);
  }
  return paragrafos;
}

function extrairDoZip(dados: Buffer, alvo: string): string {
  let deslocamento = 0;
  while (deslocamento < dados.length - 4) {
    if (dados.readUInt32LE(deslocamento) !== 0x04034b50) break;
    const metodo = dados.readUInt16LE(deslocamento + 8);
    const tamanhoComprimido = dados.readUInt32LE(deslocamento + 18);
    const tamanhoNome = dados.readUInt16LE(deslocamento + 26);
    const tamanhoExtra = dados.readUInt16LE(deslocamento + 28);
    const inicioNome = deslocamento + 30;
    const nome = dados.subarray(inicioNome, inicioNome + tamanhoNome).toString("utf8");
    const inicioDados = inicioNome + tamanhoNome + tamanhoExtra;
    const bruto = dados.subarray(inicioDados, inicioDados + tamanhoComprimido);
    if (nome === alvo) {
      return metodo === 0 ? bruto.toString("utf8") : inflateRawSync(bruto).toString("utf8");
    }
    deslocamento = inicioDados + tamanhoComprimido;
  }
  throw new Error(`Entrada ${alvo} não encontrada no ficheiro.`);
}

function normalizar(s: string): string {
  return s.replace(/[\s ]+/g, " ").trim();
}

let falhas = 0;
function verificar(descricao: string, condicao: boolean, detalhe = "") {
  if (condicao) console.log(`  ok    ${descricao}`);
  else {
    falhas++;
    console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

async function esperarFicheiro(pasta: string, timeoutMs = 15_000): Promise<string> {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const ficheiros = existsSync(pasta)
      ? readdirSync(pasta).filter((f) => !f.endsWith(".crdownload"))
      : [];
    if (ficheiros.length > 0) return join(pasta, ficheiros[0]);
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("o ficheiro não chegou a ser descarregado a tempo.");
}

async function main() {
  carregarAmbiente();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !servico) throw new Error("Faltam as variáveis do Supabase.");

  const admin = createClient(url, servico, { auth: { persistSession: false } });
  mkdirSync(PASTA_DOWNLOAD, { recursive: true });

  const { data: categorias } = await admin.from("categorias").select("id, nome");
  const catQuotas = categorias?.find((c) => c.nome === "Quotizações");
  if (!catQuotas) throw new Error("categoria Quotizações não encontrada");

  // Fração B: não tem nenhum movimento de quota real ainda, o que torna a
  // linha de teste inequívoca na tabela sem precisar de filtrar.
  const { data: fracaoB } = await admin
    .from("fracoes")
    .select("id, letra, condomino_nome")
    .eq("letra", "B")
    .maybeSingle();
  if (!fracaoB?.condomino_nome) {
    throw new Error("a fração B precisa de ter um condómino preenchido para este teste.");
  }

  // Valor e data que não coincidem com nenhum cálculo simples de
  // quota-mensal-vezes-meses, para o teste ser inequívoco.
  const VALOR_TESTE = 199;
  const DATA_TESTE = "2026-03-13";

  let idMovimento: string | null = null;
  let idUtilizador: string | null = null;

  try {
    const { data: movimento, error: erroMov } = await admin
      .from("movimentos")
      .insert({
        data: DATA_TESTE,
        categoria_id: catQuotas.id,
        descricao: "TESTE RECIBO EM LOTE",
        conta: "caixa",
        receita: VALOR_TESTE,
        fracao_id: fracaoB.id,
        quota_mes: "2026-01-01",
        quota_mes_fim: "2026-04-01",
      })
      .select("id")
      .single();
    if (erroMov || !movimento) throw new Error(`criar movimento: ${erroMov?.message}`);
    idMovimento = movimento.id;

    const email = `teste-recibos-${randomUUID().slice(0, 8)}@exemplo.invalid`;
    const palavraPasse = randomBytes(24).toString("base64url");
    const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
      email,
      password: palavraPasse,
      email_confirm: true,
      user_metadata: { nome: "Teste recibos", fracao_id: fracaoB.id },
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
      await pagina.setViewport({ width: 1440, height: 1400 });

      const cliente = await pagina.createCDPSession();
      await cliente.send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: PASTA_DOWNLOAD,
      });

      await pagina.goto(`${BASE}/entrar`, { waitUntil: "networkidle2" });
      await pagina.type("#email", email);
      await pagina.type("#palavra-passe", palavraPasse);
      await Promise.all([
        pagina.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
        pagina.click('button[type="submit"]'),
      ]);
      await new Promise((r) => setTimeout(r, 1200));

      console.log("=== Gerar o recibo pela interface ===\n");
      await pagina.goto(`${BASE}/recibos`, { waitUntil: "networkidle2" });

      const encontrouLinha = await pagina.evaluate((valorTexto) => {
        const linha = [...document.querySelectorAll("tbody tr")].find((tr) =>
          tr.textContent?.includes(valorTexto),
        );
        if (!linha) return false;
        const caixa = linha.querySelector('input[type="checkbox"]');
        (caixa as HTMLInputElement | null)?.click();
        return true;
      }, "199,00");
      verificar("encontrou a linha do pagamento de teste na tabela", encontrouLinha);

      const textoAntesDeGerar = await pagina.evaluate(() => document.body.innerText);
      verificar(
        "mostra o total escolhido antes de gerar",
        textoAntesDeGerar.includes("199,00"),
      );

      await pagina.evaluate(() => {
        const botao = [...document.querySelectorAll("button")].find((b) =>
          b.textContent?.includes("Gerar e descarregar"),
        );
        (botao as HTMLElement | undefined)?.click();
      });

      const ficheiro = await esperarFicheiro(PASTA_DOWNLOAD);
      console.log(`  ficheiro descarregado: ${ficheiro}`);

      const paragrafos = await lerTextoDocx(ficheiro);
      const textoCompleto = paragrafos.map(normalizar).join(" | ");
      console.log("\n--- Conteúdo do recibo ---");
      paragrafos.forEach((p) => console.log("  " + p));

      console.log("\n--- Verificação do conteúdo ---");
      verificar(
        "usa o valor do movimento (199 €), não um cálculo de quota",
        textoCompleto.includes("CENTO E NOVENTA E NOVE EUROS"),
      );
      verificar(
        "imprime 'Euros: 199,00 €'",
        textoCompleto.includes(`Euros: ${euros(199).replace(/\s/g, " ")}`) ||
          textoCompleto.includes("Euros: 199,00"),
      );
      verificar(
        "usa a data do movimento (13 de Março), não a data de hoje",
        textoCompleto.includes("13 DE MARÇO DE 2026"),
      );
      verificar(
        "expande o intervalo Jan-Abr em texto",
        textoCompleto.includes("JANEIRO") &&
          textoCompleto.includes("FEVEREIRO") &&
          textoCompleto.includes("MARÇO") &&
          textoCompleto.includes("ABRIL") &&
          textoCompleto.includes("2026"),
      );
      verificar(
        "menciona o condómino da fração B",
        textoCompleto.includes(fracaoB.condomino_nome!.split(" ")[0]),
      );

      console.log("\n=== Confirmar o registo em 'recibos' ===\n");
      const { data: reciboGravado } = await admin
        .from("recibos")
        .select("*")
        .eq("movimento_id", idMovimento)
        .maybeSingle();

      verificar("ficou um registo em recibos", reciboGravado !== null);
      if (reciboGravado) {
        verificar("com o valor certo", Number(reciboGravado.valor) === 199);
        verificar("com a data de emissão do movimento", reciboGravado.data_emissao === DATA_TESTE);
        verificar("com a fração certa", reciboGravado.fracao_id === fracaoB.id);
      }

      console.log("\n=== Gerar outra vez não duplica ===\n");
      await pagina.goto(`${BASE}/recibos`, { waitUntil: "networkidle2" });
      await pagina.evaluate((valorTexto) => {
        const linha = [...document.querySelectorAll("tbody tr")].find((tr) =>
          tr.textContent?.includes(valorTexto),
        );
        const caixa = linha?.querySelector('input[type="checkbox"]');
        (caixa as HTMLInputElement | null)?.click();
      }, "199,00");
      await pagina.evaluate(() => {
        const botao = [...document.querySelectorAll("button")].find((b) =>
          b.textContent?.includes("Gerar e descarregar"),
        );
        (botao as HTMLElement | undefined)?.click();
      });
      await esperarFicheiro(PASTA_DOWNLOAD); // Espera o segundo download
      await new Promise((r) => setTimeout(r, 800));

      const { data: recibosRepetidos } = await admin
        .from("recibos")
        .select("id")
        .eq("movimento_id", idMovimento);
      verificar(
        "continua a haver só um registo de recibo para este movimento",
        (recibosRepetidos ?? []).length === 1,
        `encontrei ${recibosRepetidos?.length}`,
      );

      console.log("\n=== A tabela assinala o pagamento como já tendo recibo ===\n");
      await pagina.goto(`${BASE}/recibos`, { waitUntil: "networkidle2" });
      const textoComRecibo = await pagina.evaluate(() => document.body.innerText);
      verificar("mostra a etiqueta 'já tem recibo'", textoComRecibo.includes("já tem recibo"));
    } finally {
      await browser.close();
    }
  } finally {
    if (idMovimento) {
      await admin.from("recibos").delete().eq("movimento_id", idMovimento);
      await admin.from("movimentos").delete().eq("id", idMovimento);
      console.log("\nMovimento e recibo de teste apagados.");
    }
    if (idUtilizador) {
      await admin.auth.admin.deleteUser(idUtilizador);
      console.log("Conta temporária apagada.");
    }
    rmSync(PASTA_DOWNLOAD, { recursive: true, force: true });
  }

  console.log(
    falhas === 0
      ? "\nTudo passou. O recibo de quota usa o valor e a data do movimento."
      : `\n${falhas} verificação(ões) falharam.`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
