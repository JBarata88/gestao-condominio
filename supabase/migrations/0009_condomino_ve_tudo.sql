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
