# Gestão de Condomínio

Aplicação web para a administração do condomínio: movimentos, quotas, mapa de
origem e aplicação de fundos, recibos e importação do extrato bancário.

Substitui as folhas de Excel e os documentos Word que eram preenchidos à mão.

O histórico de alterações, versão a versão, está em [`CHANGELOG.md`](CHANGELOG.md).
A versão em uso aparece no canto inferior esquerdo da aplicação.

## O que faz

- **Painel** com o valor em caixa, o valor no banco, o total disponível, o
  movimento do mês e as frações com quotas em atraso.
- **Movimentos** com saldo acumulado calculado, não guardado. Inserir uma linha
  a meio já não parte os arrastamentos.
- **Quotas** numa matriz de frações por meses, com o prazo de pagamento
  configurável (dia 8 por omissão).
- **Extratos bancários** importados de CSV, XLSX ou PDF, com sugestão
  automática de categoria e fração e um ecrã de revisão antes de gravar.
- **Relatórios**: mapa de origem e aplicação de fundos em Excel, na disposição
  do ficheiro `MOAF` que já usavas.
- **Recibos** em Word, nos três modelos existentes: quota, presença em
  assembleia e documento de caixa.
- **Definições** em seis áreas: Condomínio (dados, prazos, saldos de abertura e
  abertura de exercício), Frações (condóminos e quem é da administração), Quotas
  do ano (quota de cada fração por exercício), Contas (criar e atribuir os
  acessos de login), Fornecedores e importação de Extratos bancários.
- **Vários exercícios**: seletor de ano em todas as páginas, com histórico
  consultável. Ver [`CHANGELOG.md`](CHANGELOG.md).

## Uma correção face às folhas antigas

O mapa da folha `2026` apresentava 119,99999999999909 € na célula de controlo,
que devia estar a zero.

A causa é a tabela dinâmica que alimenta a linha das quotizações estar
desactualizada. A soma directa das linhas de `DATA EXPORT` dá 1565 € de
quotizações, mas a tabela dinâmica mostra 1445 € e arruma os restantes 120 €
numa linha `(blank)`. Os saldos que a própria folha calcula confirmam o 1565:

```
3818,37 de abertura  +  1565 de receita  −  1738,69 de despesa  =  3644,68
caixa 392,74  +  banco 3251,94                                  =  3644,68
```

Na aplicação não há cache nenhuma. Os totais e as disponibilidades finais são
sempre derivados dos movimentos, o que faz a célula de controlo dar zero por
construção. Se alguma vez não der, aparece a vermelho no ficheiro gerado.

## Arranque

Precisas de **Node.js 22 ou superior**. Não é uma recomendação: a partir da
versão 2.115 o cliente do Supabase exige WebSocket nativo, que só existe do
Node 22 em diante. No Node 20 a aplicação nem arranca.

> **Nota sobre o nvm no Windows**
>
> O `nvm use` falha nesta máquina porque o caminho da instalação tem um espaço
> (`C:\Users\Joao Barata\...`). O comando apaga o link `C:\nvm4w\nodejs` e não
> o consegue recriar, o que deixa o `node` fora do PATH.
>
> Se isso acontecer, recria o link à mão no PowerShell, trocando a versão:
>
> ```powershell
> $alvo = "$env:LOCALAPPDATA\nvm\v22.23.2"
> $link = "C:\nvm4w\nodejs"
> if (Test-Path $link) { Remove-Item $link -Force -Recurse }
> New-Item -ItemType Junction -Path $link -Target $alvo
> ```
>
> A junção não precisa de privilégios de administrador, ao contrário do link
> simbólico que o nvm tenta criar.

```bash
npm install
cp .env.example .env.local     # e preenche os valores
npm run dev
```

### Base de dados

