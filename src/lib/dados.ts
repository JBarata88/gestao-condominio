import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { clienteServidor } from "./supabase/servidor";
import type {
  Categoria,
  Condominio,
  Definicao,
  Fracao,
  Movimento,
  Perfil,
  SaldosIniciais,
} from "./tipos-bd";
import type { MovimentoCalculo, SaldosAbertura } from "./contas";
import { ABERTURA_VAZIA } from "./contas";
import { somar } from "./formatos";

/** True quando as variáveis de ambiente do Supabase estão preenchidas. */
export function configurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Perfil do utilizador com sessão iniciada, com o campo `admin` já calculado.
 *
 * Um utilizador é administrador quando `papel` é 'admin' ou quando está ligado
 * a uma fração marcada como "da administração" em Definições. As páginas devem
 * usar `perfil.admin` em vez de comparar `papel` directamente.
 *
 * Envolvido em cache() para que várias chamadas dentro do mesmo pedido
 * partilhem um único acesso à base de dados.
 */
export type PerfilAtual = Perfil & { admin: boolean };

export const perfilAtual = cache(async (): Promise<PerfilAtual | null> => {
  if (!configurado()) return null;

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil) return null;

  // O papel 'admin' basta. Caso contrário, a fração ligada ao perfil pode
  // estar marcada como "da administração" nas Definições, o que também dá
  // acesso de administrador.
  let fracaoDaAdministracao = false;
  if (perfil.papel !== "admin" && perfil.fracao_id) {
    const { data: fracao } = await supabase
      .from("fracoes")
      .select("administracao")
      .eq("id", perfil.fracao_id)
      .maybeSingle();
    fracaoDaAdministracao = fracao?.administracao === true;
  }

  return {
    ...perfil,
    admin: perfil.papel === "admin" || fracaoDaAdministracao,
  };
});

export const carregarCondominio = cache(async (): Promise<Condominio | null> => {
  const supabase = await clienteServidor();
  const { data } = await supabase.from("condominio").select("*").maybeSingle();
  return data ?? null;
});

export const carregarFracoes = cache(async (): Promise<Fracao[]> => {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("fracoes")
    .select("*")
    .order("ordem", { ascending: true });
  return data ?? [];
});

export const carregarCategorias = cache(async (): Promise<Categoria[]> => {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("categorias")
    .select("*")
    .order("ordem", { ascending: true });
  return data ?? [];
});

export const carregarDefinicoes = cache(
  async (): Promise<Map<string, unknown>> => {
    const supabase = await clienteServidor();
    const { data } = await supabase.from("definicoes").select("*");
    const linhas = (data ?? []) as Definicao[];
    return new Map(linhas.map((d) => [d.chave, d.valor]));
  },
);

/** Lê uma definição com valor por omissão, sem rebentar se estiver ausente. */
export async function definicao<T>(chave: string, omissao: T): Promise<T> {
  const todas = await carregarDefinicoes();
  const valor = todas.get(chave);
  return (valor ?? omissao) as T;
}

// ---------------------------------------------------------------------------
// Ano de exercício
//
// A app serve vários anos na mesma instalação. A definição "ano_exercicio" é
// só o ano por omissão; o seletor de ano, guardado numa cookie, e um
// parâmetro ?ano= na ligação permitem consultar qualquer ano com dados.
// ---------------------------------------------------------------------------
const ANO_MIN = 1900;
const ANO_MAX = 2200;
const COOKIE_ANO = "ano_exercicio_vista";

/** True para um ano de exercício plausível, seja number ou string. */
export function anoValido(v: unknown): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n >= ANO_MIN && n <= ANO_MAX;
}

/**
 * Ano de exercício a mostrar. Por ordem de prioridade:
 *   1. o parâmetro ?ano= da ligação (para ligações partilháveis e o MOAF)
 *   2. a cookie do seletor de ano
 *   3. a definição global "ano_exercicio"
 *   4. o ano civil actual
 */
export async function anoDeExercicio(anoParam?: string | number): Promise<number> {
  if (anoValido(anoParam)) return Number(anoParam);
  const daCookie = (await cookies()).get(COOKIE_ANO)?.value;
  if (anoValido(daCookie)) return Number(daCookie);
  return definicao<number>("ano_exercicio", new Date().getFullYear());
}

