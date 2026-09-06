import "server-only";

import { cache } from "react";
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

/** True quando as variáveis de ambiente do Supabase estão preenchidas. */
export function configurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Perfil do utilizador com sessão iniciada.
 *
 * Envolvido em cache() para que várias chamadas dentro do mesmo pedido
 * partilhem um único acesso à base de dados.
 */
export const perfilAtual = cache(async (): Promise<Perfil | null> => {
  if (!configurado()) return null;

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data ?? null;
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
