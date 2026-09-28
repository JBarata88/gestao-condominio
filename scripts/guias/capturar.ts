/**
 * Capturas de ecrã anotadas para os guias em PDF.
 *
 *   npx tsx scripts/guias/capturar.ts            # todas
 *   npx tsx scripts/guias/capturar.ts painel     # só as que começam por "painel"
 *
 * Tal como scripts/capturar-paginas.ts, cria duas contas temporárias (uma de
 * condómino e uma de administração), entra com elas, fotografa e apaga-as no
 * fim, aconteça o que acontecer. Nada é gravado na aplicação: só se abrem
 * formulários, nunca se submetem.
 *
 * Antes de cada fotografia, os dados pessoais visíveis (nomes dos condóminos,
 * emails, telefones, IBAN, NIB, NIF) são trocados no ecrã por texto genérico,
 * porque os PDFs são para distribuir.
 *
 * Para cada captura grava um PNG e um JSON com a posição das marcas, em
 * "temporary screenshots/guias/". O gerar-pdf.ts junta tudo.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer, { type Page } from "puppeteer";
import { CAPTURAS, type Alvo, type Captura } from "./capturas";

const PASTA = join("temporary screenshots", "guias");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

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

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Anonimização
// ---------------------------------------------------------------------------
type Substituicao = { de: string; para: string };

async function anonimizar(pagina: Page, trocas: Substituicao[], palavras: string[]) {
  await pagina.evaluate((trocas: Substituicao[], palavras: string[]) => {
    // O indicador do modo de desenvolvimento do Next não faz parte da app.
    document.querySelectorAll("nextjs-portal").forEach((e) => e.remove());

    const normal = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const soltas = new Set(palavras.map(normal));
    /** Um texto com parte de um nome (ex.: descrição do banco "TRF JOAO SILVA") é trocado inteiro. */
    const temParteDeNome = (s: string) => (s.match(/\p{L}+/gu) ?? []).some((p) => soltas.has(normal(p)));
    const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Emails, IBAN, NIB e NIF primeiro, antes de os nomes os partirem.
    const regras: Array<[RegExp, string]> = [
      [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "condomino@exemplo.pt"],
      [/\bPT50[\d ]{10,}\b/gi, "PT50 0000 0000 0000 0000 0000 0"],
      [/(?<![\d,.])\d{4} ?\d{4} ?\d{11} ?\d{2}(?![\d,.])/g, "0000 0000 0000 0000 0000 0"],
      [/(?<![\d,.])\d{3} ?\d{3} ?\d{3}(?![\d,.])/g, "500 000 000"],
      ...trocas
        .filter((t) => t.de.trim().length >= 3)
        .sort((a, b) => b.de.length - a.de.length)
        .map((t): [RegExp, string] => [
          new RegExp(`(?<![\\p{L}])${escapar(t.de)}(?![\\p{L}])`, "giu"),
          t.para,
        ]),
    ];

    const trocar = (s: string) => {
      const t = regras.reduce((t, [re, para]) => t.replace(re, para), s);
      return temParteDeNome(t) ? "Nome do condómino" : t;
    };

    const andar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let no: Node | null;
    while ((no = andar.nextNode())) {
      const antes = no.nodeValue ?? "";
      const depois = trocar(antes);
      if (depois !== antes) no.nodeValue = depois;
    }
    for (const campo of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input, textarea",
    )) {
      if (campo.type === "hidden" || campo.type === "checkbox" || campo.type === "radio") continue;
      const depois = trocar(campo.value);
      if (depois !== campo.value) campo.value = depois;
      if (campo.placeholder) campo.placeholder = trocar(campo.placeholder);
    }
    for (const opcao of document.querySelectorAll("option")) {
      opcao.textContent = trocar(opcao.textContent ?? "");
    }
  }, trocas, palavras);
}

// ---------------------------------------------------------------------------
// Localizar elementos
// ---------------------------------------------------------------------------
type Caixa = { x: number; y: number; w: number; h: number };

/** Posição de um elemento no documento (não na janela), em px CSS. */
async function caixaDe(pagina: Page, alvo: Alvo): Promise<Caixa | null> {
  return pagina.evaluate((a: Alvo) => {
    const limpo = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
    const visivel = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const raiz: ParentNode = a.dentro
      ? (document.querySelectorAll(a.dentro)[a.dentroNth ?? 0] ?? document)
      : document;

    let el: Element | null | undefined = null;
    if (a.seletor) {
      el = [...raiz.querySelectorAll(a.seletor)].filter(visivel)[a.nth ?? 0];
    } else if (a.texto) {
      const bate = (e: Element) =>
        a.exato ? limpo(e.textContent) === a.texto : limpo(e.textContent).includes(a.texto!);
      const todos = [...raiz.querySelectorAll(a.tag ?? "*")].filter((e) => visivel(e) && bate(e));
      // Os mais profundos: os que não têm um filho que também bata.
      const folhas = todos.filter((e) => ![...e.querySelectorAll(a.tag ?? "*")].some((f) => todos.includes(f)));
      el = folhas[a.nth ?? 0];
    }
    if (!el) return null;
    if (a.perto) el = el.closest(a.perto) ?? el;
    for (let i = 0; i < (a.subir ?? 0) && el.parentElement; i++) el = el.parentElement;

    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
  }, alvo);
}