1. Cria um projecto em [supabase.com](https://supabase.com).

2. Em **Project Settings > API Keys**, copia o *Project URL* e as chaves *anon*
   e *service_role* para o `.env.local`.

3. Aplica o esquema. Pelo editor de SQL, que não exige instalar nada:

   Abre **SQL Editor**, cria uma query nova, cola o conteúdo de
   `supabase/migracao-completa.sql` e carrega em **Run**. Corre uma só vez.

   Ou pela CLI, se preferires:

   ```bash
   npx supabase link --project-ref <o-teu-ref>
   npx supabase db push
   ```

   As migrações estão em `supabase/migrations/` e criam o esquema, as políticas
   de segurança e os dados iniciais de estrutura. O ficheiro
   `migracao-completa.sql` é gerado a partir delas com
   `node scripts/gerar-sql-completo.mjs`, por isso não o edites à mão.

4. Em **Authentication > Sign In / Providers**, desliga o registo público. As
   contas são criadas pela administração.

5. Cria a **tua** conta em **Authentication > Users > Add user**. O primeiro
   utilizador do sistema fica automaticamente como administrador. As contas
   seguintes já podem ser criadas dentro da aplicação, em
   **Definições > Contas**, que também é onde se atribui a fração de cada
   condómino (usa a `SUPABASE_SERVICE_ROLE_KEY` do `.env.local`).

6. Confirma que está tudo bem:

   ```bash
   npx tsx scripts/verificar-ligacao.ts
   ```

   Verifica as variáveis de ambiente, as treze tabelas, os dados iniciais, as
   contas de utilizador e, o mais importante, que um cliente sem sessão não
   consegue ler nada. Não imprime nenhuma chave.

### Carregar os dados reais

Os nomes dos condóminos, o contribuinte e o NIB são dados pessoais e não estão
no repositório. Ficam em `dados-locais/condominio.json`, que o `.gitignore`
exclui.

```bash
cp scripts/dados-exemplo.json dados-locais/condominio.json
# preencher, depois:
npx tsx scripts/carregar-dados-reais.ts            # simulação
npx tsx scripts/carregar-dados-reais.ts --gravar   # grava
```

A simulação corre sem credenciais e mostra o que seria importado. Se
`ASSETS/CONTROLO GESTAO CONDOMINIO 2026.xlsx` existir, o histórico de
movimentos do ano é importado junto.

## Verificação

```bash
npm test                                  # testes das regras de negócio
npx tsx scripts/verificar-ligacao.ts      # configuração do Supabase e segurança
npx tsx scripts/verificar-mapa.ts         # compara o mapa com a folha real
npx tsx scripts/verificar-recibos.ts      # compara os recibos com os .docx
npm run build
```

Os dois scripts de verificação leem os ficheiros de `ASSETS/`, por isso só
correm na tua máquina.

O `verificar-mapa` confere as sete categorias de despesa, o subtotal de
1738,69 €, as quotizações e os saldos finais contra a folha. O
`verificar-recibos` gera os três modelos e compara o texto palavra a palavra
com os documentos originais.

### Capturas de ecrã

```bash
npm run dev                                    # noutro terminal
node screenshot.mjs http://localhost:3000 painel
node screenshot.mjs http://localhost:3000 painel --movel
```

Os ficheiros ficam em `temporary screenshots/`, numerados e sem sobrescrever.

## Publicar no Vercel

1. Cria o repositório no GitHub e envia o código.
2. Importa o repositório no Vercel.
3. Em **Settings > Environment Variables**, define as três variáveis do
   `.env.example`. A `SUPABASE_SERVICE_ROLE_KEY` é secreta e só é usada no
   servidor.
4. Em **Authentication > URL Configuration** no Supabase, acrescenta o domínio
   do Vercel às *Redirect URLs*.

## Segurança

O repositório é público, por isso:

- A `SUPABASE_SERVICE_ROLE_KEY` nunca entra no código. Só em variáveis de
  ambiente.
- A chave anónima pode ser pública, mas só porque **todas** as tabelas têm Row
  Level Security activa. É o Postgres que garante que um condómino não lê as
  contas dos vizinhos, não o código das páginas.
- `ASSETS/`, `dados-locais/` e qualquer `.xlsx`, `.xls` ou `.docx` estão no
  `.gitignore`, porque contêm nomes, contribuinte e NIB reais.

Um condómino autenticado vê apenas a sua fração, os movimentos dela e os seus
recibos, e o menu limita-se a Painel, Movimentos, Quotas e Relatórios. As
Definições (incluindo a importação de extratos) e os dados dos fornecedores com
IBAN são exclusivos da administração. O mapa de origem e aplicação de fundos em
Relatórios é visível a qualquer condómino em modo de consulta, através de uma
função agregada que não expõe movimentos individuais.

Ser administrador vem de `profiles.papel = 'admin'` (o primeiro utilizador) ou
de a fração do condómino estar marcada como "da administração" em
**Definições > Frações**. A função `e_admin()` do RLS junta as duas condições.

## Estrutura

```
src/lib/            regras de negócio, sem dependência do Supabase
  contas.ts         saldos, mapa de origem e aplicação, saldo acumulado
  quotas.ts         matriz de quotas e cálculo de atrasos
  extenso.ts        valores por extenso em português europeu
  formatos.ts       moeda, datas, arredondamento em cêntimos
  extratos/         leitura e conciliação do extrato bancário
  relatorios/       geração do Excel e dos Word
src/app/            páginas e rotas
supabase/migrations esquema, segurança e dados iniciais
scripts/            verificação e carregamento de dados
```

O núcleo de cálculo em `src/lib/` não sabe que existe uma base de dados. Recebe
movimentos e devolve totais, o que permite testá-lo contra os números reais de
2026 sem ligação nenhuma.
