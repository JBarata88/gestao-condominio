# Histórico de alterações

Todas as alterações relevantes da aplicação, da mais recente para a mais antiga.
A versão em uso aparece no canto inferior esquerdo, por baixo do nome da conta.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e a
numeração segue o [SemVer](https://semver.org/lang/pt-BR/).

---

## [1.0.0] — 2026-09-24

Primeira versão em produção.

### Removido
- Texto de apoio por baixo do título em **Movimentos**, **Relatórios** e
  **Recibos** — as três páginas já se explicam sozinhas.

---

## [0.11.1] — 2026-09-24

### Adicionado
- **"Versão X · o que mudou"**, no fundo da barra lateral, passa a ligar a
  uma página nova com o histórico de alterações (o próprio CHANGELOG),
  organizado por versão.

### Alterado
- **A secção da conta (nome, papel, Terminar sessão) já não fica pregada ao
  fundo da barra lateral** — passa a aparecer logo a seguir à última opção
  do menu, para nunca ser preciso rolar a página só para terminar a sessão.

---

## [0.11.0] — 2026-09-24

### Adicionado
- **Orçamento aprovado em assembleia**, por ano de exercício.
  - Define-se em **Definições → Orçamento**: um valor previsto por
    categoria, mais as disponibilidades previstas no fim do ano — a mesma
    disposição do ORÇAMENTO202X.xls que já era usado.
  - **Relatórios → Orçamento vs Realizado** compara o previsto com o real,
    linha a linha, com desvio em valor e em percentagem — reproduz o
    MOAFORÇAMENTO202X.xls. Tem as mesmas duas opções do mapa de fundos:
    **Imprimir** e **Descarregar em Excel**.

---

## [0.10.0] — 2026-09-24

### Alterado
- **O acesso de administrador deixa de depender da fração.** Antes, marcar
  uma fração como "da administração" dava acesso de escrita à aplicação
  inteira a quem lá estivesse ligado — confundia o cargo de administrador do
  condomínio (que roda, ano a ano, entre condóminos) com o acesso de
  administrador da aplicação. Agora são coisas separadas:
  - O acesso à aplicação define-se só em **Definições → Contas**.
  - Quem administra o condomínio passa a ser uma escolha **por ano de
    exercício**, feita em **Definições → Frações**, sem dar nenhum acesso
    extra — aparece só como informação em **Painel**, **Quotas** e
    **Relatórios**. As frações já marcadas ficam associadas ao exercício
    activo.
- **Definições → Frações** passa a ser uma tabela com todas as frações, com
  um botão **Editar** por linha que abre os campos — em vez de um formulário
  sempre aberto por fração.
  - Sai o campo **Quota mensal**: já se define em Definições → Quotas do
    ano.
- **Definições passa a estar acessível a qualquer condómino**, não só à
  administração — mas só vê a aba **Conta**, para consultar os seus dados e
  **alterar a própria palavra-passe**. As restantes áreas continuam
  reservadas à administração.

---

## [0.9.6] — 2026-09-24

### Adicionado
- **Reforços extraordinários** — um valor único por fração, com prazo
  próprio, para pedidos pontuais como os 200€ por fração para obras de 2025.
  Ao contrário da quota mensal, pode haver vários no mesmo ano.
  - Criam-se em **Definições → Quotas do ano**: descrição, valor por fração,
    categoria de receita e data limite de pagamento.
  - A página de **Quotas** ganha uma tabela por reforço, com o estado de
    cada fração (pago, parcial, em falta, por pagar) tal como a tabela de
    quotas mensais.
  - O lançamento e a edição de um movimento de receita passam a ter um
    campo **Reforço**, quando a categoria escolhida tiver algum, para o
    pagamento contar na tabela certa.
  - Criar um reforço associa automaticamente os pagamentos já lançados
    nessa categoria e nesse ano que ainda não pertenciam a nenhum reforço —
    é o que liga os pagamentos de obras de 2025, lançados antes de este
    conceito existir.

---

## [0.9.5] — 2026-09-24

### Removido
- **Edição manual dos saldos de abertura em Definições.** 2025 é o ano-base;
  todos os anos seguintes passam sempre a partir dos saldos de caixa e banco
  do fecho do ano anterior, através de "Abrir exercício" — deixa de haver
  forma de os substituir à mão.
- Botão **"Eliminar exercícios sem movimentos"** na tabela de Exercícios —
  cada exercício sem movimentos já se elimina individualmente pelo botão
  "Eliminar" da sua própria linha.

---

## [0.9.4] — 2026-09-23

### Corrigido
- **O seletor de ano do topo já não oferece o ano civil seguinte por
  antecipação.** Antes, 2027 aparecia sempre na lista mesmo sem exercício
  nenhum criado, dando a entender que já existia. Agora só aparece depois de
  ter dados — criado pelo botão "Criar exercício" em Definições, tal como na
  tabela de Exercícios.

---

## [0.9.3] — 2026-09-23

### Alterado
- **"Criar exercício" passa a pedir o ano**, em vez de assumir sempre o
  seguinte ao mais recente — dá para criar (ou preencher em falta) qualquer
  ano, passado ou futuro. O ano seguinte continua sugerido por omissão.

---

## [0.9.2] — 2026-09-23

### Removido
- Campo **"Ano do exercício por omissão"** em Prazos e exercício — trocar o
  exercício activo faz-se agora só pela tabela de Exercícios, com "Tornar
  activo".

### Adicionado
- Botão **"Criar exercício de {ano}"** junto à tabela de Exercícios: cria
  sempre o ano a seguir ao mais recente já existente (transporta o fecho do
  ano anterior e as quotas em vigor), sem precisares de já estar a ver esse
  ano no seletor do topo.
- Botão **"Eliminar exercícios sem movimentos"**, com confirmação, que apaga
  de uma vez todos os exercícios futuros e passados sem movimentos lançados
  — nunca o activo, nunca um com movimentos. Só aparece quando há pelo menos
  um para eliminar.

---

## [0.9.1] — 2026-09-23

### Adicionado
- **Definições → Condomínio → Exercícios** ganha um estado por linha —
  **activo**, **futuro** ou **inactivo** — em vez de só "activo"/"sem
  abertura". O ano a seguir ao activo (ex.: 2027) aparece sempre na tabela
  como "futuro", mesmo sem dados, para se poder preparar com antecedência.
  - Botão **"Abrir"** por linha, para qualquer exercício sem saldos de
    abertura (não só o que está a ser consultado no seletor do topo) —
    transporta o fecho do ano anterior e as quotas em vigor.
  - Botão **"Tornar activo"**, para escolher qual o exercício por omissão
    directamente na tabela, sem teres de editar o campo "Ano do exercício
    por omissão" à parte.
  - Ligação **"Editar"** por linha, que leva ao formulário de saldos de
    abertura já com esse ano seleccionado.

### Alterado
- **Abrir um exercício deixa de o tornar activo sozinho.** Antes, abrir o
  exercício seguinte trocava logo o que toda a gente via por omissão; agora
  fica "futuro" até se escolher "Tornar activo" — dá para preparar o ano
  novo com antecedência sem afectar ninguém.

---

## [0.9.0] — 2026-09-23

### Alterado
- **Painel:** a secção do mês corrente passa a mostrar o exercício inteiro.
  "Receitas do mês" e "Despesas do mês" tornam-se **Receitas totais do ano**
  e **Despesas totais do ano**; "Resultado do mês" dá lugar ao **Top 3
  despesas do ano**, com a categoria e o valor de cada uma. Usa a mesma
  agregação por categoria do mapa de Relatórios, para os números baterem
  certo entre as duas páginas.

---

## [0.8.9] — 2026-09-23

### Alterado
- A impressão de Relatórios passa a **A4 horizontal** (como Quotas), para
  caber tudo numa só folha: os quatro painéis (Origem, Aplicação, Receitas e
  Despesas por categoria) passam para uma única linha em vez de duas, e o
  cabeçalho, o texto de apoio e os espaçamentos ficam mais compactos só no
  papel.

---

## [0.8.8] — 2026-09-23

### Adicionado
- **Relatórios ganha um botão "Imprimir"**, que gera a impressão do mapa
  numa folha A4 vertical, com o mesmo aspecto do ecrã. O formulário de
  período fica de fora da folha impressa, mas a data de início e fim
  escolhidas aparecem como texto no topo. O botão "Imprimir" foi extraído
  para um componente partilhado (`components/botao-imprimir.tsx`), usado
  também em Quotas.

---

## [0.8.7] — 2026-09-23

### Alterado
- **Quotas:** removido o KPI "Total Parcial" — ficam três: Total Pago, Total
  Em Falta e Total Por Pagar (este já inclui o valor parcial em falta).

---

## [0.8.6] — 2026-09-23

### Alterado
- **Quotas:** o KPI "Total Por Pagar" passa a somar tudo o que ainda falta
  pagar nos 12 meses do ano (parcial, pendente, futuro e também o que está
  em atraso), em vez de só o mês corrente. "Total Em Falta" mantém-se
  apenas com o que já passou do prazo.

---

## [0.8.5] — 2026-09-23

### Alterado
- **Quotas:** os quatro KPIs (Total Pago, Total Parcial, Total Em Falta,
  Total Por Pagar) passam a aparecer sempre no ecrã, não só na impressão,
  substituindo a etiqueta única "Por cobrar".

---

## [0.8.4] — 2026-09-23

### Adicionado
- A impressão do mapa de Quotas ganha quatro KPIs no topo — **Total Pago**,
  **Total Parcial**, **Total Em Falta** e **Total Por Pagar** —, um por cada
  estado com dinheiro em jogo. Só saem no papel; no ecrã a cor de cada
  célula já conta a mesma história.

---

## [0.8.3] — 2026-09-23

### Alterado
- A impressão do mapa de Quotas passa a sair em **A4 horizontal** (em vez de
  vertical), para a tabela — larga, com um mês em cada coluna — ter mais
  espaço e ficar mais legível no papel.

---

## [0.8.2] — 2026-09-23

### Alterado
- **Quotas:** o texto de explicação sob o título dá lugar a um ícone (i),
  com o mesmo texto num popup — o cabeçalho fica mais limpo sem perder a
  informação.
- **Quotas ganha um botão "Imprimir"**, que gera a impressão do mapa de
  quotas numa folha A4 vertical, com o mesmo aspecto do ecrã (cores de
  estado incluídas). A navegação lateral e o seletor de ano ficam de fora
  da impressão.

---

## [0.8.1] — 2026-09-23

### Corrigido
- **Recibos, recibos de presença e documentos de caixa (limpeza) saem sempre
  em folha A4, divididos ao meio.** Cada par de recibos passa a ocupar uma
  tabela de duas linhas com altura fixa (metade da página), separadas por uma
  linha divisória, para que os dois recibos de cada folha tenham sempre
  exatamente o mesmo tamanho, seja qual for o texto de cada um.
  - Resolve a página em branco que aparecia entre cada par de recibos: a
    tabela ocupava 100% da página, sem espaço para a quebra de página
    seguinte, que acabava por saltar sozinha para uma página nova.
- **O MOAF passa a reproduzir com exatidão a formatação de
  `ASSETS/MOAF202601.xlsx`**: tipo e tamanho de letra (MS Sans Serif, 10pt),
  itálico no cabeçalho, negrito nas linhas de sub-total/total/controlo,
  larguras de coluna, a linha vertical à esquerda de cada secção, e a
  configuração de impressão (margens, escala, centrado, sem grelha, área de
  impressão).

---

## [0.8.0] — 2026-09-07

### Alterado
- **O condómino passa a consultar as contas todas.** Deixa de ver apenas a sua
  fração: os **Movimentos** mostram o livro completo de banco e caixa com o
  saldo real, o mapa de **Quotas** mostra todas as frações e o **Painel** passa
  a incluir o bloco de quotas em atraso. Continua sem poder lançar nem corrigir
  nada, e as **Definições** continuam reservadas à administração.
  - Resolve o caso das contas de condómino recém-criadas, ainda sem fração
    atribuída, que não viam movimento nenhum.
  - A página de Movimentos ganha o filtro por fração também para o condómino.

### Base de dados
- Migração `0009_condomino_ve_tudo.sql`: as políticas de leitura de
  `movimentos`, `fracoes` e `quotas_fracao` passam a valer para qualquer conta
  autenticada. A escrita continua reservada à administração; fornecedores,
  saldos, extratos bancários e regras de conciliação ficam como estavam.

---

## [0.7.1] — 2026-09-06

### Alterado
- A tabela de exercícios em Definições passa a mostrar **todos** os anos que
  existem (com saldos de abertura, com movimentos ou com quotas por ano) mais o
  exercício activo, mesmo que ainda esteja vazio — antes só aparecia quem já
  tinha saldos de abertura. O ano em "Ano do exercício por omissão" está
  assinalado como **activo**; os anos sem saldos aparecem como "sem abertura".

---

## [0.7.0] — 2026-09-06

### Adicionado
- **Definições → Condomínio → Prazos e exercício:** tabela dos exercícios, com o
  total de abertura e o número de movimentos de cada ano.
  - Botão para **eliminar um exercício**, com confirmação em dois passos.
    Eliminar apaga os saldos de abertura e as quotas desse ano; os movimentos
    nunca são apagados por aqui.
  - Um exercício não pode ser eliminado se tiver movimentos lançados (é preciso
    apagá-los primeiro) ou se for o exercício activo (muda-se primeiro o "Ano do
    exercício por omissão"). Nesses casos aparece o motivo em vez do botão.

---

## [0.6.0] — 2026-09-06

### Adicionado
- **Vários exercícios na mesma instalação.** A aplicação deixa de estar presa a
  um único ano.
  - Seletor de ano no topo de todas as páginas do painel, visível ao
    administrador e ao condómino. A escolha fica guardada (cookie) e sobrevive à
    navegação entre páginas; também pode ir na ligação (`?ano=2026`), para
    ligações partilháveis e para o descarregamento do mapa em Excel.
  - A definição **"Ano do exercício"** passa a ser apenas o valor por omissão de
    quem entra sem escolher outro ano.
- **Quota mensal por fração e por ano** (nova tabela `quotas_fracao`). Cada
  exercício usa a quota em vigor nesse ano; mudar as quotas de um ano novo já
  não reescreve o valor devido nem os atrasos dos anos anteriores. Sem valor
  definido para um ano, usa-se a quota base da fração.
  - Nova área **Definições → Quotas do ano** para editar as quotas de cada
    exercício. Um campo em branco faz a fração voltar à quota base.
- **Abertura de exercício assistida.** Quando um ano ainda não tem saldos de
  abertura, aparece em **Definições → Condomínio** um botão que transporta o
  fecho do ano anterior (caixa, banco, depósitos a prazo e conta poupança),
  copia as quotas em vigor e passa a considerar esse ano o exercício em curso.

### Alterado
- Painel: num ano que não seja o civil em curso, o bloco mensal mostra Dezembro
  (o fecho do exercício) em vez do mês corrente.
- Removido o painel **"Registar pagamento"** da página de Quotas. Os pagamentos
  continuam a lançar-se em **Movimentos**.

### Base de dados
- Migração `0008_multiplos_anos.sql`: tabela `quotas_fracao` com Row Level
  Security (o condómino vê só a quota da sua fração; a escrita é da
  administração).

---

## [0.5.0] — 2026-09-06

### Adicionado
- **Relatórios:** as receitas por categoria passam a aparecer ao lado das
  despesas por categoria, para uma leitura lado a lado do exercício.

---

## [0.4.0] — 2026-09-06

### Adicionado
- **Definições → Contas:** o administrador pode redefinir a palavra-passe de
  outra conta, sem depender do painel do Supabase.

---

## [0.3.0] — 2026-09-06

### Adicionado
- **Fornecedores:** botão para eliminar um fornecedor, com confirmação.

---

## [0.2.0] — 2026-09-06

### Adicionado
- **Definições reorganizadas em sub-áreas**, com navegação secundária:
  Condomínio, Frações, Contas, Fornecedores e Extratos bancários.
- **Gestão de contas dentro da aplicação** (Definições → Contas): criar contas
  de acesso e atribuir a fração de cada condómino.
- **Frações da administração:** marcar uma fração como "da administração" dá ao
  condómino ligado a ela acesso de administrador, sem mexer directamente no
  papel do perfil. A função `e_admin()` passa a juntar as duas condições.
- **Mapa de origem e aplicação de fundos visível ao condómino** em modo de
  consulta, através de uma função agregada que devolve apenas totais por linha,
  sem expor movimentos, descrições nem a fração de cada linha.
- **Publicação no Vercel** (`vercel.json`, região `cdg1`) e **integração
  contínua** no GitHub Actions: os testes e o `build` correm a cada `push` e em
  cada _pull request_ para `main`.

### Base de dados
- Migração `0007_administracao_relatorios.sql`: coluna `fracoes.administracao`,
  política de leitura dos saldos de abertura e função `resumo_exercicio`.

---

## [0.1.0] — 2026-09-06

Primeira versão. Substitui as folhas de Excel e os documentos Word preenchidos à
mão.

### Painel
- Valor em caixa, valor no banco e total disponível.
- Receitas, despesas e resultado do mês.
- Frações com quotas em atraso e valor total por cobrar.

### Movimentos
- Banco e caixa em blocos separados, como nas folhas mensais.
- Saldo acumulado **calculado** a partir dos movimentos, não guardado: inserir
  uma linha a meio deixa de partir os arrastamentos.
- Filtros por mês, categoria e fração, guardados no endereço.
- Lançamento manual de movimentos de caixa; edição e eliminação de movimentos
  lançados à mão (os importados de extrato editam-se mas não se apagam avulso).

### Quotas
- Matriz de frações por meses, cada fração tratada como conta corrente: o total
  pago no ano determina quantos meses ficam cobertos, sem ser preciso indicar a
  que mês cada transferência respeita.
- Prazo de pagamento configurável (dia 8 por omissão); um mês só conta como
  atraso depois dessa data.
- Estados por célula: pago, parcial, em atraso, por pagar, futuro e isento.
- Um pagamento em lote pode cobrir um intervalo de meses (`QUOTA JAN-JUL`).

### Extratos bancários
- Importação de CSV, XLSX ou PDF.
- Sugestão automática de categoria e fração, e do mês da quota, a partir de
  regras de conciliação comparadas sem acentos nem maiúsculas.
- Ecrã de revisão antes de gravar.
- Impressão digital por linha, para não importar o mesmo movimento duas vezes a
  partir de extratos sobrepostos.

### Relatórios
- Mapa de origem e aplicação de fundos em Excel, na disposição do ficheiro
  `MOAF` original.
- Célula de controlo a zero por construção: as disponibilidades finais são
  derivadas dos movimentos. Se alguma vez não fechar, aparece a vermelho.
- Pré-visualização dos totais antes de descarregar; intervalo de datas
  ajustável.

### Recibos
- Três modelos em Word: quota, presença em assembleia e documento de caixa.
- Valores por extenso em português europeu.
- Dois recibos por página, com separador, como nos ficheiros originais.
- O recibo de quota usa o valor e a data do pagamento tal como está lançado, e
  fica registado para se saber quais os pagamentos que já têm recibo emitido.

### Definições
- Identificação do condomínio (para relatórios e recibos), prazos do exercício e
  saldos de abertura por ano.
- Frações e condóminos, com o tratamento ("do condómino" / "da condómina") que
  os recibos usam.
- Fornecedores.

### Contas e segurança
- Autenticação pelo Supabase. O primeiro utilizador fica automaticamente como
  administrador.
- Row Level Security em todas as tabelas: é o Postgres que garante que um
  condómino não lê as contas dos vizinhos, não o código das páginas.
- Um condómino autenticado vê apenas a sua fração, os movimentos dela e os seus
  recibos; o menu limita-se a Painel, Movimentos, Quotas e Relatórios.

### Núcleo de cálculo
- As regras de negócio (`src/lib/`) não dependem da base de dados: recebem
  movimentos e devolvem totais, o que permite testá-las contra os números reais
  de 2026 sem ligação nenhuma.

[0.8.0]: https://github.com/JBarata88/gestao-condominio/releases/tag/v0.8.0
[0.7.1]: https://github.com/JBarata88/gestao-condominio/releases/tag/v0.7.1
[0.7.0]: https://github.com/JBarata88/gestao-condominio/releases/tag/v0.7.0
[0.6.0]: https://github.com/JBarata88/gestao-condominio/releases/tag/v0.6.0
[0.5.0]: https://github.com/JBarata88/gestao-condominio/releases/tag/v0.5.0
[0.4.0]: https://github.com/JBarata88/gestao-condominio/releases/tag/v0.4.0
[0.3.0]: https://github.com/JBarata88/gestao-condominio/releases/tag/v0.3.0
[0.2.0]: https://github.com/JBarata88/gestao-condominio/releases/tag/v0.2.0
[0.1.0]: https://github.com/JBarata88/gestao-condominio/releases/tag/v0.1.0
