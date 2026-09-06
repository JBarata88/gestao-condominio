/**
 * Tipos da base de dados, a acompanhar supabase/migrations/.
 *
 * Escritos à mão em vez de gerados, para o projecto poder ser compilado sem
 * ligação ao Supabase. Depois de teres a CLI configurada podes substituir por
 *   npx supabase gen types typescript --linked > src/lib/tipos-bd.ts
 */

export type PapelUtilizador = "admin" | "condomino";
export type TipoConta = "banco" | "caixa";
export type NaturezaCategoria = "receita" | "despesa" | "transferencia";
export type EstadoLinha = "pendente" | "conciliado" | "ignorado" | "duplicado";
export type TipoRecibo = "quota" | "presenca" | "pagamento";
export type TratamentoPessoa = "masculino" | "feminino";

export type Condominio = {
  id: number;
  nome: string;
  morada: string;
  codigo_postal: string;
  localidade: string;
  nif: string;
  nib: string | null;
  iban: string | null;
  atualizado_em: string;
};

export type Fracao = {
  id: string;
  letra: string;
  andar: string;
  ordem: number;
  condomino_nome: string | null;
  tratamento: TratamentoPessoa;
  email: string | null;
  telefone: string | null;
  permilagem: number | null;
  quota_mensal: number;
  ativo: boolean;
  /** Quando verdadeiro, o condómino ligado a esta fração tem acesso de administrador. */
  administracao: boolean;
  atualizado_em: string;
};

export type Perfil = {
  id: string;
  nome: string | null;
  papel: PapelUtilizador;
  fracao_id: string | null;
  criado_em: string;
};

export type Fornecedor = {
  id: string;
  nome: string;
  tipo: string | null;
  email: string | null;
  telefone: string | null;
  iban: string | null;
  notas: string | null;
  ativo: boolean;
  atualizado_em: string;
};

export type Categoria = {
  id: string;
  nome: string;
  natureza: NaturezaCategoria;
  linha_moaf: string | null;
  ordem: number;
  ativo: boolean;
  sistema: boolean;
};

export type Movimento = {
  id: string;
  data: string;
  doc: string | null;
  categoria_id: string;
  descricao: string | null;
  conta: TipoConta;
  receita: number;
  despesa: number;
  fracao_id: string | null;
  fornecedor_id: string | null;
  quota_mes: string | null;
  /** Fim do intervalo de meses, quando o pagamento cobre mais do que um. */
  quota_mes_fim: string | null;
  transferencia_id: string | null;
  extrato_linha_id: string | null;
  criado_em: string;
  criado_por: string | null;
};

export type SaldosIniciais = {
  ano: number;
  caixa: number;
  deposito_ordem: number;
  deposito_prazo: number;
  conta_poupanca: number;
  atualizado_em: string;
};

export type QuotaFracao = {
  fracao_id: string;
  ano: number;
  quota_mensal: number;
  atualizado_em: string;
};

export type Extrato = {
  id: string;
  nome_ficheiro: string;
  ficheiro_path: string | null;
  banco: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  total_linhas: number;
  importado_em: string;
  importado_por: string | null;
};

export type ExtratoLinha = {
  id: string;
  extrato_id: string;
  linha_origem: number | null;
  data_mov: string;
  data_valor: string | null;
  descricao: string;
  valor: number;
  saldo: number | null;
  impressao_digital: string;
  estado: EstadoLinha;
  movimento_id: string | null;
  sugestao_categoria_id: string | null;
  sugestao_fracao_id: string | null;
  sugestao_quota_mes: string | null;
  confianca: number | null;
};

export type RegraConciliacao = {
  id: string;
  padrao: string;
  categoria_id: string | null;
  fracao_id: string | null;
  fornecedor_id: string | null;
  prioridade: number;
  ativo: boolean;
};

export type Assembleia = {
  id: string;
  data: string;
  descricao: string | null;
  valor_presenca: number;
};

