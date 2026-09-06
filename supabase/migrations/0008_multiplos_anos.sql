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