/**
 * Anos que vale a pena oferecer no seletor: os que têm movimentos ou saldos
 * de abertura, mais o ano em curso e o seguinte, para poder abrir o exercício
 * novo antes de ter lá qualquer movimento.
 */
export const anosComExercicio = cache(async (): Promise<number[]> => {
  const supabase = await clienteServidor();
  const [maisAntigo, maisRecente, saldos] = await Promise.all([
    supabase
      .from("movimentos")
      .select("data")
      .order("data", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("movimentos")
      .select("data")
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("saldos_iniciais").select("ano"),
  ]);

  const civilActual = new Date().getFullYear();
  const anos = new Set<number>([civilActual, civilActual + 1]);
  anos.add(await definicao<number>("ano_exercicio", civilActual));
  for (const s of saldos.data ?? []) {
    if (anoValido(s.ano)) anos.add(Number(s.ano));
  }

  const min = maisAntigo.data
    ? Number(maisAntigo.data.data.slice(0, 4))
    : civilActual;
  const max = maisRecente.data
    ? Number(maisRecente.data.data.slice(0, 4))
    : civilActual;
  for (let a = min; a <= max; a++) if (anoValido(a)) anos.add(a);

  return [...anos].filter(anoValido).sort((a, b) => b - a);
});

export type ExercicioResumo = {
  ano: number;
  /** Soma dos quatro saldos de abertura. */
  aberturaTotal: number;
  /** Número de movimentos lançados nesse ano. */
  movimentos: number;
};

/**
 * Exercícios com saldos de abertura definidos, do mais recente para o mais
 * antigo, com o total de abertura e a contagem de movimentos de cada um. É a
 * lista que a tabela de exercícios em Definições mostra.
 */
export const listarExercicios = cache(async (): Promise<ExercicioResumo[]> => {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("saldos_iniciais")
    .select("*")
    .order("ano", { ascending: false });
  const linhas = (data ?? []) as SaldosIniciais[];

  return Promise.all(
    linhas.map(async (s) => {
      const { count } = await supabase
        .from("movimentos")
        .select("id", { count: "exact", head: true })
        .gte("data", `${s.ano}-01-01`)
        .lte("data", `${s.ano}-12-31`);

      return {
        ano: s.ano,
        aberturaTotal: somar([
          Number(s.caixa),
          Number(s.deposito_ordem),
          Number(s.deposito_prazo),
          Number(s.conta_poupanca),
        ]),
        movimentos: count ?? 0,
      };
    }),
  );
});

/** True quando já existe uma linha de saldos de abertura para o ano. */
export const temSaldosIniciais = cache(async (ano: number): Promise<boolean> => {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("saldos_iniciais")
    .select("ano")
    .eq("ano", ano)
    .maybeSingle();
  return data !== null;
});

export const carregarSaldosIniciais = cache(
  async (ano: number): Promise<SaldosAbertura> => {
    const supabase = await clienteServidor();
    const { data } = await supabase
      .from("saldos_iniciais")
      .select("*")
      .eq("ano", ano)
      .maybeSingle<SaldosIniciais>();

    if (!data) return ABERTURA_VAZIA;
    return {
      caixa: Number(data.caixa),
      depositoOrdem: Number(data.deposito_ordem),
      depositoPrazo: Number(data.deposito_prazo),
      contaPoupanca: Number(data.conta_poupanca),
    };
  },
);

/**
 * Quota mensal de cada fração num ano, indexada por fracao_id.
 *
 * Só traz as frações que têm um valor definido para esse ano. Para as
 * restantes usa-se a quota base da fração, através de {@link quotaEfetiva}.
 */
export const carregarQuotasDoAno = cache(
  async (ano: number): Promise<Map<string, number>> => {
    const supabase = await clienteServidor();
    const { data } = await supabase
      .from("quotas_fracao")
      .select("fracao_id, quota_mensal")
      .eq("ano", ano);

    return new Map(
      (data ?? []).map((q) => [q.fracao_id, Number(q.quota_mensal)]),
    );
  },
);

/** Quota de uma fração num ano: a do próprio ano, ou a quota base da fração. */
export function quotaEfetiva(
  fracao: { id: string; quota_mensal: number },
  quotasDoAno: Map<string, number>,
): number {
  return quotasDoAno.get(fracao.id) ?? Number(fracao.quota_mensal);
}

export type MovimentoDetalhado = Movimento & {
  categorias: Pick<Categoria, "nome" | "natureza" | "linha_moaf"> | null;
  fracoes: Pick<Fracao, "letra" | "andar"> | null;
};

/**
 * Movimentos de um intervalo, com a categoria e a fração já resolvidas.
 *
 * As políticas de Row Level Security tratam da filtragem por utilizador: um
 * condómino recebe apenas as linhas da sua fração sem que este código o saiba.
 */
export const carregarMovimentos = cache(
  async (inicio: string, fim: string): Promise<MovimentoDetalhado[]> => {
    const supabase = await clienteServidor();
    const { data } = await supabase
      .from("movimentos")
      .select(
        "*, categorias(nome, natureza, linha_moaf), fracoes(letra, andar)",
      )
      .gte("data", inicio)
      .lte("data", fim)
      .order("data", { ascending: true });

    return (data ?? []) as unknown as MovimentoDetalhado[];
  },
);

/**
 * Totais do exercício para o mapa de origem e aplicação de fundos, agregados
 * por conta, natureza e linha do mapa.
 *
 * Ao contrário de carregarMovimentos, passa pela função resumo_exercicio, que
 * um condómino também pode chamar: devolve apenas somas, sem datas, descrições
 * nem a fração de cada movimento. Serve a página de Relatórios, onde só se
 * mostram totais.
 */
export const carregarResumoExercicio = cache(
  async (inicio: string, fim: string): Promise<MovimentoCalculo[]> => {
    const supabase = await clienteServidor();
    const { data } = await supabase.rpc("resumo_exercicio", {
      p_inicio: inicio,
      p_fim: fim,
    });

    return (data ?? []).map((r) => ({
      // A data não é usada pelo mapa; fica o início do período por preencher.
      data: inicio,
      conta: r.conta,
      receita: Number(r.receita),
      despesa: Number(r.despesa),
      categoria: r.linha_moaf,
      natureza: r.natureza,
      linhaMoaf: r.linha_moaf,
    }));
  },
);

export type MovimentoQuota = {
  id: string;
  data: string;
  receita: number;
  quota_mes: string | null;
  quota_mes_fim: string | null;
  fracao_id: string;
  fracoes: Pick<Fracao, "letra" | "andar" | "condomino_nome" | "tratamento"> | null;
};

/**
 * Recebimentos de Quotizações de um período, com o condómino da fração já
 * resolvido. É esta lista que alimenta o gerador de recibos: cada linha é um
 * pagamento real, com o seu próprio valor e a sua própria data, ao contrário
 * de um cálculo teórico de quota vezes número de meses.
 */
export const carregarMovimentosQuota = cache(
  async (inicio: string, fim: string): Promise<MovimentoQuota[]> => {
    const supabase = await clienteServidor();
    const { data } = await supabase
      .from("movimentos")
      .select(
        "id, data, receita, quota_mes, quota_mes_fim, fracao_id, " +
          "categorias!inner(nome), fracoes(letra, andar, condomino_nome, tratamento)",
      )
      .eq("categorias.nome", "Quotizações")
      .not("fracao_id", "is", null)
      .gt("receita", 0)
      .gte("data", inicio)
      .lte("data", fim)
      .order("data", { ascending: false });

    return (data ?? []) as unknown as MovimentoQuota[];
  },
);

/** Converte para a forma que o núcleo de cálculo espera. */
export function paraCalculo(
  movimentos: readonly MovimentoDetalhado[],
): MovimentoCalculo[] {
  return movimentos.map((m) => ({
    data: m.data,
    conta: m.conta,
    receita: Number(m.receita),
    despesa: Number(m.despesa),
    categoria: m.categorias?.nome ?? "(sem categoria)",
    natureza: m.categorias?.natureza ?? "despesa",
    linhaMoaf: m.categorias?.linha_moaf ?? null,
  }));
}

/** Primeiro e último dia de um ano, no formato ISO. */
export function limitesDoAno(ano: number): [string, string] {
  return [`${ano}-01-01`, `${ano}-12-31`];
}
