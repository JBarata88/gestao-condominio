-- ===========================================================================
-- FICHEIRO GERADO. Não editar à mão.
-- Gerado por scripts/gerar-sql-completo.mjs a partir de supabase/migrations/
--
-- Como usar:
--   1. Abre o teu projecto em supabase.com
--   2. Vai a SQL Editor e cria uma query nova
--   3. Cola este ficheiro inteiro e carrega em Run
--
-- Corre uma só vez. Correr duas vezes dá erro de objectos já existentes,
-- o que é o comportamento pretendido: evita duplicar os dados iniciais.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0001_esquema.sql
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 0002_seguranca.sql
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Row Level Security
--
-- O isolamento entre administrador e condómino vive aqui, no Postgres, e não
-- em verificações nas páginas. A chave anónima do Supabase é pública e vai
-- num repositório público, por isso é esta camada que impede um condómino de
-- ler as contas dos vizinhos chamando a API directamente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Funções auxiliares
--
-- São SECURITY DEFINER para conseguirem ler "profiles" sem accionar as
-- políticas dessa própria tabela, o que provocaria recursão infinita.
-- ---------------------------------------------------------------------------
create function e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select papel = 'admin' from profiles where id = auth.uid()),
    false
  );
$$;

create function fracao_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select fracao_id from profiles where id = auth.uid();
$$;

revoke execute on function e_admin() from public;
revoke execute on function fracao_atual() from public;
grant execute on function e_admin() to authenticated;
grant execute on function fracao_atual() to authenticated;

-- ---------------------------------------------------------------------------
-- Activar RLS em todas as tabelas.
-- Sem política explícita, o acesso fica negado por omissão.
-- ---------------------------------------------------------------------------
alter table condominio         enable row level security;
alter table fracoes            enable row level security;
alter table profiles           enable row level security;
alter table fornecedores       enable row level security;
alter table categorias         enable row level security;
alter table movimentos         enable row level security;
alter table saldos_iniciais    enable row level security;
alter table extratos           enable row level security;
alter table extrato_linhas     enable row level security;
alter table regras_conciliacao enable row level security;
alter table assembleias        enable row level security;
alter table recibos            enable row level security;
alter table definicoes         enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: cada um vê o seu; o administrador vê e gere todos.
-- ---------------------------------------------------------------------------
create policy "perfil proprio visivel" on profiles
  for select to authenticated
  using (id = auth.uid() or e_admin());

create policy "administrador gere perfis" on profiles
  for all to authenticated
  using (e_admin()) with check (e_admin());

-- ---------------------------------------------------------------------------
-- condominio, categorias, definicoes, assembleias:
-- leitura para qualquer autenticado, escrita só do administrador.
-- ---------------------------------------------------------------------------
create policy "cabecalho visivel" on condominio
  for select to authenticated using (true);
create policy "administrador edita cabecalho" on condominio
  for all to authenticated using (e_admin()) with check (e_admin());

create policy "categorias visiveis" on categorias
  for select to authenticated using (true);
create policy "administrador edita categorias" on categorias
  for all to authenticated using (e_admin()) with check (e_admin());

create policy "definicoes visiveis" on definicoes
  for select to authenticated using (true);
create policy "administrador edita definicoes" on definicoes
  for all to authenticated using (e_admin()) with check (e_admin());

create policy "assembleias visiveis" on assembleias
  for select to authenticated using (true);
create policy "administrador edita assembleias" on assembleias
  for all to authenticated using (e_admin()) with check (e_admin());

-- ---------------------------------------------------------------------------
-- fracoes: o condómino vê apenas a sua.
--
-- Os nomes, emails e telefones dos vizinhos são dados pessoais e não devem
-- ficar acessíveis a quem entra com uma conta de condómino.
-- ---------------------------------------------------------------------------
create policy "condomino ve a sua fracao" on fracoes
  for select to authenticated
  using (e_admin() or id = fracao_atual());

create policy "administrador gere fracoes" on fracoes
  for all to authenticated using (e_admin()) with check (e_admin());

-- ---------------------------------------------------------------------------
-- movimentos: o condómino vê apenas as linhas da sua fração.
-- ---------------------------------------------------------------------------
create policy "condomino ve os seus movimentos" on movimentos
  for select to authenticated
  using (e_admin() or fracao_id = fracao_atual());

create policy "administrador gere movimentos" on movimentos
  for all to authenticated using (e_admin()) with check (e_admin());

