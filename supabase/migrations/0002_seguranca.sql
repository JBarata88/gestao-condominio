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