// ---------------------------------------------------------------------------
// Contas temporárias
// ---------------------------------------------------------------------------
type Conta = { id: string; email: string; palavraPasse: string };

async function criarConta(
  admin: SupabaseClient,
  papel: "admin" | "condomino",
  fracaoId: string,
): Promise<Conta> {
  const email = `guia-${papel}-${randomUUID().slice(0, 8)}@exemplo.invalid`;
  const palavraPasse = randomBytes(24).toString("base64url");
  const nome = papel === "admin" ? "Administração" : "Condómino Exemplo";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: palavraPasse,
    email_confirm: true,
    user_metadata: { nome, fracao_id: fracaoId },
  });
  if (error || !data.user) throw new Error(`criar ${papel}: ${error?.message}`);

  // O gatilho cria o perfil como condómino; a de administração é promovida.
  const { error: erroPerfil } = await admin
    .from("profiles")
    .update(papel === "admin" ? { papel: "admin", nome, fracao_id: null } : { nome })
    .eq("id", data.user.id);
  if (erroPerfil) throw new Error(`perfil ${papel}: ${erroPerfil.message}`);

  return { id: data.user.id, email, palavraPasse };
}

async function entrar(pagina: Page, conta: Conta) {
  await pagina.goto(`${BASE}/entrar`, { waitUntil: "networkidle2" });
  await pagina.type("#email", conta.email);
  await pagina.type("#palavra-passe", conta.palavraPasse);
  await Promise.all([
    pagina.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
    pagina.click('button[type="submit"]'),
  ]);
  await espera(1500);
  if (pagina.url().includes("/entrar")) throw new Error("não entrou na aplicação");
}

// ---------------------------------------------------------------------------
// Uma captura
// ---------------------------------------------------------------------------
async function fotografar(pagina: Page, c: Captura, trocas: Substituicao[], palavras: string[], contexto: Contexto) {
  const largura = c.largura ?? 1280;
  const altura = c.altura ?? 820;
  await pagina.setViewport({ width: largura, height: altura, deviceScaleFactor: 2, isMobile: largura < 600, hasTouch: largura < 600 });

  const url = typeof c.url === "function" ? c.url(contexto) : c.url;
  await pagina.goto(`${BASE}${url}`, { waitUntil: "networkidle2", timeout: 60_000 });
  await pagina.evaluate(() => document.fonts.ready);
  await espera(400);
  if (c.preparar) await c.preparar(pagina, contexto);
  await anonimizar(pagina, trocas, palavras);
  // O cursor fora de qualquer elemento, para não ficar um estado de hover.
  await pagina.mouse.move(0, 0);
  await espera(300);

  // Recorte: um elemento (com margem), a janela, ou a página inteira.
  const documento = await pagina.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
  }));
  let recorte: Caixa;
  if (!c.recorte || c.recorte === "janela") {
    recorte = { x: 0, y: 0, w: largura, h: altura };
  } else if (c.recorte === "inteira") {
    recorte = { x: 0, y: 0, w: largura, h: documento.h };
  } else {
    let caixa = await caixaDe(pagina, c.recorte);
    if (!caixa) throw new Error(`${c.id}: recorte não encontrado`);
    // "ate" alarga o recorte até ao fim de um segundo elemento.
    if (c.recorte.ate) {
      const fim = await caixaDe(pagina, c.recorte.ate);
      if (!fim) throw new Error(`${c.id}: fim do recorte não encontrado`);
      const x0 = Math.min(caixa.x, fim.x);
      const x1 = Math.max(caixa.x + caixa.w, fim.x + fim.w);
      caixa = { x: x0, y: caixa.y, w: x1 - x0, h: fim.y + fim.h - caixa.y };
    }
    const m = c.recorte.margem ?? 16;
    const x = Math.max(0, caixa.x - m);
    const y = Math.max(0, caixa.y - m);
    recorte = {
      x,
      y,
      w: Math.min(documento.w - x, caixa.w + 2 * m),
      h: Math.min(c.recorte.alturaMax ?? Infinity, Math.min(documento.h - y, caixa.h + 2 * m)),
    };
  }

  const marcas = [];
  for (const marca of c.marcas ?? []) {
    const caixa = await caixaDe(pagina, marca);
    if (!caixa) {
      console.log(`  ! ${c.id}: marca ${marca.n} não encontrada (${marca.texto ?? marca.seletor})`);
      continue;
    }
    // Uma marca tem de ficar inteira dentro da imagem; fora dela ia parar ao
    // texto do PDF.
    const dentro =
      caixa.x >= recorte.x - 2 &&
      caixa.y >= recorte.y - 2 &&
      caixa.x + caixa.w <= recorte.x + recorte.w + 2 &&
      caixa.y + caixa.h <= recorte.y + recorte.h + 2;
    if (!dentro) {
      console.log(`  ! ${c.id}: marca ${marca.n} fora da imagem (${marca.texto ?? marca.seletor})`);
      continue;
    }
    marcas.push({
      n: marca.n,
      lado: marca.lado ?? "esquerda",
      x: caixa.x - recorte.x,
      y: caixa.y - recorte.y,
      w: caixa.w,
      h: caixa.h,
    });
  }

  await pagina.screenshot({
    path: join(PASTA, `${c.id}.png`) as `${string}.png`,
    clip: { x: recorte.x, y: recorte.y, width: recorte.w, height: recorte.h },
    captureBeyondViewport: true,
  });
  writeFileSync(
    join(PASTA, `${c.id}.json`),
    JSON.stringify({ largura: recorte.w, altura: recorte.h, marcas }, null, 2),
  );
  console.log(`  ok ${c.id} (${Math.round(recorte.w)}×${Math.round(recorte.h)}, ${marcas.length} marca(s))`);
}

