/**
 * As capturas de ecrã dos guias, com as marcas numeradas de cada uma.
 *
 * O número de cada marca é o que o texto do guia (gerar-pdf.ts) refere:
 * "carrega em ❷ Filtrar". Mudar um número aqui obriga a mudar o texto lá.
 *
 * Nenhuma captura submete formulários: "preparar" só abre, escolhe e marca
 * campos no ecrã, sem gravar.
 */

import { join } from "node:path";
import type { Page } from "puppeteer";
import type { Contexto } from "./capturar";

/** Um elemento a assinalar com um número, ou a usar como recorte. */
export type Alvo = {
  /** Texto visível do elemento (o mais profundo que o contém). */
  texto?: string;
  exato?: boolean;
  /** Restringe a procura por texto a estas etiquetas (ex.: "button"). */
  tag?: string;
  seletor?: string;
  /** Procura só dentro do elemento que bata com este seletor (o primeiro, ou o dentroNth). */
  dentro?: string;
  dentroNth?: number;
  nth?: number;
  /** Sobe até ao ancestral mais próximo que bata com este seletor. */
  perto?: string;
  /** Sobe N níveis. */
  subir?: number;
};

export type Marca = Alvo & { n: number; lado?: "esquerda" | "direita" | "cima" | "baixo" };

export type Captura = {
  id: string;
  conta: "admin" | "condomino" | "anonimo";
  url: string | ((c: Contexto) => string);
  largura?: number;
  altura?: number;
  preparar?: (p: Page, c: Contexto) => Promise<void>;
  recorte?: "janela" | "inteira" | (Alvo & { margem?: number; alturaMax?: number; ate?: Alvo });
  marcas?: Marca[];
};

// ---------------------------------------------------------------------------
// Auxiliares para "preparar"
// ---------------------------------------------------------------------------
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function clicar(
  p: Page,
  texto: string,
  { tag = "button, a, label", dentro, nth = 0 }: { tag?: string; dentro?: string; nth?: number } = {},
) {
  const ok = await p.evaluate(
    (texto, tag, dentro, nth) => {
      const limpo = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
      const raiz: ParentNode = dentro ? (document.querySelector(dentro) ?? document) : document;
      const el = [...raiz.querySelectorAll<HTMLElement>(tag)].filter((e) =>
        limpo(e.textContent).startsWith(texto),
      )[nth];
      if (!el) return false;
      el.scrollIntoView({ block: "center" });
      el.click();
      return true;
    },
    texto,
    tag,
    dentro ?? null,
    nth,
  );
  if (!ok) throw new Error(`não encontrei "${texto}"`);
  await espera(700);
}

/** Escolhe numa <select> a opção cujo texto começa por `texto`. */
async function escolher(p: Page, seletor: string, texto: string) {
  const valor = await p.$eval(
    seletor,
    (s, texto) =>
      [...(s as HTMLSelectElement).options].find((o) => (o.textContent ?? "").trim().startsWith(texto))?.value ?? null,
    texto,
  );
  if (valor === null) throw new Error(`opção "${texto}" não existe em ${seletor}`);
  await p.select(seletor, valor);
  await espera(400);
}

/** Clica nas N primeiras caixas de um seletor. */
async function marcarCaixas(p: Page, seletor: string, quantas: number) {
  const caixas = await p.$$(seletor);
  for (const c of caixas.slice(0, quantas)) await c.click();
  await espera(400);
}

const secao = (titulo: string, tag = "h2"): Alvo => ({ texto: titulo, tag, perto: "section", exato: true });

