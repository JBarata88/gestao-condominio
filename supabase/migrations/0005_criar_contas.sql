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
