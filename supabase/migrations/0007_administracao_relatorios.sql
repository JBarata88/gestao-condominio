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
