-- ============================================================================
-- Esquema base da gestão de condomínio
--
-- Substitui o ficheiro CONTROLO GESTAO CONDOMINIO 2026.xlsx. A folha
-- "DATA EXPORT" corresponde à tabela "movimentos"; as folhas mensais e o mapa
-- anual passam a ser vistas calculadas, não dados guardados.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type papel_utilizador as enum ('admin', 'condomino');
create type tipo_conta as enum ('banco', 'caixa');
create type natureza_categoria as enum ('receita', 'despesa', 'transferencia');
create type estado_linha as enum ('pendente', 'conciliado', 'ignorado', 'duplicado');
create type tipo_recibo as enum ('quota', 'presenca', 'pagamento');
create type tratamento_pessoa as enum ('masculino', 'feminino');

-- ---------------------------------------------------------------------------
-- Identificação do condomínio (linha única)
-- ---------------------------------------------------------------------------
create table condominio (
  id            smallint primary key default 1 check (id = 1),
  nome          text not null,
  morada        text not null,
  codigo_postal text not null,
  localidade    text not null,
  nif           text not null,
  nib           text,
  iban          text,
  atualizado_em timestamptz not null default now()
);

comment on table condominio is
  'Linha única com o cabeçalho usado em relatórios e recibos.';

-- ---------------------------------------------------------------------------
-- Frações e condóminos
-- ---------------------------------------------------------------------------
create table fracoes (
  id             uuid primary key default gen_random_uuid(),
  letra          text not null unique,
  andar          text not null,
  ordem          smallint not null,
  condomino_nome text,
  tratamento     tratamento_pessoa not null default 'masculino',
  email          text,
  telefone       text,
  permilagem     numeric(8, 3),
  quota_mensal   numeric(10, 2) not null default 0 check (quota_mensal >= 0),
  ativo          boolean not null default true,
  atualizado_em  timestamptz not null default now()
);

comment on column fracoes.tratamento is
  'Os recibos concordam em género: "do condómino" ou "da condómina".';

-- ---------------------------------------------------------------------------
-- Utilizadores
-- ---------------------------------------------------------------------------
create table profiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  nome      text,
  papel     papel_utilizador not null default 'condomino',
  fracao_id uuid references fracoes (id) on delete set null,
  criado_em timestamptz not null default now()
);

comment on column profiles.fracao_id is
  'Um condómino só vê os dados desta fração. Obrigatório para o papel condomino.';

alter table profiles add constraint condomino_tem_fracao
  check (papel = 'admin' or fracao_id is not null);

-- Cada utilizador autenticado tem sempre um perfil, mesmo que criado fora da
-- página de Definições. Sem isto as políticas de segurança negariam tudo.
--
-- O papel nunca é assumido como 'admin' a partir dos metadados enviados pelo
-- cliente, porque esses metadados são controláveis por quem faz o pedido de
-- registo. Só o primeiro utilizador do sistema é promovido a administrador,
-- para permitir o arranque; a partir daí um condómino sem fração indicada faz
-- o registo falhar, que é a falha segura.
create function tratar_novo_utilizador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primeiro boolean;
  papel_novo papel_utilizador;
begin
  select not exists (select 1 from public.profiles) into primeiro;
  papel_novo := case when primeiro then 'admin' else 'condomino' end;

  insert into public.profiles (id, nome, papel, fracao_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email),
    papel_novo,
    case
      when papel_novo = 'condomino'
      then (new.raw_user_meta_data ->> 'fracao_id')::uuid
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger ao_criar_utilizador
  after insert on auth.users
  for each row execute function tratar_novo_utilizador();

