# Histórico de alterações

Todas as alterações relevantes da aplicação, da mais recente para a mais antiga.
A versão em uso aparece no canto inferior esquerdo, por baixo do nome da conta.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e a
numeração segue o [SemVer](https://semver.org/lang/pt-BR/).

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
