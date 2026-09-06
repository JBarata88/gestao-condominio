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
