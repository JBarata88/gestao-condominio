/**
 * Captura de ecrã para comparação visual.
 *
 *   node screenshot.mjs http://localhost:3000
 *   node screenshot.mjs http://localhost:3000 entrar
 *   node screenshot.mjs http://localhost:3000 entrar --movel
 *
 * Grava em "./temporary screenshots/screenshot-N.png", com N incrementado,
 * nunca sobrescrevendo. O sufixo opcional dá "screenshot-N-entrar.png".
 *
 * Nota: o CLAUDE.md fala num serve.mjs que serve a raiz do projecto. Isso
 * aplica-se a sites estáticos; aqui o servidor é o do Next, arrancado com
 * "npm run dev", que já responde em localhost:3000.
 */
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";

const PASTA = "temporary screenshots";

const [, , url = "http://localhost:3000", ...resto] = process.argv;
const movel = resto.includes("--movel");
const etiqueta = resto.find((a) => !a.startsWith("--"));

function proximoNumero() {
  mkdirSync(PASTA, { recursive: true });
  const usados = readdirSync(PASTA)
    .map((n) => /^screenshot-(\d+)/.exec(n)?.[1])
    .filter(Boolean)
    .map(Number);
  return usados.length === 0 ? 1 : Math.max(...usados) + 1;
}

async function main() {
  const numero = proximoNumero();
  const nome = etiqueta
    ? `screenshot-${numero}-${etiqueta}.png`
    : `screenshot-${numero}.png`;
  const destino = join(PASTA, nome);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const pagina = await browser.newPage();
    await pagina.setViewport(
      movel
        ? { width: 390, height: 844, deviceScaleFactor: 2 }
        : { width: 1440, height: 900, deviceScaleFactor: 2 },
    );

    const resposta = await pagina.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60_000,
    });
    console.log(`${url} respondeu ${resposta?.status()}`);

    // Dar tempo às fontes de acabarem de carregar antes de fotografar.
    await pagina.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 400));

    await pagina.screenshot({ path: destino, fullPage: true });
    console.log(`Gravado em ${destino}`);
  } finally {
    await browser.close();
  }
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