-- ---------------------------------------------------------------------------
-- recibos: o condómino descarrega os seus.
-- ---------------------------------------------------------------------------
create policy "condomino ve os seus recibos" on recibos
  for select to authenticated
  using (e_admin() or fracao_id = fracao_atual());

create policy "administrador gere recibos" on recibos
  for all to authenticated using (e_admin()) with check (e_admin());

-- ---------------------------------------------------------------------------
-- Exclusivo do administrador: fornecedores (com IBAN), saldos, extratos
-- bancários e regras de conciliação. Sem política de leitura para condóminos,
-- portanto ficam inacessíveis.
-- ---------------------------------------------------------------------------
create policy "administrador gere fornecedores" on fornecedores
  for all to authenticated using (e_admin()) with check (e_admin());

create policy "administrador gere saldos" on saldos_iniciais
  for all to authenticated using (e_admin()) with check (e_admin());

create policy "administrador gere extratos" on extratos
  for all to authenticated using (e_admin()) with check (e_admin());

create policy "administrador gere linhas de extrato" on extrato_linhas
  for all to authenticated using (e_admin()) with check (e_admin());

create policy "administrador gere regras" on regras_conciliacao
  for all to authenticated using (e_admin()) with check (e_admin());

-- ---------------------------------------------------------------------------
-- O papel anónimo não tem acesso a nada. Só conta autenticada.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- 0003_dados_iniciais.sql
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Dados iniciais
--
-- Só estrutura. Nomes, contactos, quotas e saldos são dados pessoais e
-- financeiros reais, e este repositório é público, por isso entram através do
-- script local scripts/carregar-dados-reais.ts ou pela página de Definições.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Categorias, da folha "DATA" do ficheiro original.
--
-- A folha chamava-lhe "Quotizações 2026", com o ano no nome, o que obrigava a
-- criar uma categoria nova todos os anos e partia a comparação entre
-- exercícios. Aqui a categoria é "Quotizações" e o ano vem da data do
-- movimento; o mapa continua a imprimir "Quotizações 2026" no relatório.
-- ---------------------------------------------------------------------------
insert into categorias (nome, natureza, linha_moaf, ordem, sistema) values
  ('Quotizações',                      'receita',       'Quotizações',                        10, true),
  ('Juros depósitos a prazo',          'receita',       'Juros depósitos a prazo',            20, true),
  ('Juros conta poupança',             'receita',       'Juros conta poupança - condominio',  30, true),
  ('Reforço Fundos Obras',             'receita',       'Reforço Fundos Obras',               40, true),

  ('Agua',                             'despesa',       'Agua',                              110, false),
  ('Correios',                         'despesa',       'Correios',                          120, false),
  ('Seguros',                          'despesa',       'Seguros',                           130, false),
  ('Despesas bancárias',               'despesa',       'Despesas bancárias',                140, false),
  ('Electricidade',                    'despesa',       'Electricidade',                     150, false),
  ('Ferramentas e utensílios',         'despesa',       'Ferramentas e utensilios',          160, false),
  ('Materiais de limpeza',             'despesa',       'Materiais de limpeza',              170, false),
  ('Obras e reparações',               'despesa',       'Obras e reparações',                180, false),
  ('Papelaria',                        'despesa',       'Papelaria',                         190, false),
  ('Pagamentos a pessoal',             'despesa',       'Pagamentos a pessoal',              200, false),
  ('Presença Reunião',                 'despesa',       'Presença Reunião',                  210, false),

  ('Depósito Bancário',                'transferencia', null,                                300, true);

-- ---------------------------------------------------------------------------
-- Frações: a estrutura do prédio, oito frações de A a H.
-- Os nomes dos condóminos e as quotas ficam por preencher.
-- ---------------------------------------------------------------------------
insert into fracoes (letra, andar, ordem, quota_mensal) values
  ('A', '1º DTO', 1, 0),
  ('B', '1º ESQ', 2, 0),
  ('C', '2º DTO', 3, 0),
  ('D', '2º ESQ', 4, 0),
  ('E', '3º DTO', 5, 0),
  ('F', '3º ESQ', 6, 0),
  ('G', '4º DTO', 7, 0),
  ('H', '4º ESQ', 8, 0);