-- ---------------------------------------------------------------------------
-- Fornecedores
-- ---------------------------------------------------------------------------
create table fornecedores (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  tipo          text,
  email         text,
  telefone      text,
  iban          text,
  notas         text,
  ativo         boolean not null default true,
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Categorias (folha "DATA" do ficheiro original)
-- ---------------------------------------------------------------------------
create table categorias (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null unique,
  natureza     natureza_categoria not null,
  -- Rótulo da linha correspondente no mapa de origem e aplicação de fundos.
  linha_moaf   text,
  ordem        smallint not null default 0,
  ativo        boolean not null default true,
  -- Categorias de sistema não podem ser apagadas: o código depende delas.
  sistema      boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Movimentos: o livro de contas
-- ---------------------------------------------------------------------------
create table movimentos (
  id               uuid primary key default gen_random_uuid(),
  data             date not null,
  doc              text,
  categoria_id     uuid not null references categorias (id) on delete restrict,
  descricao        text,
  conta            tipo_conta not null,
  receita          numeric(10, 2) not null default 0 check (receita >= 0),
  despesa          numeric(10, 2) not null default 0 check (despesa >= 0),
  fracao_id        uuid references fracoes (id) on delete set null,
  fornecedor_id    uuid references fornecedores (id) on delete set null,
  -- Primeiro dia do mês a que a quota respeita, para a matriz de quotas.
  quota_mes        date,
  -- Liga as duas metades de um depósito bancário (saída de caixa, entrada em banco).
  transferencia_id uuid,
  extrato_linha_id uuid,
  criado_em        timestamptz not null default now(),
  criado_por       uuid references auth.users (id) on delete set null,

  -- Uma linha é receita ou despesa, nunca as duas. A folha original juntava
  -- quatro colunas de valor por linha, o que permitia estados ambíguos.
  constraint receita_ou_despesa check (receita = 0 or despesa = 0),
  constraint tem_valor check (receita > 0 or despesa > 0),
  constraint quota_no_primeiro_dia check (
    quota_mes is null or extract(day from quota_mes) = 1
  )
);

create index movimentos_data_idx on movimentos (data);
create index movimentos_categoria_idx on movimentos (categoria_id);
create index movimentos_fracao_idx on movimentos (fracao_id);
create index movimentos_quota_idx on movimentos (fracao_id, quota_mes)
  where quota_mes is not null;
create index movimentos_transferencia_idx on movimentos (transferencia_id)
  where transferencia_id is not null;

-- ---------------------------------------------------------------------------
-- Saldos de abertura do exercício ("A - Administração anterior" no mapa)
-- ---------------------------------------------------------------------------
create table saldos_iniciais (
  ano             smallint primary key,
  caixa           numeric(12, 2) not null default 0,
  deposito_ordem  numeric(12, 2) not null default 0,
  deposito_prazo  numeric(12, 2) not null default 0,
  conta_poupanca  numeric(12, 2) not null default 0,
  atualizado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Extratos bancários importados
-- ---------------------------------------------------------------------------
create table extratos (
  id             uuid primary key default gen_random_uuid(),
  nome_ficheiro  text not null,
  ficheiro_path  text,
  banco          text,
  periodo_inicio date,
  periodo_fim    date,
  total_linhas   integer not null default 0,
  importado_em   timestamptz not null default now(),
  importado_por  uuid references auth.users (id) on delete set null
);

create table extrato_linhas (
  id                    uuid primary key default gen_random_uuid(),
  extrato_id            uuid not null references extratos (id) on delete cascade,
  linha_origem          integer,
  data_mov              date not null,
  data_valor            date,
  descricao             text not null,
  -- Positivo é entrada, negativo é saída, ao contrário das duas colunas da folha.
  valor                 numeric(10, 2) not null,
  saldo                 numeric(12, 2),
  -- Evita importar o mesmo movimento duas vezes a partir de extratos sobrepostos.
  impressao_digital     text not null,
  estado                estado_linha not null default 'pendente',
  movimento_id          uuid references movimentos (id) on delete set null,
  sugestao_categoria_id uuid references categorias (id) on delete set null,
  sugestao_fracao_id    uuid references fracoes (id) on delete set null,
  sugestao_quota_mes    date,
  confianca             numeric(3, 2) check (confianca between 0 and 1)
);

create unique index extrato_linhas_impressao_idx
  on extrato_linhas (impressao_digital);
create index extrato_linhas_estado_idx on extrato_linhas (extrato_id, estado);

alter table movimentos
  add constraint movimentos_extrato_linha_fk
  foreign key (extrato_linha_id) references extrato_linhas (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Regras de conciliação automática
-- ---------------------------------------------------------------------------
create table regras_conciliacao (
  id            uuid primary key default gen_random_uuid(),
  -- Comparado sem acentos e sem maiúsculas contra a descrição do banco.
  padrao        text not null,
  categoria_id  uuid references categorias (id) on delete cascade,
  fracao_id     uuid references fracoes (id) on delete cascade,
  fornecedor_id uuid references fornecedores (id) on delete cascade,
  prioridade    smallint not null default 100,
  ativo         boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Assembleias, para os recibos de presença
-- ---------------------------------------------------------------------------
create table assembleias (
  id              uuid primary key default gen_random_uuid(),
  data            date not null,
  descricao       text,
  valor_presenca  numeric(10, 2) not null default 0
);

-- ---------------------------------------------------------------------------
-- Recibos emitidos
-- ---------------------------------------------------------------------------
create table recibos (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,
  tipo             tipo_recibo not null,
  fracao_id        uuid references fracoes (id) on delete set null,
  destinatario     text not null,
  valor            numeric(10, 2) not null,
  data_emissao     date not null,
  periodo_texto    text,
  assembleia_id    uuid references assembleias (id) on delete set null,
  movimento_id     uuid references movimentos (id) on delete set null,
  ficheiro_path    text,
  criado_em        timestamptz not null default now(),
  criado_por       uuid references auth.users (id) on delete set null
);

create index recibos_fracao_idx on recibos (fracao_id);

-- ---------------------------------------------------------------------------
-- Definições da aplicação
-- ---------------------------------------------------------------------------
create table definicoes (
  chave         text primary key,
  valor         jsonb not null,
  descricao     text,
  atualizado_em timestamptz not null default now()
);
