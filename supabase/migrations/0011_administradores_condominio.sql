-- ============================================================================
-- Administração do condomínio associada ao exercício, não à conta
--
-- Até aqui, marcar uma fração como "da administração" dava-lhe acesso de
-- administrador na aplicação inteira (ver e_admin() em 0007). Isso confundia
-- dois papéis diferentes: quem é o administrador do condomínio num dado ano
-- (um cargo que roda entre condóminos, ano a ano, como em qualquer prédio) e
-- quem tem acesso de escrita à aplicação (uma questão de conta, decidida em
-- Definições > Contas).
--
-- Esta migração separa os dois. A partir daqui:
--   - O acesso de administrador da aplicação depende só de profiles.papel.
--   - A administração do condomínio passa a ser uma lista de frações por ano,
--     só para mostrar quem geria o condomínio nesse exercício — em Painel,
--     Quotas e Relatórios. Não dá nenhum acesso extra.
--
-- As frações marcadas como administração hoje são transportadas para o
-- exercício activo, para não se perder a informação.
--
-- As instruções são idempotentes: aplicar esta migração duas vezes não dá erro.
-- ============================================================================

create table if not exists administradores_condominio (
  fracao_id  uuid not null references fracoes (id) on delete cascade,
  ano        smallint not null check (ano between 1900 and 2200),
  criado_em  timestamptz not null default now(),
  primary key (fracao_id, ano)
);

comment on table administradores_condominio is
  'Frações que administraram o condomínio em cada ano. Puramente informativo: '
  'não concede acesso nenhum na aplicação (ver e_admin()).';

alter table administradores_condominio enable row level security;

drop policy if exists "administradores do condominio visiveis" on administradores_condominio;
create policy "administradores do condominio visiveis" on administradores_condominio
  for select to authenticated using (true);

drop policy if exists "administrador gere administradores do condominio" on administradores_condominio;
create policy "administrador gere administradores do condominio" on administradores_condominio
  for all to authenticated using (e_admin()) with check (e_admin());

-- ---------------------------------------------------------------------------
-- Transporta as frações já marcadas como administração para o exercício
-- activo, antes de a coluna desaparecer. Condicional a a coluna ainda existir,
-- senão correr esta migração uma segunda vez rebentava aqui.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fracoes' and column_name = 'administracao'
  ) then
    insert into administradores_condominio (fracao_id, ano)
    select
      f.id,
      coalesce(
        (select (d.valor #>> '{}')::int from definicoes d where d.chave = 'ano_exercicio'),
        extract(year from now())::int
      )
    from fracoes f
    where f.administracao = true
    on conflict do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- e_admin() deixa de olhar para fracoes.administracao: o acesso de
-- administrador passa a depender só de profiles.papel.
-- ---------------------------------------------------------------------------
create or replace function e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.papel = 'admin' from profiles p where p.id = auth.uid()),
    false
  );
$$;

alter table fracoes drop column if exists administracao;
