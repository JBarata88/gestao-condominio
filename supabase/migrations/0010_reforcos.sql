-- ============================================================================
-- Reforços extraordinários, com a mesma lógica das quotas
--
-- Além da quota mensal, o condomínio por vezes pede um reforço pontual a cada
-- fração — por exemplo, 200€ por fração para obras, como aconteceu em 2025.
-- Ao contrário da quota, não é mensal nem recorrente: é um valor único, com um
-- prazo de pagamento próprio, e pode haver vários no mesmo ano (um para obras,
-- outro para o elevador, etc.).
--
-- Cada reforço aponta para uma categoria de receita — normalmente "Reforço
-- Fundos Obras", que já existe — para que o valor entre no mapa de origem e
-- aplicação de fundos como sempre entrou. O que distingue um reforço de outro,
-- quando os dois usam a mesma categoria, é a coluna movimentos.reforco_id.
--
-- Como o exemplo de 2025 já tinha pagamentos lançados antes de este conceito
-- existir, a criação de um reforço associa automaticamente (código, não aqui)
-- os movimentos antigos da mesma categoria e ano que ainda não pertencem a
-- nenhum reforço.
--
-- As instruções são idempotentes: aplicar esta migração duas vezes não dá erro.
-- ============================================================================

create table if not exists reforcos (
  id            uuid primary key default gen_random_uuid(),
  ano           smallint not null check (ano between 1900 and 2200),
  descricao     text not null,
  valor_fracao  numeric(10, 2) not null check (valor_fracao > 0),
  data_limite   date not null,
  categoria_id  uuid not null references categorias (id) on delete restrict,
  criado_em     timestamptz not null default now(),
  criado_por    uuid references auth.users (id) on delete set null
);

comment on table reforcos is
  'Reforço extraordinário pedido a cada fração, com valor e prazo próprios. '
  'Vários podem existir no mesmo ano.';

alter table reforcos enable row level security;

drop policy if exists "reforcos visiveis" on reforcos;
create policy "reforcos visiveis" on reforcos
  for select to authenticated using (true);

drop policy if exists "administrador gere reforcos" on reforcos;
create policy "administrador gere reforcos" on reforcos
  for all to authenticated using (e_admin()) with check (e_admin());

-- ---------------------------------------------------------------------------
-- Liga um movimento a um reforço concreto, tal como quota_mes liga um
-- movimento a um mês de quota. Sem isto, dois reforços com a mesma categoria
-- no mesmo ano não se conseguiriam distinguir.
-- ---------------------------------------------------------------------------
alter table movimentos add column if not exists reforco_id uuid references reforcos (id) on delete set null;

alter table movimentos drop constraint if exists reforco_exige_fracao;
alter table movimentos add constraint reforco_exige_fracao
  check (reforco_id is null or fracao_id is not null);