-- ---------------------------------------------------------------------------
-- Definições da aplicação
-- ---------------------------------------------------------------------------
insert into definicoes (chave, valor, descricao) values
  ('dia_limite_quota', '8'::jsonb,
   'Dia do mês até ao qual as quotas devem ser pagas.'),
  ('ano_exercicio', '2026'::jsonb,
   'Ano do exercício em curso, usado por omissão nos relatórios.'),
  ('localidade_recibos', '"Póvoa de Santa Iria"'::jsonb,
   'Localidade impressa acima da data nos recibos.'),
  ('valor_presenca_assembleia', '5'::jsonb,
   'Valor pago por presença em assembleia, por omissão.'),
  ('assinatura_recibos', '"A administração"'::jsonb,
   'Texto da linha de assinatura nos recibos de quota.');

-- ---------------------------------------------------------------------------
-- Regras de conciliação do extrato bancário, a partir das descrições que já
-- aparecem no histórico de 2026. Comparadas sem acentos nem maiúsculas.
-- ---------------------------------------------------------------------------
insert into regras_conciliacao (padrao, categoria_id, prioridade)
select padrao, categorias.id, prioridade
from (values
  ('comissao',            'Despesas bancárias',  10),
  ('manutencao conta',    'Despesas bancárias',  10),
  ('manutencao de conta', 'Despesas bancárias',  10),
  ('despesas bancarias',  'Despesas bancárias',  10),
  ('seguro',              'Seguros',             20),
  ('luz',                 'Electricidade',       20),
  ('edp',                 'Electricidade',       20),
  ('electricidade',       'Electricidade',       20),
  ('eletricidade',        'Electricidade',       20),
  ('agua',                'Agua',                20),
  ('smas',                'Agua',                20),
  ('limpeza',             'Pagamentos a pessoal', 30),
  ('quota',               'Quotizações',         40)
) as r(padrao, nome_categoria, prioridade)
join categorias on categorias.nome = r.nome_categoria;

-- ---------------------------------------------------------------------------
-- Saldos de abertura a zero. Os valores reais entram pela página de Definições.
-- ---------------------------------------------------------------------------
insert into saldos_iniciais (ano) values (2026);

-- ---------------------------------------------------------------------------
-- 0004_regras_extra.sql
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Regras de conciliação em falta
--
-- Nasceram de um extrato real do banco, que trouxe descrições que a lista
-- inicial não apanhava:
--
--   "IMP. SELO S/ COMISSÕES"                    -> imposto de selo
--   "IMP.SELO MANUTENÇÃO DE CONTA"              -> imposto de selo
--   "COMISSÕES E GASTOS"                        -> plural, não batia com "comissao"
--   "MANUTENCAO TELHADO"                        -> obras
--   "...AGUA E SANEAMENTO..."                   -> água
--
-- Nota: quem aplicar as migrações de raiz recebe estas regras aqui. Numa base
-- já existente, o mesmo resultado obtém-se com
--   npx tsx scripts/aplicar-regras.ts
-- que é idempotente e serve para voltar a alinhar a lista quando ela mudar.
-- ============================================================================

-- "comissao" não apanhava "COMISSÕES", que sem acentos fica "comissoes".
-- O prefixo "comiss" cobre singular e plural.
update regras_conciliacao
   set padrao = 'comiss'
 where padrao = 'comissao';

insert into regras_conciliacao (padrao, categoria_id, prioridade)
select r.padrao, categorias.id, r.prioridade
from (values
  ('imposto de selo',   'Despesas bancárias',  10),
  ('imp. selo',         'Despesas bancárias',  10),
  ('imp.selo',          'Despesas bancárias',  10),
  ('saneamento',        'Agua',                20),
  ('telhado',           'Obras e reparações',  25)
) as r(padrao, nome_categoria, prioridade)
join categorias on categorias.nome = r.nome_categoria
where not exists (
  select 1 from regras_conciliacao existente
   where existente.padrao = r.padrao
);

-- ---------------------------------------------------------------------------
-- 0005_criar_contas.sql
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Permitir criar contas de condómino sem fração atribuída
--
-- A restrição condomino_tem_fracao exigia que qualquer perfil de condómino
-- tivesse uma fração. Como o gatilho ao_criar_utilizador cria todos os novos
-- utilizadores como condóminos, criar uma conta pelo painel do Supabase
-- falhava com "Database error creating new user", sem explicação nenhuma.
--
-- A restrição também não acrescentava segurança. As políticas já falham para
-- o lado seguro: fracao_atual() devolve NULL, a comparação "fracao_id = NULL"
-- nunca é verdadeira, e o condómino sem fração não vê linha nenhuma. Ou seja,
-- uma conta por atribuir não vê nada, em vez de rebentar na criação.
--
-- Fica um índice para a administração conseguir encontrar depressa as contas
-- que ainda estão por atribuir.
-- ============================================================================