// ---------------------------------------------------------------------------
// Guia do Utilizador (conta de condómino)
// ---------------------------------------------------------------------------
const UTILIZADOR: Captura[] = [
  {
    id: "u-entrar",
    conta: "anonimo",
    url: "/entrar",
    marcas: [
      { n: 1, seletor: "#email" },
      { n: 2, seletor: "#palavra-passe" },
      { n: 3, seletor: 'button[type="submit"]' },
    ],
  },
  {
    id: "u-navegacao",
    conta: "condomino",
    url: "/",
    marcas: [
      { n: 1, seletor: "#menu-principal ul" },
      { n: 2, seletor: 'select[aria-label="Ano do exercício a consultar"]', perto: "label", lado: "baixo" },
      { n: 3, texto: "Condómino Exemplo", tag: "p" },
      { n: 4, texto: "Terminar sessão", tag: "button" },
      { n: 5, texto: "o que mudou", tag: "a" },
    ],
  },
  {
    id: "u-telemovel",
    conta: "condomino",
    url: "/",
    largura: 390,
    altura: 760,
    preparar: async (p) => clicar(p, "Menu", { tag: "button" }),
    marcas: [
      { n: 1, texto: "Fechar", tag: "button", lado: "baixo" },
      { n: 2, seletor: "#menu-principal ul", lado: "direita" },
    ],
  },
  {
    id: "u-painel-disponibilidades",
    conta: "condomino",
    url: "/",
    recorte: { seletor: 'section[aria-labelledby="disponibilidades"]' },
    marcas: [
      { n: 1, texto: "Valor em caixa", tag: "p", perto: "article", lado: "cima" },
      { n: 2, texto: "Valor no banco", tag: "p", perto: "article", lado: "cima" },
      { n: 3, texto: "Total disponível", tag: "p", perto: "article", lado: "cima" },
      { n: 4, texto: "Abertura de", tag: "p", lado: "baixo" },
    ],
  },
  {
    id: "u-painel-ano",
    conta: "condomino",
    url: "/",
    recorte: { seletor: 'section[aria-labelledby="movimento-ano"]' },
    marcas: [
      { n: 1, texto: "Receitas totais do ano", tag: "p", perto: "article", lado: "cima" },
      { n: 2, texto: "Despesas totais do ano", tag: "p", perto: "article", lado: "cima" },
      { n: 3, texto: "Top 3 despesas do ano", tag: "h2", perto: "section", lado: "cima" },
    ],
  },
  {
    id: "u-painel-quotas",
    conta: "condomino",
    url: "/",
    recorte: { seletor: 'section[aria-labelledby="quotas"]' },
    marcas: [
      { n: 1, texto: "Frações em atraso", tag: "p", perto: "article", lado: "cima" },
      { n: 2, texto: "Valor por cobrar", tag: "p", perto: "article", lado: "cima" },
      { n: 3, texto: "Prazo de pagamento", tag: "p", lado: "baixo" },
    ],
  },
  {
    id: "u-movimentos-filtros",
    conta: "condomino",
    url: "/movimentos?mes=3",
    recorte: { seletor: 'nav[aria-label="Filtrar por mês"]', subir: 1 },
    marcas: [
      { n: 1, texto: "Ano inteiro", tag: "a", lado: "cima" },
      { n: 2, texto: "Mar", tag: "a", exato: true, lado: "cima" },
      { n: 3, seletor: 'select[name="categoria"]', lado: "baixo" },
      { n: 4, seletor: 'select[name="fracao"]', lado: "baixo" },
      { n: 5, texto: "Filtrar", tag: "button", exato: true, lado: "direita" },
    ],
  },
  {
    id: "u-movimentos-banco",
    conta: "condomino",
    url: "/movimentos?mes=3",
    recorte: { seletor: 'section[aria-labelledby="seccao-banco"]' },
    marcas: [
      { n: 1, texto: "Saldo", tag: "p", dentro: 'section[aria-labelledby="seccao-banco"]', lado: "direita" },
      { n: 2, texto: "Transporte de", tag: "td", lado: "esquerda" },
      { n: 3, texto: "Receita", tag: "th", exato: true, lado: "cima" },
      { n: 4, texto: "Despesa", tag: "th", exato: true, lado: "cima" },
      { n: 5, texto: "Saldo", tag: "th", exato: true, lado: "cima" },
      { n: 6, texto: "Totais do período", tag: "td", lado: "esquerda" },
    ],
  },
  {
    id: "u-movimentos-total",
    conta: "condomino",
    url: "/movimentos?mes=3",
    recorte: { texto: "Total das duas contas", tag: "h2", perto: "section" },
    marcas: [
      { n: 1, texto: "Total das duas contas", tag: "h2", lado: "cima" },
      { n: 2, texto: "Receitas do período", tag: "dt", subir: 1, lado: "baixo" },
      { n: 3, texto: "Despesas do período", tag: "dt", subir: 1, lado: "baixo" },
      { n: 4, texto: "Diferença", tag: "dt", subir: 1, lado: "baixo" },
    ],
  },
  {
    id: "u-quotas",
    conta: "condomino",
    url: "/quotas",
    recorte: { seletor: "main", margem: 0, alturaMax: 1250 },
    marcas: [
      { n: 1, seletor: 'summary[aria-label="Mais informação"]', lado: "direita" },
      { n: 2, texto: "Imprimir", tag: "button", lado: "esquerda" },
      { n: 3, texto: "Total Pago", tag: "p", perto: "article", lado: "cima" },
      { n: 4, texto: "Total Por Pagar", tag: "p", perto: "article", lado: "cima" },
      { n: 5, texto: "Meses pagos", tag: "th", lado: "cima" },
      { n: 6, texto: "Em falta", tag: "th", lado: "cima" },
      { n: 7, texto: "Pago", tag: "li", exato: true, subir: 1, lado: "baixo" },
    ],
  },
  {
    id: "u-quotas-reforco",
    conta: "condomino",
    url: "/quotas?ano=2025",
    recorte: { texto: "por fração · prazo", tag: "p", perto: "section" },
    marcas: [
      { n: 1, texto: "por fração · prazo", tag: "p", lado: "baixo" },
      { n: 2, texto: "Pago", tag: "span", nth: 0, subir: 1, lado: "cima" },
      { n: 3, texto: "Estado", tag: "th", lado: "cima" },
    ],
  },
  {
    id: "u-relatorios",
    conta: "condomino",
    url: "/relatorios",
    recorte: { seletor: "main", margem: 0 },
    marcas: [
      { n: 1, texto: "Imprimir", tag: "button", lado: "esquerda" },
      { n: 2, texto: "Orçamento vs Realizado", tag: "a", lado: "esquerda" },
      { n: 3, seletor: "#inicio", lado: "cima" },
      { n: 4, seletor: "#fim", lado: "cima" },
      { n: 5, texto: "Atualizar", tag: "button", lado: "direita" },
      { n: 6, ...secao("Origem de fundos"), lado: "esquerda" },
      { n: 7, ...secao("Aplicação de fundos"), lado: "direita" },
      { n: 8, ...secao("Receitas por categoria"), lado: "esquerda" },
      { n: 9, ...secao("Despesas por categoria"), lado: "direita" },
      { n: 10, texto: "Célula de controlo", tag: "p", subir: 1, lado: "esquerda" },
    ],
  },
  {
    id: "u-orcamento",
    conta: "condomino",
    url: "/relatorios/orcamento",
    recorte: { seletor: "main", margem: 0, alturaMax: 1500 },
    marcas: [
      { n: 1, texto: "Orçamentado", tag: "th", nth: 0, lado: "cima" },
      { n: 2, texto: "Realizado", tag: "th", nth: 0, lado: "cima" },
      { n: 3, texto: "Desvio", tag: "th", nth: 0, lado: "cima" },
      { n: 4, texto: "Variação das disponibilidades", tag: "p", subir: 1, lado: "esquerda" },
      { n: 5, texto: "Célula de controlo", tag: "p", subir: 1, lado: "direita" },
      { n: 6, texto: "Voltar ao mapa de fundos", tag: "a", lado: "esquerda" },
    ],
  },
  {
    id: "u-actas",
    conta: "condomino",
    url: "/actas",
    recorte: { seletor: "main", margem: 0, alturaMax: 520 },
    marcas: [{ n: 1, seletor: "main ul a", nth: 0, lado: "esquerda" }],
  },
  {
    id: "u-acta",
    conta: "condomino",
    url: (c) => `/actas/${c.actaPublicadaId}`,
    recorte: { seletor: "main", margem: 0, ate: { seletor: "article table" } },
    marcas: [
      { n: 1, texto: "Imprimir", tag: "button", lado: "baixo" },
      { n: 2, texto: "Descarregar Word", tag: "a", lado: "baixo" },
      { n: 3, texto: "Todas as atas", tag: "a", lado: "esquerda" },
      { n: 4, seletor: "article table", nth: 0, lado: "esquerda" },
    ],
  },
  {
    id: "u-guias",
    conta: "condomino",
    url: "/guias",
    altura: 620,
    marcas: [
      { n: 1, texto: "Guias de utilização", tag: "a", dentro: "#menu-principal" },
      { n: 2, texto: "Ler guia", tag: "a", lado: "baixo" },
      { n: 3, texto: "Descarregar PDF", tag: "a", lado: "direita" },
    ],
  },
  {
    id: "u-conta",
    conta: "condomino",
    url: "/definicoes/conta",
    recorte: { seletor: "main", margem: 0 },
    marcas: [
      { n: 1, texto: "Conta", tag: "a", exato: true, lado: "baixo" },
      { n: 2, seletor: "#nova-palavra-passe", lado: "esquerda" },
      { n: 3, seletor: "#confirmar-palavra-passe", lado: "esquerda" },
      { n: 4, seletor: 'main form button[type="submit"]', lado: "direita" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Guia do Administrador
// ---------------------------------------------------------------------------
const EXTRATO_EXEMPLO = join(process.cwd(), "scripts", "guias", "extrato-exemplo.csv");

const ADMINISTRADOR: Captura[] = [
  {
    id: "a-menu",
    conta: "admin",
    url: "/definicoes/condominio",
    altura: 560,
    marcas: [
      { n: 1, texto: "Recibos", tag: "a", exato: true },
      { n: 2, texto: "Definições", tag: "a", exato: true, dentro: "#menu-principal" },
      { n: 3, seletor: 'nav[aria-label="Áreas das definições"]', lado: "baixo" },
    ],
  },
  {
    id: "a-condominio",
    conta: "admin",
    url: "/definicoes/condominio",
    recorte: secao("Identificação do condomínio"),
    marcas: [
      { n: 1, seletor: 'input[name="nome"]', lado: "esquerda" },
      { n: 2, seletor: 'input[name="nif"]', lado: "direita" },
      { n: 3, seletor: 'input[name="morada"]', lado: "esquerda" },
      { n: 4, texto: "Guardar", tag: "button", dentro: "main section", lado: "direita" },
    ],
  },
  {
    id: "a-prazos",
    conta: "admin",
    url: "/definicoes/condominio",
    recorte: { ...secao("Prazos e exercício"), alturaMax: 470 },
    marcas: [
      { n: 1, seletor: 'input[name="dia_limite_quota"]', lado: "esquerda" },
      { n: 2, seletor: 'input[name="localidade_recibos"]', lado: "direita" },
      { n: 3, seletor: 'input[name="valor_presenca_assembleia"]', lado: "esquerda" },
    ],
  },
  {
    id: "a-exercicios",
    conta: "admin",
    url: "/definicoes/condominio",
    recorte: { texto: "Exercícios", tag: "h3", exato: true, ate: { seletor: "main table" } },
    marcas: [
      { n: 1, seletor: "#ano-criar-exercicio", lado: "esquerda" },
      { n: 2, texto: "Criar exercício", tag: "button", lado: "direita" },
      { n: 3, texto: "ativo", tag: "span", exato: true, nth: 1, lado: "esquerda" },
      { n: 4, texto: "Tornar ativo", tag: "button", lado: "esquerda" },
    ],
  },
  {
    id: "a-fracoes",
    conta: "admin",
    url: "/definicoes/fracoes",
    recorte: { seletor: "main table", subir: 1 },
    marcas: [
      { n: 1, texto: "Administração de", tag: "th", lado: "cima" },
      { n: 2, texto: "Editar", tag: "button", nth: 0, lado: "direita" },
    ],
  },
  {
    id: "a-fracao-editar",
    conta: "admin",
    url: "/definicoes/fracoes",
    preparar: async (p) => clicar(p, "Editar", { tag: "button" }),
    recorte: { seletor: "main form", perto: "tr" },
    marcas: [
      { n: 1, seletor: 'input[name="condomino_nome"]', lado: "direita" },
      { n: 2, seletor: 'input[name="permilagem"]', lado: "direita" },
      { n: 3, seletor: 'select[name="tratamento"]', lado: "esquerda" },
      { n: 4, seletor: 'input[name="ativo"]', subir: 1, lado: "esquerda" },
      { n: 5, seletor: 'input[name="administracao"]', subir: 1, lado: "esquerda" },
      { n: 6, texto: "Guardar", tag: "button", dentro: "main form", lado: "baixo" },
    ],
  },
  {
    id: "a-contas-nova",
    conta: "admin",
    url: "/definicoes/contas",
    recorte: secao("Nova conta"),
    marcas: [
      { n: 1, seletor: 'main section input[name="email"]', lado: "direita" },
      { n: 2, seletor: 'main section input[name="palavra_passe"]', lado: "esquerda" },
      { n: 3, seletor: "#nova-fracao", lado: "direita" },
      { n: 4, seletor: 'main section input[name="admin"]', subir: 1, lado: "esquerda" },
      { n: 5, texto: "Criar conta", tag: "button", lado: "direita" },
    ],
  },
  {
    id: "a-contas-existente",
    conta: "admin",
    url: "/definicoes/contas",
    // main section: 0 = Nova conta, 1 = Contas existentes, 2 = a própria
    // conta (sem "Apagar"), 3 = a primeira conta de outra pessoa.
    recorte: { seletor: "main section", nth: 3 },
    marcas: [
      { n: 1, seletor: "select", dentro: "main section", dentroNth: 3, lado: "esquerda" },
      { n: 2, seletor: 'input[name="admin"]', dentro: "main section", dentroNth: 3, subir: 1, lado: "direita" },
      { n: 3, texto: "Guardar", tag: "button", dentro: "main section", dentroNth: 3, lado: "direita" },
      { n: 4, texto: "Alterar palavra-passe", tag: "button", dentro: "main section", dentroNth: 3, lado: "direita" },
      { n: 5, texto: "Apagar conta", tag: "button", dentro: "main section", dentroNth: 3, lado: "direita" },
    ],
  },
  {
    id: "a-quotas-ano",
    conta: "admin",
    url: "/definicoes/quotas",
    recorte: { texto: "Quotas mensais de", tag: "h2", perto: "section" },
    marcas: [
      { n: 1, texto: "Quota base", tag: "th", lado: "cima" },
      { n: 2, seletor: 'input[name^="quota-"]', nth: 0, lado: "direita" },
      { n: 3, texto: "Guardar", tag: "button", nth: 0, lado: "direita" },
    ],
  },
  {
    id: "a-reforco",
    conta: "admin",
    url: "/definicoes/quotas",
    recorte: { texto: "Reforços extraordinários de", tag: "h2", perto: "section" },
    marcas: [
      { n: 1, seletor: "#reforco-descricao", lado: "esquerda" },
      { n: 2, seletor: "#reforco-valor", lado: "esquerda" },
      { n: 3, seletor: "#reforco-prazo", lado: "direita" },
      { n: 4, seletor: "#reforco-categoria", lado: "direita" },
      { n: 5, texto: "Criar reforço", tag: "button", lado: "direita" },
    ],
  },
  {
    id: "a-orcamento",
    conta: "admin",
    url: "/definicoes/orcamento",
    recorte: { texto: "Orçamento de", tag: "h2", perto: "section" },
    marcas: [
      { n: 1, texto: "Origem de fundos", tag: "h3", lado: "cima" },
      { n: 2, texto: "Aplicação de fundos — Despesas", tag: "h3", lado: "cima" },
      { n: 3, texto: "Disponibilidades previstas", tag: "h3", lado: "cima" },
      { n: 4, texto: "Guardar", tag: "button", dentro: "main section", lado: "direita" },
    ],
  },
  {
    id: "a-fornecedores",
    conta: "admin",
    url: "/definicoes/fornecedores",
    recorte: secao("Novo fornecedor"),
    marcas: [
      { n: 1, texto: "Adicionar", tag: "button", lado: "direita" },
    ],
  },
  {
    id: "a-seguros",
    conta: "admin",
    url: "/definicoes/seguros",
    recorte: { texto: "Apólices e recibos de", tag: "h2", perto: "section", alturaMax: 760 },
    marcas: [
      { n: 1, texto: "Entregues:", tag: "p", lado: "cima" },
      { n: 2, seletor: 'input[name^="apolice-"]', nth: 0, lado: "esquerda" },
      { n: 3, seletor: 'input[name^="recibo-"]', nth: 0, lado: "direita" },
    ],
  },
  {
    id: "a-extratos",
    conta: "admin",
    url: "/definicoes/extratos",
    recorte: secao("Novo extrato"),
    marcas: [
      { n: 1, seletor: "#ficheiro", lado: "cima" },
      { n: 2, texto: "Ler ficheiro", tag: "button", lado: "direita" },
    ],
  },
  {
    id: "a-extratos-revisao",
    conta: "admin",
    url: "/definicoes/extratos",
    largura: 1600,
    preparar: async (p) => {
      // A tabela de revisão é mais larga do que a coluna das Definições.
      await p.evaluate(() => document.querySelectorAll<HTMLElement>("main .max-w-4xl").forEach((e) => (e.style.maxWidth = "none")));
      const campo = await p.$("#ficheiro");
      await (campo as unknown as { uploadFile(f: string): Promise<void> }).uploadFile(EXTRATO_EXEMPLO);
      await clicar(p, "Ler ficheiro", { tag: "button" });
      await p.waitForSelector("table", { timeout: 20_000 });
      await espera(600);
    },
    recorte: secao("Novo extrato"),
    marcas: [
      { n: 1, texto: "marcadas para gravar", tag: "span", lado: "cima" },
      { n: 2, texto: "Gravar", tag: "th", exato: true, lado: "esquerda" },
      { n: 3, texto: "Fração C, valor igual", tag: "span", lado: "baixo" },
      { n: 4, seletor: 'select[aria-label="Categoria"]', nth: 2, lado: "baixo" },
      { n: 5, seletor: 'select[aria-label="Fração"]', nth: 0, lado: "cima" },
      { n: 6, texto: "Mês da quota", tag: "th", lado: "cima" },
      { n: 7, texto: "Gravar 3", tag: "button", lado: "cima" },
    ],
  },
  {
    id: "a-movimentos-accoes",
    conta: "admin",
    url: "/movimentos?mes=3",
    recorte: { seletor: 'section[aria-labelledby="seccao-caixa"]' },
    marcas: [
      { n: 1, texto: "Editar", tag: "button", dentro: 'section[aria-labelledby="seccao-caixa"]', lado: "direita" },
      { n: 2, texto: "Apagar", tag: "button", dentro: 'section[aria-labelledby="seccao-caixa"]', lado: "direita" },
      { n: 3, texto: "Lançar movimento à mão", tag: "button", lado: "direita" },
    ],
  },
  {
    id: "a-movimentos-extrato",
    conta: "admin",
    url: "/movimentos?mes=3",
    recorte: { seletor: 'section[aria-labelledby="seccao-banco"]', alturaMax: 330 },
    marcas: [{ n: 1, texto: "extrato", tag: "span", exato: true, lado: "direita" }],
  },
  {
    id: "a-lancar",
    conta: "admin",
    url: "/movimentos?mes=3",
    preparar: async (p) => {
      await clicar(p, "Lançar movimento à mão", { tag: "button" });
      await clicar(p, "Entrada", { tag: "label" });
      await escolher(p, "#categoria-caixa", "Quotizações");
    },
    recorte: { texto: "Novo movimento de caixa", tag: "h3", subir: 1 },
    marcas: [
      { n: 1, texto: "Sentido", tag: "legend", subir: 1, lado: "esquerda" },
      { n: 2, seletor: "#data-caixa", lado: "esquerda" },
      { n: 3, seletor: "#valor-caixa", lado: "direita" },
      { n: 4, seletor: "#categoria-caixa", lado: "esquerda" },
      { n: 5, seletor: "#descricao-caixa", lado: "direita" },
      { n: 6, seletor: "#fracao-caixa", lado: "esquerda" },
      { n: 7, texto: "Mês da quota", tag: "label, span, p", subir: 1, lado: "direita" },
      { n: 8, texto: "Lançar movimento", tag: "button", exato: true, lado: "cima" },
    ],
  },
  {
    id: "a-editar-movimento",
    conta: "admin",
    url: "/movimentos?mes=3",
    preparar: async (p) =>
      clicar(p, "Editar", { tag: "button", dentro: 'section[aria-labelledby="seccao-caixa"]' }),
    recorte: { seletor: 'section[aria-labelledby="seccao-caixa"] form', perto: "tr" },
    marcas: [
      { n: 1, seletor: 'section[aria-labelledby="seccao-caixa"] form select[name="fracao_id"]', lado: "esquerda" },
      { n: 2, texto: "Guardar", tag: "button", dentro: 'section[aria-labelledby="seccao-caixa"] form', lado: "cima" },
    ],
  },
  {
    id: "a-quotas-movimentos",
    conta: "admin",
    url: "/quotas",
    recorte: { seletor: "main table", alturaMax: 330 },
    marcas: [{ n: 1, texto: "movimentos", tag: "a", exato: true, nth: 0, lado: "direita" }],
  },
  {
    id: "a-recibos-quota",
    conta: "admin",
    url: "/recibos",
    preparar: async (p) => marcarCaixas(p, "main table tbody input[type=checkbox]", 2),
    recorte: { seletor: "main section" },
    marcas: [
      { n: 1, texto: "Quota", tag: "label", exato: true, lado: "cima" },
      { n: 2, seletor: 'input[placeholder="Filtrar por fração ou nome…"]', lado: "direita" },
      { n: 3, seletor: "main table tbody input[type=checkbox]", nth: 0, lado: "esquerda" },
      { n: 4, texto: "recibo(s) a gerar", tag: "p", lado: "baixo" },
      { n: 5, texto: "Gerar e descarregar", tag: "button", lado: "direita" },
    ],
  },
  {
    id: "a-recibos-presenca",
    conta: "admin",
    url: "/recibos",
    preparar: async (p) => {
      await clicar(p, "Presença em assembleia", { tag: "label" });
      await marcarCaixas(p, "main fieldset input[type=checkbox]:not(:disabled)", 3);
    },
    recorte: { seletor: "main section" },
    marcas: [
      { n: 1, texto: "Presença em assembleia", tag: "label", lado: "cima" },
      { n: 2, seletor: "main fieldset input[type=checkbox]", nth: 0, subir: 1, lado: "esquerda" },
      { n: 3, seletor: "#assembleia", lado: "esquerda" },
      { n: 4, seletor: "#valor-presenca", lado: "direita" },
      { n: 5, seletor: "#data-emissao", lado: "direita" },
      { n: 6, texto: "Gerar e descarregar", tag: "button", lado: "direita" },
    ],
  },
  {
    id: "a-recibos-caixa",
    conta: "admin",
    url: "/recibos",
    preparar: async (p) => clicar(p, "Documento de caixa", { tag: "label" }),
    recorte: { seletor: "main section" },
    marcas: [
      { n: 1, texto: "Documento de caixa", tag: "label", lado: "cima" },
      { n: 2, seletor: "#destinatario", lado: "esquerda" },
      { n: 3, seletor: "#servico", lado: "direita" },
      { n: 4, seletor: "#periodo", lado: "esquerda" },
      { n: 5, seletor: "#valor-pagamento", lado: "direita" },
      { n: 6, seletor: "#data-emissao", lado: "direita" },
      { n: 7, texto: "Gerar e descarregar", tag: "button", lado: "direita" },
    ],
  },
  {
    id: "a-actas",
    conta: "admin",
    url: "/definicoes/actas",
    recorte: { seletor: 'nav[aria-label="Áreas das definições"]', subir: 1, alturaMax: 1100 },
    marcas: [
      { n: 1, seletor: "#nova-acta-numero", lado: "esquerda" },
      { n: 2, seletor: "#nova-acta-data", lado: "cima" },
      { n: 3, texto: "Nova Assembleia", tag: "button", lado: "direita" },
      { n: 4, texto: "Gerar folha de presenças", tag: "button", lado: "direita" },
      { n: 5, texto: "Rascunho", tag: "span", exato: true, nth: 0, lado: "esquerda" },
      { n: 6, texto: "Editar", tag: "a", nth: 0, lado: "direita" },
    ],
  },
  {
    id: "a-acta-cabecalho",
    conta: "admin",
    url: (c) => `/definicoes/actas/${c.actaId}`,
    recorte: secao("Cabeçalho"),
    marcas: [
      { n: 1, seletor: "#acta-numero", lado: "cima" },
      { n: 2, seletor: "#acta-data", lado: "cima" },
      { n: 3, seletor: "#acta-hora-inicio", lado: "cima" },
      { n: 4, seletor: "#acta-hora-fim", lado: "cima" },
      { n: 5, seletor: "#acta-local", lado: "esquerda" },
    ],
  },
  {
    id: "a-acta-topicos",
    conta: "admin",
    url: (c) => `/definicoes/actas/${c.actaId}`,
    recorte: { ...secao("Ordem de trabalhos"), alturaMax: 560 },
    marcas: [
      { n: 1, seletor: 'input[id^="topico-titulo-"]', nth: 0, lado: "esquerda" },
      { n: 2, seletor: 'select[id^="topico-decisao-"]', nth: 0, lado: "direita" },
      { n: 3, seletor: 'textarea[id^="topico-comentario-"]', nth: 0, lado: "esquerda" },
      { n: 4, texto: "Inserir tabela de apólices", tag: "button", nth: 0, lado: "direita" },
      { n: 5, seletor: 'button[aria-label="Descer ponto 1"]', lado: "cima" },
      { n: 6, texto: "Remover", tag: "button", nth: 0, lado: "direita" },
    ],
  },
  {
    id: "a-acta-adicionar",
    conta: "admin",
    url: (c) => `/definicoes/actas/${c.actaId}`,
    recorte: { texto: "+ Adicionar tópico", tag: "button", margem: 60 },
    marcas: [{ n: 7, texto: "+ Adicionar tópico", tag: "button", lado: "direita" }],
  },
  {
    id: "a-acta-presencas",
    conta: "admin",
    url: (c) => `/definicoes/actas/${c.actaId}`,
    preparar: async (p) => {
      await marcarCaixas(p, 'input[aria-label$=" presente"]', 5);
      await escolher(p, 'select[aria-label="Forma de presença da fração B"]', "Procuração fração A");
    },
    recorte: secao("Condóminos presentes"),
    marcas: [
      { n: 1, seletor: 'input[aria-label$=" presente"]', nth: 0, lado: "esquerda" },
      { n: 2, seletor: 'input[aria-label="Condómino da fração A"]', lado: "cima" },
      { n: 3, texto: "Permilagem", tag: "th", lado: "cima" },
      { n: 4, seletor: 'select[aria-label="Forma de presença da fração B"]', lado: "direita" },
      { n: 5, texto: "Total presente", tag: "td", subir: 1, lado: "baixo" },
    ],
  },
  {
    id: "a-acta-guardar",
    conta: "admin",
    url: (c) => `/definicoes/actas/${c.actaId}`,
    recorte: { texto: "Guardar ata", tag: "button", margem: 40 },
    marcas: [{ n: 6, texto: "Guardar ata", tag: "button", lado: "direita" }],
  },
  {
    id: "a-acta-convocatorias",
    conta: "admin",
    url: (c) => `/definicoes/actas/${c.actaId}`,
    recorte: secao("Convocatórias"),
    marcas: [
      { n: 1, seletor: "#conv-sala", lado: "cima" },
      { n: 2, seletor: "#conv-segunda", lado: "cima" },
      { n: 3, seletor: "#conv-hora-segunda", lado: "cima" },
      { n: 4, texto: "Gerar convocatórias", tag: "button", lado: "direita" },
    ],
  },
  {
    id: "a-acta-publicar",
    conta: "admin",
    url: (c) => `/definicoes/actas/${c.actaId}`,
    recorte: secao("Documento e publicação"),
    marcas: [
      { n: 1, texto: "Descarregar Word", tag: "a", lado: "baixo" },
      { n: 2, texto: "Pré-visualizar", tag: "a", lado: "baixo" },
      { n: 3, texto: "Publicar ata", tag: "button", lado: "direita" },
      { n: 4, texto: "Eliminar ata", tag: "button", lado: "direita" },
    ],
  },
  {
    id: "a-relatorios-excel",
    conta: "admin",
    url: "/relatorios",
    recorte: { texto: "Célula de controlo", tag: "p", subir: 2 },
    marcas: [{ n: 1, texto: "Descarregar em Excel", tag: "a", lado: "esquerda" }],
  },
];

export const CAPTURAS: Captura[] = [...UTILIZADOR, ...ADMINISTRADOR];
