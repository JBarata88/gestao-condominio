-- ============================================================================
-- Actas das assembleias de condóminos
--
-- A administração prepara cada acta em Definições > Actas: cabeçalho (número,
-- data, horas, local), os tópicos da ordem de trabalhos com a decisão e os
-- comentários de cada um, e os condóminos presentes. Enquanto está em
-- rascunho só a administração a vê; depois de publicada, qualquer condómino a
-- pode consultar na secção Actas e descarregar o documento Word.
--
-- O nome do condómino e a permilagem dos presentes são copiados da fração no
-- momento em que a acta é guardada: uma acta é um documento histórico e não
-- deve mudar se a fração for alterada depois.
--
-- As instruções são idempotentes: aplicar esta migração duas vezes não dá erro.
-- ============================================================================

create table if not exists actas (
  id            uuid primary key default gen_random_uuid(),
  numero        integer not null unique check (numero > 0),
  data          date not null,
  hora_inicio   text not null default '11.00',
  hora_fim      text,
  local         text not null default '',
  estado        text not null default 'rascunho'
                check (estado in ('rascunho', 'publicada')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table actas is
  'Actas das assembleias de condóminos. Os condóminos só vêem as publicadas.';

create table if not exists acta_topicos (
  id         uuid primary key default gen_random_uuid(),
  acta_id    uuid not null references actas (id) on delete cascade,
  ordem      smallint not null,
  titulo     text not null,
  decisao    text check (decisao in ('aprovado_unanimidade', 'reprovado')),
  comentario text not null default ''
);

comment on column acta_topicos.decisao is
  'Vazio quando o tópico foi só informativo e não houve votação.';

create index if not exists acta_topicos_acta_idx on acta_topicos (acta_id, ordem);

create table if not exists acta_presencas (
  acta_id        uuid not null references actas (id) on delete cascade,
  fracao_id      uuid not null references fracoes (id) on delete cascade,
  condomino_nome text not null,
  forma          text not null default 'Presencial',
  permilagem     numeric(8, 3),
  primary key (acta_id, fracao_id)
);

comment on table acta_presencas is
  'Condóminos presentes ou representados na assembleia. Nome e permilagem são '
  'uma cópia da fração no dia em que a acta foi guardada.';

-- ---------------------------------------------------------------------------
-- Segurança: a administração gere tudo; os condóminos lêem só o que está
-- publicado.
-- ---------------------------------------------------------------------------
alter table actas enable row level security;
alter table acta_topicos enable row level security;
alter table acta_presencas enable row level security;

drop policy if exists "actas publicadas visiveis" on actas;
create policy "actas publicadas visiveis" on actas
  for select to authenticated using (estado = 'publicada' or e_admin());

drop policy if exists "administrador gere actas" on actas;
create policy "administrador gere actas" on actas
  for all to authenticated using (e_admin()) with check (e_admin());

drop policy if exists "topicos de actas publicadas visiveis" on acta_topicos;
create policy "topicos de actas publicadas visiveis" on acta_topicos
  for select to authenticated using (
    e_admin() or exists (
      select 1 from actas a where a.id = acta_id and a.estado = 'publicada'
    )
  );

drop policy if exists "administrador gere topicos de actas" on acta_topicos;
create policy "administrador gere topicos de actas" on acta_topicos
  for all to authenticated using (e_admin()) with check (e_admin());

drop policy if exists "presencas de actas publicadas visiveis" on acta_presencas;
create policy "presencas de actas publicadas visiveis" on acta_presencas
  for select to authenticated using (
    e_admin() or exists (
      select 1 from actas a where a.id = acta_id and a.estado = 'publicada'
    )
  );

drop policy if exists "administrador gere presencas de actas" on acta_presencas;
create policy "administrador gere presencas de actas" on acta_presencas
  for all to authenticated using (e_admin()) with check (e_admin());