export type Contexto = { actaId: string | null; actaPublicadaId: string | null };

// ---------------------------------------------------------------------------
async function main() {
  carregarAmbiente();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !servico) throw new Error("Faltam as variáveis do Supabase.");
  mkdirSync(PASTA, { recursive: true });

  const filtro = process.argv[2];
  const escolhidas = CAPTURAS.filter((c) => !filtro || c.id.startsWith(filtro));

  const supa = createClient(url, servico, { auth: { persistSession: false } });

  // Tudo o que é pessoal e pode aparecer no ecrã.
  const [{ data: fracoes }, { data: perfis }, { data: fornecedores }, { data: actas }] = await Promise.all([
    supa.from("fracoes").select("id, letra, condomino_nome, telefone").order("ordem"),
    supa.from("profiles").select("nome"),
    supa.from("fornecedores").select("nome, telefone"),
    supa.from("actas").select("id").order("numero", { ascending: false }).limit(1),
  ]);
  if (!fracoes?.length) throw new Error("não há frações na base de dados.");

  const trocas: Substituicao[] = [];
  const palavras: string[] = [];
  const palavrasComuns = new Set(["de", "da", "do", "das", "dos", "e"]);
  for (const f of fracoes) {
    if (!f.condomino_nome) continue;
    const para = `Condómino ${f.letra}`;
    trocas.push({ de: f.condomino_nome, para });
    // Os extratos trazem muitas vezes só parte do nome (ex.: "TRF JOAO SILVA").
    for (const p of f.condomino_nome.split(/\s+/)) {
      if (p.length >= 4 && !palavrasComuns.has(p.toLowerCase())) palavras.push(p);
    }
    if (f.telefone) trocas.push({ de: f.telefone, para: "900 000 000" });
  }
  for (const p of perfis ?? []) {
    if (p.nome && !["Administração", "Condómino Exemplo"].includes(p.nome)) {
      trocas.push({ de: p.nome, para: "Nome do condómino" });
    }
  }
  for (const f of fornecedores ?? []) if (f.telefone) trocas.push({ de: f.telefone, para: "900 000 000" });

  const { data: publicadas } = await supa
    .from("actas")
    .select("id")
    .eq("estado", "publicada")
    .order("numero", { ascending: false })
    .limit(1);
  const contexto: Contexto = {
    actaId: actas?.[0]?.id ?? null,
    actaPublicadaId: publicadas?.[0]?.id ?? null,
  };

  const contas: Partial<Record<"admin" | "condomino", Conta>> = {};
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    for (const papel of ["condomino", "admin", "anonimo"] as const) {
      const lista = escolhidas.filter((c) => c.conta === papel);
      if (lista.length === 0) continue;
      console.log(`\n${papel}:`);

      const contextoNavegador = await browser.createBrowserContext();
      const pagina = await contextoNavegador.newPage();
      // O tsx acrescenta chamadas a __name às funções que vão para o browser.
      await pagina.evaluateOnNewDocument("window.__name = (f) => f");
      if (papel !== "anonimo") {
        contas[papel] = await criarConta(supa, papel, fracoes[0].id);
        await pagina.setViewport({ width: 1280, height: 820 });
        await entrar(pagina, contas[papel]!);
      }
      for (const c of lista) {
        try {
          await fotografar(pagina, c, trocas, palavras, contexto);
        } catch (e) {
          console.log(`  ! ${c.id}: ${(e as Error).message}`);
        }
      }
      await contextoNavegador.close();
    }
  } finally {
    await browser.close();
    for (const conta of Object.values(contas)) {
      if (!conta) continue;
      const { error } = await supa.auth.admin.deleteUser(conta.id);
      console.log(error ? `ATENÇÃO: não apaguei ${conta.email}: ${error.message}` : `Conta temporária apagada.`);
    }
  }
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