alter table profiles drop constraint if exists condomino_tem_fracao;

comment on column profiles.fracao_id is
  'Fração que este condómino pode ver. Enquanto estiver NULL, a conta não '
  'tem acesso a dados nenhuns, o que é a falha segura.';

create index if not exists profiles_condominos_sem_fracao_idx
  on profiles (papel)
  where papel = 'condomino' and fracao_id is null;

-- ---------------------------------------------------------------------------
-- 0006_intervalo_quota.sql
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Intervalo de meses num pagamento de quota
--
-- Um pagamento em lote pode cobrir vários meses de uma vez, tal como a folha
-- antiga escrevia "QUOTA JAN-JUL FRACÇÃO A". Esta coluna guarda o fim desse
-- intervalo; quota_mes continua a guardar o início.
--
-- É puramente informativo. A matriz de Quotas já não depende de nenhuma
-- etiqueta de mês: soma-se o total pago pela fração e
-- distribui-se em cascata pelos doze meses. Esta coluna serve só para deixar
-- escrito, no próprio movimento, a que meses uma transferência em concreto
-- respeitava, para quem estiver a rever o livro de movimentos.
-- ============================================================================

alter table movimentos add column quota_mes_fim date;

alter table movimentos add constraint quota_fim_no_primeiro_dia
  check (quota_mes_fim is null or extract(day from quota_mes_fim) = 1);

alter table movimentos add constraint quota_fim_exige_inicio
  check (quota_mes_fim is null or quota_mes is not null);

alter table movimentos add constraint quota_fim_nao_antes_do_inicio
  check (quota_mes_fim is null or quota_mes_fim >= quota_mes);

comment on column movimentos.quota_mes_fim is
  'Fim do intervalo de meses que este pagamento cobre, quando cobre mais do '
  'que um. NULL significa um só mês (o de quota_mes) ou nenhum.';

-- ---------------------------------------------------------------------------
-- 0007_administracao_relatorios.sql
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Frações da administração e mapa de fundos visível ao condómino
--
-- 1. Uma fração pode ser marcada como "da administração". O condómino ligado a
--    essa fração passa a ter acesso de administrador, sem ser preciso mexer
--    directamente em profiles.papel. O primeiro utilizador continua a ser
--    promovido a admin pelo gatilho ao_criar_utilizador, como rede de segurança.
--
-- 2. O mapa de origem e aplicação de fundos passa a estar acessível a qualquer
--    condómino, em leitura, através de uma função agregada. A função não
--    devolve movimentos individuais, descrições nem a que fração cada linha
--    pertence, por isso não expõe os dados dos vizinhos.
--
-- As instruções são idempotentes: aplicar esta migração duas vezes não dá erro.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Fração da administração
-- ---------------------------------------------------------------------------
alter table fracoes
  add column if not exists administracao boolean not null default false;

comment on column fracoes.administracao is
  'Quando verdadeiro, o condómino ligado a esta fração tem acesso de '
  'administrador. Complementa profiles.papel = ''admin'', que continua a valer '
  'para o primeiro utilizador e para contas sem fração.';

