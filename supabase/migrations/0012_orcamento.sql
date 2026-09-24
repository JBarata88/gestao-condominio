-- ============================================================================
-- Orçamento aprovado em assembleia, por ano
--
-- Cada exercício pode ter um orçamento aprovado em assembleia: um valor
-- previsto por categoria (a mesma lista de categorias dos movimentos), mais
-- as disponibilidades previstas no fim do ano (caixa, banco, etc.). Serve
-- para o relatório "Orçamento vs Realizado", que compara isto com os valores
-- reais do exercício.
--
-- A administração anterior (saldos de abertura) não tem tabela própria aqui:
-- o valor previsto é sempre igual ao real, porque já é conhecido quando o
-- orçamento é escrito — reutiliza-se saldos_iniciais.
--
-- As instruções são idempotentes: aplicar esta migração duas vezes não dá erro.
-- ============================================================================

create table if not exists orcamento_categorias (
  categoria_id  uuid not null references categorias (id) on delete cascade,
  ano           smallint not null check (ano between 1900 and 2200),
  valor         numeric(10, 2) not null default 0 check (valor >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (categoria_id, ano)
);

comment on table orcamento_categorias is
  'Valor previsto por categoria, no orçamento aprovado em assembleia para o ano.';

alter table orcamento_categorias enable row level security;

drop policy if exists "orcamento de categorias visivel" on orcamento_categorias;
create policy "orcamento de categorias visivel" on orcamento_categorias
  for select to authenticated using (true);

drop policy if exists "administrador gere orcamento de categorias" on orcamento_categorias;
create policy "administrador gere orcamento de categorias" on orcamento_categorias
  for all to authenticated using (e_admin()) with check (e_admin());

create table if not exists orcamento_disponibilidades (
  ano            smallint primary key check (ano between 1900 and 2200),
  caixa          numeric(10, 2) not null default 0 check (caixa >= 0),
  deposito_ordem numeric(10, 2) not null default 0 check (deposito_ordem >= 0),
  deposito_prazo numeric(10, 2) not null default 0 check (deposito_prazo >= 0),
  conta_poupanca numeric(10, 2) not null default 0 check (conta_poupanca >= 0),
  atualizado_em  timestamptz not null default now()
);

comment on table orcamento_disponibilidades is
  'Disponibilidades previstas no fim do ano, no orçamento aprovado em assembleia.';

alter table orcamento_disponibilidades enable row level security;

drop policy if exists "orcamento de disponibilidades visivel" on orcamento_disponibilidades;
create policy "orcamento de disponibilidades visivel" on orcamento_disponibilidades
  for select to authenticated using (true);

drop policy if exists "administrador gere orcamento de disponibilidades" on orcamento_disponibilidades;
create policy "administrador gere orcamento de disponibilidades" on orcamento_disponibilidades
  for all to authenticated using (e_admin()) with check (e_admin());
