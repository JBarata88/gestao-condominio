-- ============================================================================
-- Dados iniciais
--
-- Só estrutura. Nomes, contactos, quotas e saldos são dados pessoais e
-- financeiros reais, e este repositório é público, por isso entram através do
-- script local scripts/carregar-dados-reais.ts ou pela página de Definições.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Categorias, da folha "DATA" do ficheiro original.
--
-- A folha chamava-lhe "Quotizações 2026", com o ano no nome, o que obrigava a
-- criar uma categoria nova todos os anos e partia a comparação entre
-- exercícios. Aqui a categoria é "Quotizações" e o ano vem da data do
-- movimento; o mapa continua a imprimir "Quotizações 2026" no relatório.
-- ---------------------------------------------------------------------------
insert into categorias (nome, natureza, linha_moaf, ordem, sistema) values
  ('Quotizações',                      'receita',       'Quotizações',                        10, true),
  ('Juros depósitos a prazo',          'receita',       'Juros depósitos a prazo',            20, true),
  ('Juros conta poupança',             'receita',       'Juros conta poupança - condominio',  30, true),
  ('Reforço Fundos Obras',             'receita',       'Reforço Fundos Obras',               40, true),

  ('Agua',                             'despesa',       'Agua',                              110, false),
  ('Correios',                         'despesa',       'Correios',                          120, false),
  ('Seguros',                          'despesa',       'Seguros',                           130, false),
  ('Despesas bancárias',               'despesa',       'Despesas bancárias',                140, false),
  ('Electricidade',                    'despesa',       'Electricidade',                     150, false),
  ('Ferramentas e utensílios',         'despesa',       'Ferramentas e utensilios',          160, false),
  ('Materiais de limpeza',             'despesa',       'Materiais de limpeza',              170, false),
  ('Obras e reparações',               'despesa',       'Obras e reparações',                180, false),
  ('Papelaria',                        'despesa',       'Papelaria',                         190, false),
  ('Pagamentos a pessoal',             'despesa',       'Pagamentos a pessoal',              200, false),
  ('Presença Reunião',                 'despesa',       'Presença Reunião',                  210, false),

  ('Depósito Bancário',                'transferencia', null,                                300, true);

-- ---------------------------------------------------------------------------
-- Frações: a estrutura do prédio, oito frações de A a H.
-- Os nomes dos condóminos e as quotas ficam por preencher.
-- ---------------------------------------------------------------------------
insert into fracoes (letra, andar, ordem, quota_mensal) values
  ('A', '1º DTO', 1, 0),
  ('B', '1º ESQ', 2, 0),
  ('C', '2º DTO', 3, 0),
  ('D', '2º ESQ', 4, 0),
  ('E', '3º DTO', 5, 0),
  ('F', '3º ESQ', 6, 0),
  ('G', '4º DTO', 7, 0),
  ('H', '4º ESQ', 8, 0);

-- ---------------------------------------------------------------------------
-- Definições da aplicação
-- ---------------------------------------------------------------------------
insert into definicoes (chave, valor, descricao) values
  ('dia_limite_quota', '8'::jsonb,
   'Dia do mês até ao qual as quotas devem ser pagas.'),
  ('ano_exercicio', '2026'::jsonb,
   'Ano do exercício em curso, usado por omissão nos relatórios.'),
  ('localidade_recibos', '"Póvoa de Santa Iria"'::jsonb,
   'Localidade impressa acima da data nos recibos.'),
  ('valor_presenca_assembleia', '5'::jsonb,
   'Valor pago por presença em assembleia, por omissão.'),
  ('assinatura_recibos', '"A administração"'::jsonb,
   'Texto da linha de assinatura nos recibos de quota.');

-- ---------------------------------------------------------------------------
-- Regras de conciliação do extrato bancário, a partir das descrições que já
-- aparecem no histórico de 2026. Comparadas sem acentos nem maiúsculas.
-- ---------------------------------------------------------------------------
insert into regras_conciliacao (padrao, categoria_id, prioridade)
select padrao, categorias.id, prioridade
from (values
  ('comissao',            'Despesas bancárias',  10),
  ('manutencao conta',    'Despesas bancárias',  10),
  ('manutencao de conta', 'Despesas bancárias',  10),
  ('despesas bancarias',  'Despesas bancárias',  10),
  ('seguro',              'Seguros',             20),
  ('luz',                 'Electricidade',       20),
  ('edp',                 'Electricidade',       20),
  ('electricidade',       'Electricidade',       20),
  ('eletricidade',        'Electricidade',       20),
  ('agua',                'Agua',                20),
  ('smas',                'Agua',                20),
  ('limpeza',             'Pagamentos a pessoal', 30),
  ('quota',               'Quotizações',         40)
) as r(padrao, nome_categoria, prioridade)
join categorias on categorias.nome = r.nome_categoria;

-- ---------------------------------------------------------------------------
-- Saldos de abertura a zero. Os valores reais entram pela página de Definições.
-- ---------------------------------------------------------------------------
insert into saldos_iniciais (ano) values (2026);
