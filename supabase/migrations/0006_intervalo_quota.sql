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
