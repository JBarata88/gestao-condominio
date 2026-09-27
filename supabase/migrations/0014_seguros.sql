-- ============================================================================
-- Apólices e recibos do seguro de habitação, por fração e por ano
--
-- Cada condómino tem de entregar à administração a cópia da apólice do seguro
-- de habitação e o recibo do pagamento. A administração regista, por ano, o
-- que cada fração já entregou, em Definições > Apólices e recibos.
--
-- Uma acta pode incluir a tabela destes dados num dos seus tópicos (como no
-- ponto 2 da Acta nº 35). A tabela é copiada para acta_seguros quando a acta
-- é guardada, pela mesma razão das presenças: a acta é um documento histórico
-- e não deve mudar se o registo mudar depois.
--
-- As instruções são idempotentes: aplicar esta migração duas vezes não dá erro.
-- ============================================================================

create table if not exists seguros_fracao (
  fracao_id     uuid not null references fracoes (id) on delete cascade,
  ano           smallint not null check (ano between 1900 and 2200),
  apolice       boolean not null default false,
  recibo        boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (fracao_id, ano)
);

comment on table seguros_fracao is
  'Entrega da cópia da apólice do seguro de habitação e do recibo, por fração e ano.';

alter table seguros_fracao enable row level security;

drop policy if exists "administrador gere seguros" on seguros_fracao;
create policy "administrador gere seguros" on seguros_fracao
  for all to authenticated using (e_admin()) with check (e_admin());

create table if not exists acta_seguros (
  acta_id        uuid not null references actas (id) on delete cascade,
  fracao_id      uuid not null references fracoes (id) on delete cascade,
  condomino_nome text not null,
  apolice        boolean not null default false,
  recibo         boolean not null default false,
  primary key (acta_id, fracao_id)
);

comment on table acta_seguros is
  'Tabela de apólices e recibos incluída numa acta: cópia de seguros_fracao no '
  'dia em que a acta foi guardada.';

alter table acta_seguros enable row level security;

drop policy if exists "seguros de actas publicadas visiveis" on acta_seguros;
create policy "seguros de actas publicadas visiveis" on acta_seguros
  for select to authenticated using (
    e_admin() or exists (
      select 1 from actas a where a.id = acta_id and a.estado = 'publicada'
    )
  );

drop policy if exists "administrador gere seguros de actas" on acta_seguros;
create policy "administrador gere seguros de actas" on acta_seguros
  for all to authenticated using (e_admin()) with check (e_admin());
