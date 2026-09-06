/**
 * Sugestão automática de categoria e fração para cada linha do extrato.
 *
 * Nada é gravado com base nestas sugestões. Servem para pré-preencher o ecrã
 * de revisão, onde a administração confirma linha a linha.
 */

import { normalizarTexto } from "./analisar";

export type RegraSimples = {
  padrao: string;
  categoriaId: string | null;
  fracaoId: string | null;
  fornecedorId: string | null;
  prioridade: number;
};

export type FracaoSimples = {
  id: string;
  letra: string;
  condominoNome: string | null;
  quotaMensal: number;
};

export type Sugestao = {
  categoriaId: string | null;
  fracaoId: string | null;
  fornecedorId: string | null;
  quotaMes: string | null;
  /** De 0 a 1. Acima de 0,8 a linha aparece pré-seleccionada na revisão. */
  confianca: number;
  motivo: string;
};

const MESES_CURTOS: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const MESES_LONGOS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

export function sugerir({
  descricao,
  valor,
  dataMov,
  regras,
  fracoes,
  categoriaQuotasId,
}: {
  descricao: string;
  valor: number;
  dataMov: string;
  regras: readonly RegraSimples[];
  fracoes: readonly FracaoSimples[];
  categoriaQuotasId: string | null;
}): Sugestao {
  const texto = normalizarTexto(descricao);

  const vazia: Sugestao = {
    categoriaId: null,
    fracaoId: null,
    fornecedorId: null,
    quotaMes: null,
    confianca: 0,
    motivo: "Sem correspondência.",
  };

  // --- Entradas: tentar identificar uma quota -----------------------------
  if (valor > 0) {
    const fracao = identificarFracao(texto, fracoes);
    if (fracao) {
      const mes = identificarMes(texto) ?? Number(dataMov.slice(5, 7));
      const ano = Number(dataMov.slice(0, 4));
      const quotaCerta = Math.abs(valor - fracao.quotaMensal) < 0.005;

      return {
        categoriaId: categoriaQuotasId,
        fracaoId: fracao.id,
        fornecedorId: null,
        quotaMes: `${ano}-${String(mes).padStart(2, "0")}-01`,
        // Valor exacto da quota é o sinal mais forte que existe.
        confianca: quotaCerta ? 0.95 : 0.6,
        motivo: quotaCerta
          ? `Fração ${fracao.letra}, valor igual à quota mensal.`
          : `Fração ${fracao.letra}, mas o valor não é o da quota mensal.`,
      };
    }
  }

  // --- Regras de texto ----------------------------------------------------
  const ordenadas = [...regras].sort((a, b) => a.prioridade - b.prioridade);
  for (const regra of ordenadas) {
    const padrao = normalizarTexto(regra.padrao);
    if (!padrao || !texto.includes(padrao)) continue;

    // Uma regra de despesa não deve ser aplicada a uma entrada, nem o inverso.
    return {
      categoriaId: regra.categoriaId,
      fracaoId: regra.fracaoId,
      fornecedorId: regra.fornecedorId,
      quotaMes: null,
      confianca: 0.85,
      motivo: `Corresponde à regra "${regra.padrao}".`,
    };
  }

  return vazia;
}

/** Procura a fração pelo nome do condómino ou pela letra da fração. */
function identificarFracao(
  texto: string,
  fracoes: readonly FracaoSimples[],
): FracaoSimples | null {
  // Primeiro pelo nome, que é muito mais específico do que uma letra solta.
  for (const f of fracoes) {
    if (!f.condominoNome) continue;
    const nome = normalizarTexto(f.condominoNome);
    const apelidos = nome.split(" ").filter((p) => p.length >= 4);
    // Exige duas palavras do nome, para "martins" sozinho não apanhar
    // qualquer transferência de alguém com o mesmo apelido.
    const encontradas = apelidos.filter((p) => texto.includes(p));
    if (encontradas.length >= 2) return f;
  }

  // Depois pela menção explícita à fração, como "QUOTA JAN FRACCAO G".
  for (const f of fracoes) {
    const letra = normalizarTexto(f.letra);
    if (new RegExp(`frac[cç]?[aã]?o?\\s+${letra}\\b`).test(texto)) return f;
  }

  return null;
}

/** Encontra o mês referido na descrição, como "QUOTA JAN" ou "QUOTA JANEIRO". */
function identificarMes(texto: string): number | null {
  for (const [nome, numero] of Object.entries(MESES_LONGOS)) {
    if (new RegExp(`\\b${nome}\\b`).test(texto)) return numero;
  }
  for (const [nome, numero] of Object.entries(MESES_CURTOS)) {
    if (new RegExp(`\\b${nome}\\b`).test(texto)) return numero;
  }
  return null;
}