export type Recibo = {
  id: string;
  numero: string;
  tipo: TipoRecibo;
  fracao_id: string | null;
  destinatario: string;
  valor: number;
  data_emissao: string;
  periodo_texto: string | null;
  assembleia_id: string | null;
  movimento_id: string | null;
  ficheiro_path: string | null;
  criado_em: string;
  criado_por: string | null;
};

export type Definicao = {
  chave: string;
  valor: unknown;
  descricao: string | null;
  atualizado_em: string;
};

/**
 * Colunas com valor por omissão no Postgres, portanto opcionais ao inserir.
 *
 * A lista acompanha os DEFAULT declarados em supabase/migrations/0001. Uma
 * coluna que ganhe um default no futuro tem de ser acrescentada aqui, senão o
 * TypeScript continua a exigi-la.
 */
type ComOmissao =
  | "id"
  | "criado_em"
  | "atualizado_em"
  | "importado_em"
  | "ordem"
  | "ativo"
  | "sistema"
  | "receita"
  | "despesa"
  | "quota_mensal"
  | "total_linhas"
  | "estado"
  | "prioridade"
  | "valor_presenca"
  | "tratamento"
  | "administracao"
  | "papel"
  | "caixa"
  | "deposito_ordem"
  | "deposito_prazo"
  | "conta_poupanca";

/**
 * Achata uma intersecção num único tipo de objecto.
 *
 * O cliente do Supabase exige que Insert e Update sejam objectos simples. Uma
 * intersecção como `Omit<...> & Partial<...>` não satisfaz essa restrição e
 * faz o tipo colapsar para `never`, o que rejeita silenciosamente todos os
 * inserts. Passar pelo mapeamento resolve a intersecção antes de a entregar.
 */
type Achatar<T> = { [K in keyof T]: T[K] };

/**
 * Chaves opcionais ao inserir: as que aceitam NULL, porque nesse caso a
 * coluna assume NULL sozinha, mais as que têm valor por omissão.
 */
type ChavesOpcionais<T> = {
  [K in keyof T]-?: null extends T[K]
    ? K
    : K extends ComOmissao
      ? K
      : never;
}[keyof T];

type Insercao<T> = Achatar<
  Omit<T, ChavesOpcionais<T>> & Partial<Pick<T, ChavesOpcionais<T>>>
>;

type Atualizacao<T> = Achatar<Partial<T>>;

type Tabela<T> = {
  Row: T;
  Insert: Insercao<T>;
  Update: Atualizacao<T>;
  Relationships: [];
};

export type BaseDados = {
  public: {
    Tables: {
      condominio: Tabela<Condominio>;
      fracoes: Tabela<Fracao>;
      profiles: Tabela<Perfil>;
      fornecedores: Tabela<Fornecedor>;
      categorias: Tabela<Categoria>;
      movimentos: Tabela<Movimento>;
      saldos_iniciais: Tabela<SaldosIniciais>;
      quotas_fracao: Tabela<QuotaFracao>;
      extratos: Tabela<Extrato>;
      extrato_linhas: Tabela<ExtratoLinha>;
      regras_conciliacao: Tabela<RegraConciliacao>;
      assembleias: Tabela<Assembleia>;
      recibos: Tabela<Recibo>;
      definicoes: Tabela<Definicao>;
    };
    Views: Record<never, never>;
    Functions: {
      e_admin: { Args: Record<never, never>; Returns: boolean };
      fracao_atual: { Args: Record<never, never>; Returns: string };
      resumo_exercicio: {
        Args: { p_inicio: string; p_fim: string };
        Returns: {
          conta: TipoConta;
          natureza: NaturezaCategoria;
          linha_moaf: string;
          receita: number;
          despesa: number;
        }[];
      };
    };
    Enums: {
      papel_utilizador: PapelUtilizador;
      tipo_conta: TipoConta;
      natureza_categoria: NaturezaCategoria;
      estado_linha: EstadoLinha;
      tipo_recibo: TipoRecibo;
      tratamento_pessoa: TratamentoPessoa;
    };
    CompositeTypes: Record<never, never>;
  };
};