-- e_admin() passa a considerar também a fração da administração. Continua
-- SECURITY DEFINER, e como corre com o dono da função (que ignora RLS) a
-- leitura de fracoes aqui não aciona as políticas dessa tabela nem provoca
-- recursão.
create or replace function e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.papel = 'admin' or coalesce(f.administracao, false)
      from profiles p
      left join fracoes f on f.id = p.fracao_id
      where p.id = auth.uid()
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Saldos de abertura visíveis a qualquer autenticado
--
-- São quatro totais por ano, não são dados pessoais. Ficam legíveis para o
-- mapa de fundos poder fechar do lado do condómino. A escrita continua
-- reservada ao administrador pela política "administrador gere saldos".
-- ---------------------------------------------------------------------------
drop policy if exists "saldos de abertura visiveis" on saldos_iniciais;
create policy "saldos de abertura visiveis" on saldos_iniciais
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Resumo do exercício para o mapa de origem e aplicação de fundos
--
-- Agrega por conta, natureza e linha do mapa. Não devolve datas, descrições
-- nem fracao_id, por isso pode ser lido por qualquer condómino sem revelar os
-- movimentos dos outros. SECURITY DEFINER para atravessar o RLS de movimentos.
-- ---------------------------------------------------------------------------
create or replace function resumo_exercicio(p_inicio date, p_fim date)
returns table (
  conta       tipo_conta,
  natureza    natureza_categoria,
  linha_moaf  text,
  receita     numeric,
  despesa     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.conta,
    c.natureza,
    coalesce(c.linha_moaf, c.nome) as linha_moaf,
    sum(m.receita) as receita,
    sum(m.despesa) as despesa
  from movimentos m
  join categorias c on c.id = m.categoria_id
  where m.data between p_inicio and p_fim
  group by m.conta, c.natureza, coalesce(c.linha_moaf, c.nome);
$$;

revoke execute on function resumo_exercicio(date, date) from public;
grant execute on function resumo_exercicio(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 0008_multiplos_anos.sql
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Vários exercícios na mesma instalação
--
-- A app deixa de estar presa a um único ano. A definição "ano_exercicio"
-- continua a valer como ano por omissão, mas qualquer ano com dados passa a
-- ser consultável através do seletor de ano.
--
-- A quota mensal de cada fração passa a poder variar de ano para ano. A folha
-- antiga tinha um valor só, e mudá-lo reescrevia o "devido" de todos os anos
-- anteriores. Aqui guarda-se a quota por (fração, ano); quando não há linha
-- para um ano, usa-se fracoes.quota_mensal como quota base.
--
-- As instruções são idempotentes: aplicar esta migração duas vezes não dá erro.
-- ============================================================================

create table if not exists quotas_fracao (
  fracao_id     uuid not null references fracoes (id) on delete cascade,
  ano           smallint not null check (ano between 1900 and 2200),
  quota_mensal  numeric(10, 2) not null default 0 check (quota_mensal >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (fracao_id, ano)
);

comment on table quotas_fracao is
  'Quota mensal de uma fração num exercício. Sem linha para um ano, vale '
  'fracoes.quota_mensal.';

alter table quotas_fracao enable row level security;

-- O condómino vê apenas a quota da sua fração, como acontece com fracoes e
-- movimentos. A escrita é reservada ao administrador.
drop policy if exists "condomino ve a sua quota" on quotas_fracao;
create policy "condomino ve a sua quota" on quotas_fracao
  for select to authenticated
  using (e_admin() or fracao_id = fracao_atual());

drop policy if exists "administrador gere quotas" on quotas_fracao;
create policy "administrador gere quotas" on quotas_fracao
  for all to authenticated using (e_admin()) with check (e_admin());

-- ---------------------------------------------------------------------------
-- 0009_condomino_ve_tudo.sql
-- ---------------------------------------------------------------------------

-- ============================================================================
-- O condómino passa a consultar as contas todas
--
-- Até aqui um condómino via apenas a sua fração, os movimentos dela e a sua
-- quota. Na prática isso deixava as contas do condomínio fechadas a quem tem
-- direito legal a consultá-las, e uma conta ainda sem fração atribuída não via
-- absolutamente nada.
--
-- A partir daqui qualquer autenticado lê os movimentos, o mapa de quotas e as
-- frações — nome do condómino incluído, como já aparece nas actas. A escrita
-- continua reservada à administração pelas políticas "administrador gere ...",
-- que não se mexem. Fornecedores (com IBAN), saldos, extratos bancários e
-- regras de conciliação também ficam como estavam: exclusivos da administração.
--
-- As instruções são idempotentes: aplicar esta migração duas vezes não dá erro.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- movimentos: leitura para qualquer autenticado.
-- ---------------------------------------------------------------------------
drop policy if exists "condomino ve os seus movimentos" on movimentos;
drop policy if exists "movimentos visiveis" on movimentos;
create policy "movimentos visiveis" on movimentos
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- fracoes: leitura para qualquer autenticado.
--
-- Deixa de esconder as frações dos vizinhos. Os nomes já constam das actas de
-- assembleia; o email e o telefone ficam à vista de quem entra com conta.
-- ---------------------------------------------------------------------------
drop policy if exists "condomino ve a sua fracao" on fracoes;
drop policy if exists "fracoes visiveis" on fracoes;
create policy "fracoes visiveis" on fracoes
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- quotas_fracao: leitura para qualquer autenticado, para o mapa de quotas
-- mostrar todas as frações e não só a do próprio.
-- ---------------------------------------------------------------------------
drop policy if exists "condomino ve a sua quota" on quotas_fracao;
drop policy if exists "quotas visiveis" on quotas_fracao;
create policy "quotas visiveis" on quotas_fracao
  for select to authenticated using (true);

commit;
