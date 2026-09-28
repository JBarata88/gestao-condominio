/**
 * Gera os dois guias em PDF a partir das capturas anotadas.
 *
 *   npx tsx scripts/guias/capturar.ts    # primeiro (precisa do servidor em localhost:3000)
 *   npx tsx scripts/guias/gerar-pdf.ts
 *
 * Os PDFs ficam em "Guias/", que o .gitignore exclui: as capturas mostram
 * valores reais das contas do condomínio, e o repositório é público.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";

const PASTA_CAPTURAS = join("temporary screenshots", "guias");
const PASTA_SAIDA = "Guias";
const VERSAO = JSON.parse(readFileSync("package.json", "utf8")).version as string;

/** Largura útil da página A4 com as margens definidas abaixo, em px CSS. */
const LARGURA_UTIL = 680;

/** Espaço à volta de cada imagem para os números das marcas, em px CSS. */
const FOLGA_NUMEROS = 26;

type Marca = { n: number; lado: "esquerda" | "direita" | "cima" | "baixo"; x: number; y: number; w: number; h: number };
type Dados = { largura: number; altura: number; marcas: Marca[] };

// ---------------------------------------------------------------------------
// Blocos de conteúdo
// ---------------------------------------------------------------------------

/** Número de marca, para usar no texto: "carrega em ${n(3)} Entrar". */
const n = (k: number) => `<span class="n">${k}</span>`;

/** Uma captura com as marcas desenhadas por cima. */
function fig(id: string, legenda: string, { escala = 1 }: { escala?: number } = {}): string {
  const png = join(PASTA_CAPTURAS, `${id}.png`);
  const json = join(PASTA_CAPTURAS, `${id}.json`);
  if (!existsSync(png) || !existsSync(json)) {
    return `<p class="falta">[captura em falta: ${id}]</p>`;
  }
  const dados = JSON.parse(readFileSync(json, "utf8")) as Dados;
  const base64 = readFileSync(png).toString("base64");

  // A folga à volta da imagem é onde ficam os números encostados às bordas;
  // sem ela caíam na margem da página e o PDF cortava-os.
  const largura = Math.min(LARGURA_UTIL - 2 * FOLGA_NUMEROS, dados.largura * escala);
  const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(3)}%`;
  const folga = 4;

  const camadas = dados.marcas
    .map((m) => {
      const x = m.x - folga;
      const y = m.y - folga;
      const w = m.w + 2 * folga;
      const h = m.h + 2 * folga;
      const caixa = `<div class="caixa" style="left:${pct(x, dados.largura)};top:${pct(y, dados.altura)};width:${pct(w, dados.largura)};height:${pct(h, dados.altura)}"></div>`;

      const [cx, cy] =
        m.lado === "esquerda" ? [x, y + h / 2]
        : m.lado === "direita" ? [x + w, y + h / 2]
        : m.lado === "cima" ? [x + w / 2, y]
        : [x + w / 2, y + h];
      const numero = `<div class="num ${m.lado}" style="left:${pct(cx, dados.largura)};top:${pct(cy, dados.altura)}">${m.n}</div>`;
      return caixa + numero;
    })
    .join("");

  return `
    <figure style="width:${largura + 2 * FOLGA_NUMEROS}px">
      <div class="quadro">
        <img src="data:image/png;base64,${base64}" alt="">
        ${camadas}
      </div>
      <figcaption>${legenda}</figcaption>
    </figure>`;
}

const passos = (itens: string[]) => `<ol class="passos">${itens.map((i) => `<li>${i}</li>`).join("")}</ol>`;
const lista = (itens: string[]) => `<ul>${itens.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const nota = (texto: string, tipo: "dica" | "atencao" = "dica") =>
  `<aside class="nota ${tipo}"><strong>${tipo === "dica" ? "Dica" : "Atenção"}</strong> ${texto}</aside>`;
const formula = (texto: string) => `<div class="formula">${texto}</div>`;

/** Tabela simples; a primeira linha é o cabeçalho. */
function tabela(linhas: string[][]): string {
  const [cab, ...corpo] = linhas;
  return `<table><thead><tr>${cab.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${corpo
    .map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

type Seccao = { id: string; titulo: string; corpo: string; quebra?: boolean };

// ---------------------------------------------------------------------------
// Guia do Utilizador
// ---------------------------------------------------------------------------
const GUIA_UTILIZADOR: Seccao[] = [
  {
    id: "introducao",
    titulo: "Antes de começar",
    corpo: `
      <p>Este guia mostra, ecrã a ecrã, como consultar as contas do condomínio
      e o que quer dizer cada valor. Os números a vermelho nas imagens
      (${n(1)}, ${n(2)}…) indicam onde clicar ou para onde olhar, e o texto
      refere-os pela mesma ordem.</p>
      ${nota("Nenhum total da aplicação é escrito à mão. Saldos, quotas em atraso, mapas e relatórios são sempre calculados a partir dos <b>movimentos</b> (as entradas e saídas de dinheiro). Quando a administração corrige um movimento, todos os números que dependem dele mudam sozinhos.")}
      <p>Como condómino, <b>consultas tudo mas não alteras nada</b>. Não é só
      uma questão de botões escondidos: é a própria base de dados que recusa
      alterações vindas de uma conta de condómino.</p>
      ${nota("Os nomes, emails e dados bancários que aparecem nas imagens foram trocados por texto genérico.")}
    `,
  },
  {
    id: "entrar",
    titulo: "1. Entrar na aplicação",
    corpo: `
      ${fig("u-entrar", "Página de entrada.")}
      ${passos([
        "Abre o endereço da aplicação no browser do computador, tablet ou telemóvel.",
        `Escreve o <b>email</b> que a administração te deu em ${n(1)}.`,
        `Escreve a <b>palavra-passe</b> em ${n(2)}.`,
        `Carrega em ${n(3)} <b>Entrar</b>.`,
      ])}
      <p>Não há registo público: as contas são sempre criadas pela
      administração. Se te esqueceres da palavra-passe, pede à administração
      para a redefinir.</p>
    `,
  },
  {
    id: "navegacao",
    titulo: "2. O ecrã e a navegação",
    quebra: true,
    corpo: `
      ${fig("u-navegacao", "O ecrã principal num computador.")}
      ${tabela([
        ["", "O que é"],
        [n(1), "O <b>menu</b>: Painel, Movimentos, Quotas, Relatórios, Assembleia de Condóminos, Guias de utilização e Definições."],
        [n(2), "O <b>seletor de exercício</b> (ano). Ver secção 3."],
        [n(3), "O teu nome e o teu papel (<i>Condómino</i> ou <i>Administração</i>)."],
        [n(4), "<b>Terminar sessão</b>: sai da aplicação."],
        [n(5), "<b>Versão · o que mudou</b>: histórico das novidades da aplicação, versão a versão."],
      ])}
      <h3>No telemóvel</h3>
      <div class="lado-a-lado">
        ${fig("u-telemovel", "Menu aberto num telemóvel.", { escala: 0.62 })}
        <div>
          <p>No telemóvel o menu está escondido. Carrega em <b>Menu</b>, no
          topo do ecrã, para o abrir; ${n(2)} mostra as opções. Carrega em
          ${n(1)} <b>Fechar</b> para o voltar a esconder.</p>
          <p>A barra de topo com o botão fica sempre visível enquanto
          percorres a página.</p>
        </div>
      </div>
    `,
  },
  {
    id: "exercicio",
    titulo: "3. Escolher o ano (exercício)",
    corpo: `
      <p>Um <b>exercício</b> é um ano de contas, de 1 de janeiro a 31 de
      dezembro. Ao entrares vês o <b>exercício ativo</b>, que é o ano em curso
      definido pela administração.</p>
      ${passos([
        `Carrega no seletor <b>EXERCÍCIO</b> ${n(2)}, no canto superior direito (figura da secção 2).`,
        "Escolhe o ano. A página recarrega com os dados desse ano.",
      ])}
      ${lista([
        "O ano escolhido fica memorizado no teu browser e acompanha-te em todas as páginas.",
        "O ano também fica no endereço da página (<code>?ano=2025</code>). Podes partilhar a ligação e ela abre nesse ano.",
        "Só aparecem anos que já tenham dados.",
      ])}
    `,
  },
  {
    id: "painel",
    titulo: "4. Painel",
    quebra: true,
    corpo: `
      <p>É a primeira página depois de entrares. No topo aparece
      <i>Exercício de {ano}</i> e, quando definida, a <b>Administração de
      {ano}</b>: a fração ou frações que geriram o condomínio nesse ano.</p>

      <h3>4.1 Disponibilidades: quanto dinheiro existe</h3>
      ${fig("u-painel-disponibilidades", "Disponibilidades no Painel.")}
      ${tabela([
        ["", "Cartão", "Como é calculado"],
        [n(1), "<b>Valor em caixa</b>: dinheiro em numerário", "Saldo de abertura da caixa + entradas de caixa − saídas de caixa do ano"],
        [n(2), "<b>Valor no banco</b>: saldo da conta à ordem", "Saldo de abertura do banco + entradas no banco − saídas do banco do ano"],
        [n(3), "<b>Total disponível</b>: tudo o que o condomínio tem", "Caixa + Banco + Depósitos a prazo + Conta poupança"],
        [n(4), "<b>Abertura de {ano}</b>", "Caixa + Banco com que o ano começou. Se o total atual está acima deste valor, o condomínio juntou dinheiro este ano."],
      ])}
      ${nota("Depositar no banco dinheiro da caixa (categoria <i>Depósito Bancário</i>) tira da caixa e põe no banco. Muda os cartões " + n(1) + " e " + n(2) + ", mas <b>não</b> muda o " + n(3) + " e não conta como receita nem como despesa.")}

      <h3>4.2 Ano de {ano}: receitas e despesas</h3>
      ${fig("u-painel-ano", "Resumo do ano no Painel.")}
      ${tabela([
        ["", "Cartão", "Como é calculado"],
        [n(1), "<b>Receitas totais do ano</b>", "Todas as entradas em categorias de receita (quotas, juros, reforços…), banco e caixa juntos."],
        [n(2), "<b>Despesas totais do ano</b>", "Todas as saídas em categorias de despesa (água, luz, limpeza, seguros…)."],
        [n(3), "<b>Top 3 despesas do ano</b>", "As três rubricas onde se gastou mais, do maior para o menor valor."],
      ])}
      <p>Transferências entre caixa e banco não contam em nenhum dos três.
      Estes valores são os mesmos da página <b>Relatórios</b>.</p>

      <h3>4.3 Quotas</h3>
      ${fig("u-painel-quotas", "Resumo das quotas no Painel.")}
      ${tabela([
        ["", "Cartão", "Como é calculado"],
        [n(1), "<b>Frações em atraso</b> — <i>X de Y</i>", "X = frações com pelo menos um mês <i>Em falta</i> ou <i>Parcial</i>. Y = total de frações ativas."],
        [n(2), "<b>Valor por cobrar</b>", "Soma do que falta nos meses <i>Em falta</i> e <i>Parciais</i>, de todas as frações. <b>Não</b> conta os meses que ainda não chegaram."],
        [n(3), "<b>Prazo de pagamento</b>", "O dia do mês até ao qual a quota deve estar paga. Depois desse dia, um mês por pagar passa a <i>Em falta</i>."],
      ])}
      <p>Os cartões ficam em tom de alerta (amarelo) quando há valores em atraso.</p>
    `,
  },
  {
    id: "movimentos",
    titulo: "5. Movimentos",
    quebra: true,
    corpo: `
      <p>O livro de contas completo, como nas antigas folhas mensais:
      <b>Movimentos bancários</b> e <b>Caixa</b> em blocos separados.</p>

      <h3>5.1 Filtrar</h3>
      ${fig("u-movimentos-filtros", "Filtros de Movimentos.")}
      ${passos([
        `Para ver o ano todo, carrega em ${n(1)} <b>Ano inteiro</b>; para um mês, carrega no mês (${n(2)}). Muda logo.`,
        `Para ver só uma rubrica, escolhe a <b>Categoria</b> em ${n(3)}.`,
        `Para ver só uma fração, escolhe-a em ${n(4)} (ou <i>Sem fração associada</i>).`,
        `Carrega em ${n(5)} <b>Filtrar</b>. Aparece <b>Limpar filtros</b> para voltar a ver tudo.`,
      ])}

      <h3>5.2 Ler um bloco de movimentos</h3>
      ${fig("u-movimentos-banco", "Bloco de movimentos bancários de um mês.")}
      ${tabela([
        ["", "O que é"],
        [n(1), "<b>Saldo</b> da conta no fim do período escolhido."],
        [n(2), "<b>Transporte</b>: o saldo com que a conta entra no período. Num mês mostra o saldo do fim do mês anterior; em janeiro ou no ano inteiro, o saldo de abertura do ano."],
        [n(3), "<b>Receita</b>: dinheiro que entrou."],
        [n(4), "<b>Despesa</b>: dinheiro que saiu."],
        [n(5), "<b>Saldo</b> da conta depois de cada movimento."],
        [n(6), "<b>Totais do período</b>: soma das receitas e despesas das linhas visíveis."],
      ])}
      ${formula("saldo desta linha = saldo da linha anterior + receita − despesa")}
      <p>O saldo nunca é escrito à mão: é sempre recalculado. Se for acrescentado
      um movimento a meio do mês, os saldos seguintes acertam sozinhos.</p>
      <p>Na coluna <b>Descrição</b>, entre parênteses, aparece a letra da fração
      e o mês a que a quota respeita — por exemplo <i>(E · Jan a Abr 2026)</i>.</p>
      ${nota("Com um filtro de categoria ou de fração, a coluna " + n(5) + " continua a mostrar o saldo <b>real</b> da conta, calculado com todos os movimentos, incluindo os escondidos pelo filtro. Por isso as linhas visíveis podem não somar ao saldo.", "atencao")}

      <h3>5.3 Total das duas contas</h3>
      ${fig("u-movimentos-total", "Rodapé da página de Movimentos.")}
      ${tabela([
        ["", "Valor", "Cálculo"],
        [n(1), "<b>Total das duas contas</b>", "Saldo final do banco + saldo final da caixa."],
        [n(2), "<b>Receitas do período</b>", "Soma das receitas visíveis, banco e caixa."],
        [n(3), "<b>Despesas do período</b>", "Soma das despesas visíveis."],
        [n(4), "<b>Diferença</b>", "Receitas − Despesas. Positiva: entrou mais do que saiu."],
      ])}
      ${nota("O Total das duas contas não inclui depósitos a prazo nem conta poupança. Esses entram no <i>Total disponível</i> do Painel.")}
    `,
  },
  {
    id: "quotas",
    titulo: "6. Quotas",
    quebra: true,
    corpo: `
      ${fig("u-quotas", "Mapa de quotas, com a explicação (i) aberta.")}
      ${tabela([
        ["", "O que é"],
        [n(1), "Carrega no <b>(i)</b> para ver um resumo das regras."],
        [n(2), "<b>Imprimir</b> o mapa (sai em A4 horizontal)."],
        [n(3), "<b>Total Pago</b>: soma das quotas dos meses já pagos, de todas as frações."],
        [n(4), "<b>Total Por Pagar</b>: tudo o que ainda falta pagar até dezembro, de todas as frações (em atraso, parcial, dentro do prazo e meses futuros)."],
        [n(5), "<b>Meses pagos</b>: quantos dos 12 meses estão totalmente pagos."],
        [n(6), "<b>Em falta</b>: o que a fração ainda tem por pagar no ano inteiro, incluindo meses futuros."],
        [n(7), "Legenda das cores."],
      ])}

      <h3>6.1 Como se decide o que está pago</h3>
      <p>Cada fração funciona como uma <b>conta corrente</b>:</p>
      ${passos([
        "Soma-se tudo o que a fração pagou de quotas no ano, no banco e na caixa, seja qual for a data da transferência.",
        "Esse total é distribuído pelos meses <b>por ordem</b>: janeiro fica pago primeiro, depois fevereiro, e assim por diante.",
        "O que sobra de um mês passa para o seguinte.",
      ])}
      <p>Por isso não importa se a quota de março chegou em abril, nem se alguém
      pagou três meses de uma vez: é o total pago que decide.</p>
      <p><b>Exemplo</b> — quota de 40 €, prazo dia 8, hoje é 20 de março. A
      fração C pagou 40 € em janeiro e 60 € em fevereiro (total 100 €):</p>
      ${tabela([
        ["Mês", "Devido", "Recebe da cascata", "Estado"],
        ["Jan", "40 €", "40 €", "✓ Pago"],
        ["Fev", "40 €", "40 €", "✓ Pago"],
        ["Mar", "40 €", "20 €", "Parcial (falta 20 €)"],
        ["Abr a Dez", "40 €", "0 €", "— (futuro)"],
      ])}
      <p>Resultado: <b>Meses pagos 2 / 12</b>; <b>Em falta</b> = 20 € + 9 × 40 € = <b>380 €</b>.</p>

      <h3>6.2 Estados de cada mês</h3>
      ${tabela([
        ["Estado", "Aparece", "Significado"],
        ['<span class="est pago">Pago</span>', "✓", "O mês está totalmente pago. Um mês futuro já pago por adiantamento também aparece assim."],
        ['<span class="est parcial">Parcial</span>', "valor em falta", "O mês já começou e está só pago em parte."],
        ['<span class="est falta">Em falta</span>', "valor em falta", "Passou o dia limite e não há nada pago nesse mês."],
        ['<span class="est porpagar">Por pagar</span>', "valor em falta", "O mês já começou mas ainda está dentro do prazo."],
        ["Futuro / isento", "—", "O mês ainda não começou, ou a fração não tem quota."],
      ])}
      <p>Passa o rato por cima de um mês para ver o valor devido e o valor pago.</p>
      <p>A quota de cada fração é a <b>quota do ano</b> aprovada; sem essa, usa-se
      a quota base da fração.</p>
      ${nota("O <i>Valor por cobrar</i> do Painel só conta o que já está em atraso ou parcial. O <i>Total Por Pagar</i> " + n(4) + " conta tudo o que falta até dezembro. Por isso são diferentes.")}

      <h3>6.3 Reforços extraordinários</h3>
      ${fig("u-quotas-reforco", "Tabela de um reforço extraordinário (exemplo de 2025).")}
      <p>Quando a assembleia aprova um pagamento único por fração (por exemplo,
      para obras), aparece uma tabela própria por baixo do mapa de quotas.</p>
      ${tabela([
        ["", "O que é"],
        [n(1), "Descrição, <b>valor por fração</b> e <b>prazo</b> do reforço."],
        [n(2), "Totais: <b>Pago</b>, <b>Em falta</b> (passou o prazo sem pagamento) e <b>Por pagar</b> (tudo o que ainda falta)."],
        [n(3), "<b>Estado</b> de cada fração: Pago, Parcial, Em falta ou Por pagar."],
      ])}
    `,
  },
  {
    id: "relatorios",
    titulo: "7. Relatórios — Mapa de origem e aplicação de fundos",
    quebra: true,
    corpo: `
      <p>O mapa oficial de contas do condomínio (MOAF). Responde a duas
      perguntas: <b>de onde veio o dinheiro</b> e <b>para onde foi</b>.</p>
      ${fig("u-relatorios", "Página de Relatórios.")}
      ${tabela([
        ["", "O que é / como se calcula"],
        [n(1), "<b>Imprimir</b> o mapa numa folha A4 horizontal."],
        [n(2), "Abre o relatório <b>Orçamento vs Realizado</b> (secção 8)."],
        [n(3) + n(4), "<b>Início</b> e <b>Fim</b> do período. Por omissão, o ano inteiro."],
        [n(5), "<b>Atualizar</b>: recalcula para as datas escolhidas."],
        [n(6), "<b>Origem de fundos</b>: <i>Administração anterior</i> (saldos com que o ano começou: caixa + banco + prazo + poupança) + <i>Administração atual</i> (receitas do período) = <i>Total</i>."],
        [n(7), "<b>Aplicação de fundos</b>: <i>Despesas</i> do período + <i>Disponibilidades</i> (o dinheiro que sobra no fim) = <i>Total</i>."],
        [n(8), "<b>Receitas por categoria</b>: o detalhe das receitas."],
        [n(9), "<b>Despesas por categoria</b>: o detalhe das despesas."],
        [n(10), "<b>Célula de controlo</b>: tem de dar 0,00 €."],
      ])}
      ${formula("Controlo = Total da Aplicação − Total da Origem = 0")}
      <p>Todo o dinheiro que havia, mais o que entrou, tem de ser igual ao que
      se gastou mais o que sobrou. Se a célula ${n(10)} aparecer a vermelho,
      avisa a administração.</p>
      ${nota("Para o mapa do ano, usa sempre um período que comece a 1 de janeiro. Um período a começar a meio do ano mostra só as receitas e despesas desse intervalo, mas continua a partir dos saldos com que o ano começou.", "atencao")}
    `,
  },
  {
    id: "orcamento",
    titulo: "8. Relatórios — Orçamento vs Realizado",
    quebra: true,
    corpo: `
      <p>Compara o orçamento aprovado em assembleia com o que aconteceu de facto.
      Abre-se pela ligação ${n(2)} da página Relatórios.</p>
      ${fig("u-orcamento", "Orçamento vs Realizado.")}
      ${tabela([
        ["", "Coluna / valor", "Cálculo"],
        [n(1), "<b>Orçamentado</b>", "Valor previsto no orçamento aprovado."],
        [n(2), "<b>Realizado</b>", "Valor real, igual ao do mapa de fundos."],
        [n(3), "<b>Desvio</b>", "Realizado − Orçamentado; entre parênteses, em % do orçamentado (0 % quando não foi orçamentado)."],
        [n(4), "<b>Variação das disponibilidades</b>", "Dinheiro no fim − dinheiro no início, previsto e real."],
        [n(5), "<b>Célula de controlo</b>", "Uma para cada coluna. A do realizado dá sempre 0; a do orçamentado só dá 0 se o orçamento estiver equilibrado."],
        [n(6), "Voltar ao mapa de fundos", ""],
      ])}
      <p><b>Exemplo:</b> Electricidade orçamentada 400 €, realizada 460 € →
      desvio <b>+60,00 € (+15,00 %)</b>: gastou-se mais do que o previsto.</p>
      ${nota("A cor do desvio indica só o sinal: verde acima do previsto, vermelho abaixo. Numa despesa, verde quer dizer que se gastou <b>mais</b> do que o previsto.")}
      <p>No ecrã aparece só a <i>Aplicação de fundos</i>; a impressão inclui
      também a <i>Origem de fundos</i>.</p>
    `,
  },
  {
    id: "atas",
    titulo: "9. Assembleia de Condóminos (atas)",
    quebra: true,
    corpo: `
      ${fig("u-actas", "Lista de atas publicadas.")}
      <p>Carrega numa ata ${n(1)} para a ler. Só aparecem atas que a
      administração já <b>publicou</b>.</p>
      ${fig("u-acta", "Uma ata.")}
      ${tabela([
        ["", "O que é"],
        [n(1), "<b>Imprimir</b> a ata."],
        [n(2), "<b>Descarregar Word</b>: o documento oficial da ata."],
        [n(3), "Voltar à lista de atas."],
        [n(4), "Condóminos presentes: andar, fração, nome, <b>permilagem</b> e forma de presença (presencial ou por procuração)."],
      ])}
      <p>Em cada ponto da ordem de trabalhos aparecem os comentários e a decisão
      (<i>aprovado por unanimidade</i> ou <i>reprovado</i>).</p>
    `,
  },
  {
    id: "conta",
    titulo: "10. Mudar a palavra-passe",
    quebra: true,
    corpo: `
      ${fig("u-conta", "Definições › Conta.")}
      ${passos([
        `No menu, carrega em <b>Definições</b>. Abre na aba ${n(1)} <b>Conta</b>, com o teu nome, email e papel.`,
        `Escreve a nova palavra-passe em ${n(2)} (pelo menos 8 caracteres).`,
        `Repete-a em ${n(3)}.`,
        `Carrega em ${n(4)} para guardar.`,
      ])}
      <p>A fração associada à tua conta só a administração a pode mudar.</p>
    `,
  },
  {
    id: "imprimir",
    titulo: "11. Imprimir e guardar em PDF",
    corpo: `
      <p>Quotas, Relatórios, Orçamento vs Realizado e as atas têm um botão
      <b>Imprimir</b>. A impressão sai já arrumada: sem menu, sem seletor de ano
      e sem filtros, e com o período escrito no topo. Quotas e Relatórios saem em
      A4 horizontal.</p>
      <p>Para guardar em PDF, escolhe <b>Guardar como PDF</b> na janela de
      impressão do browser.</p>
    `,
  },
  {
    id: "guias",
    titulo: "12. Guias de utilização",
    corpo: `
      ${fig("u-guias", "Guias de utilização.")}
      <p>Este guia está sempre disponível na aplicação, em <b>Guias de
      utilização</b> ${n(1)}, no menu.</p>
      ${passos([
        `Carrega em ${n(2)} <b>Ler guia</b> para o abrir dentro da aplicação.`,
        `Ou carrega em ${n(3)} <b>Descarregar PDF</b> para o guardar no computador ou no telemóvel e imprimir.`,
      ])}
      ${nota("No iPhone, se só aparecer a primeira página, usa <b>Abrir num separador novo</b>, no topo da página do guia.")}
    `,
  },
  {
    id: "glossario",
    titulo: "13. Glossário",
    corpo: tabela([
      ["Termo", "Significado"],
      ["Exercício", "Ano de contas (1 de janeiro a 31 de dezembro)."],
      ["Exercício ativo", "O ano que a aplicação mostra quando entras."],
      ["Saldos de abertura", "O dinheiro com que o ano começa, transportado do fecho do ano anterior."],
      ["Disponibilidades", "Dinheiro existente: caixa, banco, depósitos a prazo e conta poupança."],
      ["Movimento", "Uma entrada ou saída de dinheiro, na caixa ou no banco."],
      ["Categoria / rubrica", "A classificação do movimento (Quotizações, Água, Seguros…)."],
      ["Transferência", "Passagem de dinheiro entre caixa e banco. Não é receita nem despesa."],
      ["Quota do ano", "Quota mensal de uma fração, aprovada para esse ano."],
      ["Reforço extraordinário", "Pagamento único por fração, com prazo próprio (ex.: obras)."],
      ["Dia limite", "Dia do mês até ao qual a quota deve ser paga."],
      ["Permilagem", "Peso de cada fração no prédio, em ‰. Conta para o quórum da assembleia."],
      ["MOAF", "Mapa de Origem e Aplicação de Fundos."],
      ["Célula de controlo", "Verificação de que origem e aplicação de fundos coincidem (tem de dar 0)."],
    ]),
  },
  {
    id: "faq",
    titulo: "14. Perguntas frequentes",
    corpo: [
      ["Paguei a quota mas aparece «Em falta».", "O pagamento só conta depois de a administração o lançar ou importar do extrato do banco, associado à tua fração. Se já passou algum tempo, fala com a administração."],
      ["Paguei dois meses de uma vez e a transferência só diz um mês.", "Não faz diferença: o mapa soma tudo o que pagaste no ano e distribui pelos meses por ordem (secção 6.1)."],
      ["Paguei a mais. Onde fica o excedente?", "Cobre os meses seguintes: um mês futuro já pago aparece com ✓."],
      ["Porque é que o «Valor por cobrar» do Painel é diferente do «Total Por Pagar» das Quotas?", "O Painel só conta o que já está em atraso ou parcial; as Quotas contam tudo o que falta até dezembro."],
      ["Filtrei os movimentos e o saldo não bate com as linhas que vejo.", "É de propósito: o saldo é sempre o saldo real da conta, com todos os movimentos."],
      ["O «Total das duas contas» é diferente do «Total disponível».", "O Total disponível do Painel também soma os depósitos a prazo e a conta poupança."],
      ["Quero ver as contas de um ano anterior.", "Muda o ano no seletor EXERCÍCIO, no canto superior direito."],
      ["Não vejo a ata da última assembleia.", "A administração ainda não a publicou."],
    ]
      .map(([p, r]) => `<div class="faq"><p class="p">${p}</p><p>${r}</p></div>`)
      .join(""),
  },
];

// ---------------------------------------------------------------------------
// Guia do Administrador
// ---------------------------------------------------------------------------
const GUIA_ADMINISTRADOR: Seccao[] = [
  {
    id: "introducao",
    titulo: "Antes de começar",
    corpo: `
      <p>Este guia é para quem tem <b>acesso de administrador</b>. Mostra, ecrã a
      ecrã, como configurar o condomínio, importar e lançar movimentos, gerar
      recibos, preparar assembleias e fechar o ano. Os números a vermelho nas
      imagens (${n(1)}, ${n(2)}…) indicam onde clicar, pela mesma ordem do
      texto.</p>
      <p>O significado de cada valor do Painel, Movimentos, Quotas e Relatórios
      está no <b>Guia do Utilizador</b>. Aqui fica só o que é exclusivo da
      administração.</p>
      <p>Os dois guias estão em <b>Guias de utilização</b>, no menu. Os
      condóminos só veem o Guia do Utilizador.</p>
      ${nota("Os nomes, emails e dados bancários que aparecem nas imagens foram trocados por texto genérico.")}
    `,
  },
  {
    id: "papeis",
    titulo: "1. Acesso de administrador e administração do condomínio",
    corpo: `
      <p>São duas coisas diferentes:</p>
      ${tabela([
        ["", "Acesso de administrador (aplicação)", "Administração do condomínio (ano)"],
        ["O que é", "Permissão para lançar, editar, configurar e gerar documentos.", "A fração ou frações que geriram o condomínio num ano."],
        ["Onde se define", "Definições › <b>Contas</b> (secção 6)", "Definições › <b>Frações</b> (secção 5)"],
        ["Efeito", "Dá acesso a tudo.", "Só informativo. Aparece no Painel, Quotas e Relatórios. <b>Não dá acesso nenhum.</b>"],
      ])}
      ${fig("a-menu", "O que a administração vê a mais.")}
      ${tabela([
        ["", "Exclusivo da administração"],
        [n(1), "Menu <b>Recibos</b>."],
        [n(2), "<b>Definições</b> com todas as áreas de configuração."],
        [n(3), "As abas das Definições: Condomínio, Frações, Apólices e recibos, Quotas do ano, Orçamento, Assembleia de Condóminos, Contas, Fornecedores e Extratos bancários."],
      ])}
      <p>A administração pode ainda lançar, editar e apagar movimentos,
      descarregar os relatórios em Excel e ver as atas em rascunho.</p>
    `,
  },
  {
    id: "configuracao",
    titulo: "2. Configuração inicial — lista de verificação",
    corpo: `
      <p>Numa instalação nova, segue esta ordem:</p>
      ${passos([
        "<b>Identificação do condomínio</b> (secção 3). Sem isto não é possível gerar recibos, atas nem convocatórias.",
        "<b>Prazos</b>: dia limite da quota, localidade dos recibos e valor por presença (secção 3).",
        "<b>Exercício</b>: confirmar que o ano em curso existe e está ativo (secção 4).",
        "<b>Frações</b>: nome do condómino, tratamento, permilagem, fração ativa e administração do ano (secção 5).",
        "<b>Quotas do ano</b> de cada fração (secção 7).",
        "<b>Contas</b> de acesso dos condóminos (secção 6).",
        "<b>Orçamento</b> aprovado em assembleia (secção 8).",
        "<b>Movimentos</b>: importar os extratos do banco e lançar a caixa (secções 10 e 11).",
      ])}
    `,
  },
  {
    id: "condominio",
    titulo: "3. Dados do condomínio e prazos",
    quebra: true,
    corpo: `
      <p>Em <b>Definições › Condomínio</b>.</p>
      ${fig("a-condominio", "Identificação do condomínio.")}
      ${passos([
        `Preenche o <b>Nome</b> ${n(1)} (ex.: <i>CONDOMÍNIO DO LOTE 1</i>), o <b>Contribuinte</b> ${n(2)} e a <b>Morada</b> ${n(3)}. São obrigatórios.`,
        "Preenche, se quiseres, código postal, localidade, NIB e IBAN.",
        `Carrega em ${n(4)} <b>Guardar</b>.`,
      ])}
      <p>Estes dados aparecem no cabeçalho dos relatórios Excel, dos recibos,
      das atas e das convocatórias.</p>
      ${fig("a-prazos", "Prazos e exercício.")}
      ${tabela([
        ["", "Campo", "Efeito"],
        [n(1), "<b>Dia limite de pagamento das quotas</b>", "A partir do dia seguinte, um mês não pago passa de <i>Por pagar</i> a <i>Em falta</i>. Se o mês não tiver esse dia, usa-se o último dia do mês. Por omissão: 8."],
        [n(2), "<b>Localidade nos recibos</b>", "Texto impresso antes da data nos recibos."],
        [n(3), "<b>Valor por presença em assembleia</b>", "Valor por omissão dos recibos de presença."],
      ])}
      <p>Carrega em <b>Guardar</b> no fundo deste painel.</p>
    `,
  },
  {
    id: "exercicios",
    titulo: "4. Exercícios: criar, ativar e eliminar anos",
    quebra: true,
    corpo: `
      <p>Também em <b>Definições › Condomínio</b>, no fundo da página.</p>
      ${fig("a-exercicios", "Tabela de exercícios.")}
      ${tabela([
        ["", "O que é"],
        [n(1), "<b>Ano a criar</b>: por omissão, o ano seguinte ao mais recente."],
        [n(2), "<b>Criar exercício</b>."],
        [n(3), "Estado de cada ano: <b>ativo</b> (o que todos veem ao entrar), <b>futuro</b> (criado mas ainda não ativado) ou <b>inativo</b> (anos passados). <i>sem abertura</i> = ainda sem saldos de abertura."],
        [n(4), "<b>Tornar ativo</b>: passa a ser o ano que todos veem ao entrar."],
      ])}
      <h3>Criar o ano seguinte</h3>
      ${passos([
        `Confirma o ano em ${n(1)}.`,
        `Carrega em ${n(2)} <b>Criar exercício</b>.`,
        "A aplicação calcula o <b>fecho</b> do ano anterior (caixa e banco = abertura + todos os movimentos desse ano; prazo e poupança passam iguais) e grava-o como <b>saldos de abertura</b> do ano novo.",
        "As <b>quotas</b> do ano anterior são copiadas para o ano novo.",
        "O ano fica <b>futuro</b>: ninguém muda para ele até o ativares.",
      ])}
      <p>Na viragem do ano, carrega em ${n(4)} <b>Tornar ativo</b> na linha do ano novo.</p>
      <p>Um ano com <i>sem abertura</i> mostra um botão <b>Abrir</b>, que faz o
      mesmo que <i>Criar exercício</i>.</p>
      <h3>Eliminar um ano</h3>
      <p>O botão <b>Eliminar</b> (com confirmação) apaga os saldos de abertura e
      as quotas desse ano; os movimentos nunca são apagados por aqui. Não é
      possível eliminar o ano <b>ativo</b> nem um ano <b>com movimentos</b>:
      nesses casos aparece o motivo em vez do botão.</p>
      ${nota("Os saldos de abertura não se editam à mão: vêm sempre do fecho do ano anterior. Se lançares mais movimentos do ano antigo depois de criares o ano novo, os saldos do ano novo não se atualizam sozinhos. Nesse caso, enquanto o ano novo não tiver movimentos, elimina-o e volta a criá-lo.", "atencao")}
    `,
  },
  {
    id: "fracoes",
    titulo: "5. Frações e condóminos",
    quebra: true,
    corpo: `
      <p>Em <b>Definições › Frações</b>.</p>
      ${fig("a-fracoes", "Tabela de frações.")}
      <p>A coluna ${n(1)} <b>Administração de {ano}</b> indica quem geriu o
      condomínio no ano escolhido no seletor do topo. Para alterar uma fração,
      carrega em ${n(2)} <b>Editar</b>.</p>
      ${fig("a-fracao-editar", "Editar uma fração.")}
      ${tabela([
        ["", "Campo", "Para que serve"],
        [n(1), "<b>Nome do condómino</b>", "Usado nos recibos, atas e convocatórias e para reconhecer transferências nos extratos. <b>Uma fração sem nome não pode receber recibos.</b>"],
        [n(2), "<b>Permilagem</b>", "Peso da fração no prédio, em ‰. Usada nas atas e na folha de presenças para o quórum."],
        [n(3), "<b>Tratamento nos recibos</b>", "<i>do condómino</i> ou <i>da condómina</i>."],
        [n(4), "<b>Fração ativa</b>", "Uma fração inativa não deve quotas nem reforços."],
        [n(5), "<b>Administração de {ano}</b>", "Marca se esta fração gere o condomínio nesse ano. Só informativo."],
        [n(6), "<b>Guardar</b>", ""],
      ])}
      ${nota("A marcação de administração é por ano: escolhe o ano no seletor do topo antes de editar.")}
    `,
  },
  {
    id: "contas",
    titulo: "6. Contas de acesso",
    quebra: true,
    corpo: `
      <p>Em <b>Definições › Contas</b>.</p>
      <h3>Criar uma conta</h3>
      ${fig("a-contas-nova", "Nova conta.")}
      ${passos([
        `Escreve o nome (opcional) e o <b>email</b> ${n(1)}.`,
        `Escolhe uma <b>palavra-passe</b> ${n(2)} com pelo menos 8 caracteres. Fica visível enquanto escreves, para a poderes comunicar.`,
        `Escolhe a <b>fração</b> do condómino em ${n(3)}.`,
        `Marca ${n(4)} <b>Acesso de administrador</b> só para quem vai gerir a aplicação.`,
        `Carrega em ${n(5)} <b>Criar conta</b>.`,
        "Comunica o email e a palavra-passe ao condómino. Ele pode mudá-la depois em Definições › Conta.",
      ])}
      <h3>Gerir uma conta existente</h3>
      ${fig("a-contas-existente", "Uma conta existente.")}
      ${tabela([
        ["", "O que faz"],
        [n(1), "Muda a <b>fração associada</b>."],
        [n(2), "Dá ou tira o <b>acesso de administrador</b>."],
        [n(3), "<b>Guardar</b> as duas alterações anteriores."],
        [n(4), "<b>Alterar palavra-passe</b>: define uma nova (útil quando alguém se esquece)."],
        [n(5), "<b>Apagar conta</b>: pede confirmação; a pessoa perde o acesso de imediato. Não é possível apagar a própria conta."],
      ])}
      <p>As contas de condómino sem fração aparecem primeiro, com a etiqueta
      <i>por atribuir</i>.</p>
    `,
  },
  {
    id: "quotas",
    titulo: "7. Quotas do ano e reforços extraordinários",
    quebra: true,
    corpo: `
      <p>Em <b>Definições › Quotas do ano</b>. Esta página usa o ano do
      <b>seletor do topo</b>: confirma-o antes de mexer.</p>
      ${fig("a-quotas-ano", "Quotas mensais do ano.")}
      ${passos([
        `A coluna ${n(1)} <b>Quota base</b> mostra o valor por omissão de cada fração.`,
        `Escreve a quota aprovada para o ano em ${n(2)} (ex.: <code>40,00</code>). Em branco, a fração usa a quota base.`,
        `Carrega em ${n(3)} <b>Guardar</b>.`,
      ])}
      <p>Alterar as quotas de um ano não mexe nos anos anteriores.</p>

      <h3>Reforços extraordinários</h3>
      ${fig("a-reforco", "Criar um reforço extraordinário.")}
      ${passos([
        `Escreve a <b>descrição</b> ${n(1)}, por exemplo <i>Reforço para obras da fachada</i>.`,
        `Indica o <b>valor por fração</b> ${n(2)}.`,
        `Escolhe a <b>data limite de pagamento</b> ${n(3)}. Depois dela, quem não pagou nada fica <i>Em falta</i>.`,
        `Escolhe a <b>categoria de receita</b> ${n(4)} onde estes pagamentos entram no mapa de fundos (normalmente <i>Reforço Fundos Obras</i>).`,
        `Carrega em ${n(5)} <b>Criar reforço</b>.`,
      ])}
      <p>Os pagamentos <b>já lançados</b> nessa categoria e nesse ano, ainda sem
      reforço, ficam associados automaticamente. Os seguintes associam-se ao
      lançar o movimento (secção 11). Eliminar um reforço não apaga os
      movimentos.</p>
    `,
  },
  {
    id: "orcamento",
    titulo: "8. Orçamento",
    quebra: true,
    corpo: `
      <p>Em <b>Definições › Orçamento</b>, para o ano do seletor do topo. É o que
      alimenta o relatório <i>Orçamento vs Realizado</i>.</p>
      ${fig("a-orcamento", "Orçamento do ano.", { escala: 0.62 })}
      ${passos([
        `Em ${n(1)} escreve o valor previsto para cada categoria de receita.`,
        `Em ${n(2)} o valor previsto para cada categoria de despesa.`,
        `Em ${n(3)} as disponibilidades previstas no fim do ano (caixa, à ordem, prazo e poupança).`,
        `Carrega em ${n(4)} <b>Guardar</b>.`,
      ])}
      <p>Uma categoria em branco conta como não orçamentada (zero). Para o
      orçamento fechar:</p>
      ${formula("disponibilidades previstas = saldos de abertura + receitas previstas − despesas previstas")}
      <p>A aplicação não obriga a isto, mas a célula de controlo do orçamentado,
      no relatório, mostra a diferença.</p>
    `,
  },
  {
    id: "fornecedores",
    titulo: "9. Fornecedores e apólices de seguro",
    quebra: true,
    corpo: `
      <h3>Fornecedores</h3>
      <p>Em <b>Definições › Fornecedores</b>. Cada fornecedor tem nome, tipo,
      email, telefone e IBAN, visíveis só para a administração.</p>
      ${fig("a-fornecedores", "Novo fornecedor.")}
      <p>Preenche os campos e carrega em ${n(1)} <b>Adicionar</b>. Os fornecedores
      já criados aparecem por cima, cada um com o seu <b>Guardar</b> e o botão
      para o apagar.</p>

      <h3>Apólices e recibos dos seguros</h3>
      <p>Em <b>Definições › Apólices e recibos</b>, para o ano do seletor.</p>
      ${fig("a-seguros", "Apólices e recibos entregues.")}
      ${passos([
        `Marca ${n(2)} quando a fração entrega a cópia da <b>apólice</b> do seguro de habitação.`,
        `Marca ${n(3)} quando entrega o <b>recibo</b> do pagamento.`,
        "Carrega em <b>Guardar</b>, no fundo da tabela.",
      ])}
      <p>${n(1)} mostra quantas frações já entregaram. Para levar esta tabela para
      uma ata, ver a secção 13.</p>
    `,
  },
  {
    id: "extratos",
    titulo: "10. Importar o extrato do banco",
    quebra: true,
    corpo: `
      <p>Os movimentos do <b>banco</b> entram por aqui, em <b>Definições ›
      Extratos bancários</b>. Os da <b>caixa</b> lançam-se à mão (secção 11).</p>
      ${fig("a-extratos", "Carregar o ficheiro do extrato.")}
      ${passos([
        "No homebanking, exporta o extrato em <b>CSV</b>, <b>XLSX/XLS</b> ou <b>PDF</b> (até 8 MB).",
        `Escolhe o ficheiro em ${n(1)}.`,
        `Carrega em ${n(2)} <b>Ler ficheiro</b>. <b>Ainda não é gravado nada.</b>`,
      ])}
      ${fig("a-extratos-revisao", "Revisão do extrato antes de gravar (extrato de exemplo).")}
      ${tabela([
        ["", "O que fazer"],
        [n(1), "Resumo: linhas lidas, repetidas e <b>marcadas para gravar</b>."],
        [n(2), "<b>Gravar</b>: só as linhas com a caixa marcada são gravadas."],
        [n(3), "Motivo da sugestão automática: diz porque a aplicação escolheu aquela categoria ou fração."],
        [n(4), "<b>Categoria</b>: confirma ou escolhe. <b>Linhas sem categoria não são gravadas.</b>"],
        [n(5), "<b>Fração</b>: obrigatória nas quotas, é o que faz o pagamento contar no mapa de Quotas."],
        [n(6), "<b>Mês da quota</b>: mês ou intervalo a que a quota respeita. É só uma anotação, mas aparece no recibo."],
        [n(7), "<b>Gravar N movimento(s)</b>: grava as linhas marcadas na conta <b>banco</b>."],
      ])}
      <h3>Como funcionam as sugestões</h3>
      ${tabela([
        ["Situação", "Sugestão", "Já marcada?"],
        ["Entrada com o nome do condómino (ou «FRACAO C») e valor igual à quota", "Quotizações + fração + mês", "Sim"],
        ["Igual, mas com valor diferente da quota (ex.: dois meses de uma vez)", "Quotizações + fração", "<b>Não</b>: confirma e marca à mão"],
        ["Descrição com um padrão conhecido (comissão, EDP, SMAS, seguro, limpeza…)", "A categoria desse padrão", "Sim"],
        ["Nada reconhecido", "—", "Não"],
      ])}
      ${nota("Se importares um extrato que se sobrepõe a outro, as linhas já importadas aparecem com a etiqueta <b>repetida</b>, fundo amarelo e desmarcadas. Deixa-as desmarcadas para não duplicar movimentos.", "atencao")}
    `,
  },
  {
    id: "movimentos",
    titulo: "11. Lançar, editar e apagar movimentos",
    quebra: true,
    corpo: `
      ${fig("a-movimentos-accoes", "Bloco da Caixa em Movimentos, visto pela administração.")}
      ${tabela([
        ["", "O que faz"],
        [n(1), "<b>Editar</b> o movimento."],
        [n(2), "<b>Apagar</b> o movimento (com confirmação). Só nos lançados à mão."],
        [n(3), "<b>Lançar movimento à mão</b> na caixa."],
      ])}
      <h3>Lançar um movimento de caixa</h3>
      ${fig("a-lancar", "Lançar uma quota paga em numerário.")}
      ${passos([
        `Carrega em <b>Lançar movimento à mão</b> e escolhe o ${n(1)} <b>Sentido</b>: <i>Saída</i> (despesa) ou <i>Entrada</i> (receita).`,
        `Indica a <b>data</b> ${n(2)} e o <b>valor</b> ${n(3)} (ex.: <code>120,00</code>).`,
        `Escolhe a <b>categoria</b> ${n(4)}. Só aparecem as compatíveis com o sentido.`,
        `Escreve uma <b>descrição</b> ${n(5)}, por exemplo <i>Limpeza do prédio JAN 2026</i>.`,
        `Numa entrada de <b>Quotizações</b>, escolhe a <b>fração</b> ${n(6)} e, se quiseres, o <b>mês da quota</b> ${n(7)} (um mês ou um intervalo).`,
        `Carrega em ${n(8)} <b>Lançar movimento</b>.`,
      ])}
      <p>Numa entrada de uma categoria com reforços (ex.: <i>Reforço Fundos
      Obras</i>), aparecem os campos <b>Fração</b> e <b>Reforço</b>. Preenche os
      dois para o pagamento contar na tabela do reforço.</p>
      ${nota("<b>Depositar dinheiro da caixa no banco:</b> lança uma <i>Saída</i> na caixa com a categoria <b>Depósito Bancário</b>. Quando o depósito aparecer no extrato, importa-o também como <b>Depósito Bancário</b>. O dinheiro sai de uma conta e entra na outra sem contar como receita nem despesa.")}

      <h3>Editar</h3>
      ${fig("a-editar-movimento", "Editar um movimento.")}
      <p>Muda o que for preciso (data, sentido, valor, categoria, descrição,
      fração ${n(1)}, mês ou reforço) e carrega em ${n(2)} <b>Guardar</b>. Todos
      os saldos e mapas atualizam-se.</p>
      ${fig("a-movimentos-extrato", "Movimentos importados do banco.")}
      <p>Os movimentos com a etiqueta ${n(1)} <b>extrato</b> vieram do banco:
      editam-se, mas não se apagam aqui. Corrigir a categoria, a fração ou o mês
      é seguro. Mudar a data ou o valor faz a linha deixar de bater com o
      extrato.</p>
      ${fig("a-quotas-movimentos", "Atalho a partir do mapa de Quotas.")}
      <p>No mapa de <b>Quotas</b>, a ligação ${n(1)} <b>movimentos</b> ao lado de
      cada fração abre só os movimentos dessa fração. É a forma mais rápida de
      corrigir um pagamento associado à fração errada.</p>
    `,
  },
  {
    id: "recibos",
    titulo: "12. Recibos",
    quebra: true,
    corpo: `
      <p>Menu <b>Recibos</b>. Gera um ficheiro <b>Word</b> com <b>dois recibos por
      folha A4</b>, prontos a imprimir e cortar, com os valores por extenso.
      Antes, confirma que a identificação do condomínio está preenchida e que as
      frações têm nome e tratamento.</p>

      <h3>12.1 Recibo de quota</h3>
      ${fig("a-recibos-quota", "Recibos de quota.")}
      ${passos([
        `Em ${n(1)} deixa escolhido <b>Quota</b>.`,
        `A tabela lista todos os <b>pagamentos de quotas</b> do ano, cada um com a sua data e valor. Usa ${n(2)} para filtrar por fração ou nome.`,
        `Marca os pagamentos a imprimir em ${n(3)}.`,
        `Confirma o número de recibos e o total em ${n(4)}.`,
        `Carrega em ${n(5)} <b>Gerar e descarregar</b>.`,
      ])}
      <p>Cada recibo usa a <b>data</b> e o <b>valor</b> do pagamento. Os meses
      vêm do <i>Mês da quota</i> do movimento; se estiver vazio, é o mês da data.
      Os pagamentos com a etiqueta <b>já tem recibo</b> podem ser reimpressos
      sem ficarem duplicados.</p>

      <h3>12.2 Recibo de presença em assembleia</h3>
      ${fig("a-recibos-presenca", "Recibos de presença em assembleia.")}
      ${passos([
        `Escolhe ${n(1)} <b>Presença em assembleia</b>.`,
        `Marca as frações ${n(2)}. Só as que têm nome de condómino podem ser escolhidas.`,
        `Indica a <b>data da assembleia</b> ${n(3)} (obrigatória).`,
        `O <b>valor</b> ${n(4)} em branco usa o valor das Definições.`,
        `Confirma a <b>data de emissão</b> ${n(5)} e carrega em ${n(6)} <b>Gerar e descarregar</b>.`,
      ])}

      <h3>12.3 Documento de caixa</h3>
      ${fig("a-recibos-caixa", "Documento de caixa.")}
      <p>Para um pagamento feito pelo condomínio, por exemplo à pessoa da limpeza.</p>
      ${passos([
        `Escolhe ${n(1)} <b>Documento de caixa</b>.`,
        `Preenche o <b>destinatário</b> ${n(2)}, o <b>serviço</b> ${n(3)}, o <b>período</b> ${n(4)} e o <b>valor</b> ${n(5)}.`,
        `Confirma a <b>data de emissão</b> ${n(6)} e carrega em ${n(7)} <b>Gerar e descarregar</b>.`,
      ])}
      ${nota("Gerar um documento de caixa <b>não</b> lança a despesa. Lança-a em Movimentos › Caixa à parte.", "atencao")}
    `,
  },
  {
    id: "assembleia",
    titulo: "13. Assembleia de Condóminos",
    quebra: true,
    corpo: `
      <p>Tudo se prepara em <b>Definições › Assembleia de Condóminos</b>. Os
      condóminos só veem as atas depois de publicadas.</p>
      ${formula("Nova Assembleia → ordem de trabalhos → convocatórias → folha de presenças → reunião → presenças e decisões → Guardar → Publicar")}

      <h3>13.1 Criar a assembleia</h3>
      ${fig("a-actas", "Lista de assembleias e folha de presenças.")}
      ${passos([
        `Confirma o <b>número</b> ${n(1)} (sugerido: a última ata + 1) e a <b>data da assembleia</b> ${n(2)}.`,
        `Carrega em ${n(3)} <b>Nova Assembleia</b>. A ata é criada em rascunho, com a hora e o local da anterior, e abre o editor.`,
        `Para levar para a reunião, escolhe a data e carrega em ${n(4)} <b>Gerar folha de presenças</b>: um Word com todas as frações, a permilagem e espaço para as assinaturas.`,
      ])}
      <p>Na lista, ${n(5)} mostra o estado de cada ata (<i>Rascunho</i> ou
      <i>Publicada</i>) e ${n(6)} <b>Editar</b> abre-a.</p>

      <h3>13.2 Cabeçalho</h3>
      ${fig("a-acta-cabecalho", "Cabeçalho da ata.")}
      <p>Número ${n(1)}, data ${n(2)}, hora de início ${n(3)} (ex.: <code>11.00</code>),
      hora de fim ${n(4)} e local ${n(5)}. Formam o primeiro parágrafo: <i>«Aos
      18 dias do mês de janeiro de 2026, pelas 11.00 horas, {local}, teve lugar a
      assembleia…»</i>.</p>

      <h3>13.3 Ordem de trabalhos</h3>
      ${fig("a-acta-topicos", "Ordem de trabalhos.")}
      ${tabela([
        ["", "O que é"],
        [n(1), "<b>Tópico</b>: o título do ponto (ex.: <i>Aumento das quotas para 2026</i>)."],
        [n(2), "<b>Decisão</b>: <i>Sem votação</i>, <i>Aprovado por unanimidade</i> ou <i>Reprovado</i>. Na ata sai <i>«Colocado à votação, foi aprovado por unanimidade.»</i>"],
        [n(3), "<b>Comentários</b>: o texto do ponto. Uma linha em branco começa um parágrafo novo."],
        [n(4), "<b>Inserir tabela de apólices</b>: põe no texto a tabela das apólices e recibos dos seguros (secção 9)."],
        [n(5), "Setas para <b>mudar a ordem</b> dos pontos."],
        [n(6), "<b>Remover</b> o ponto."],
      ])}
      <div class="lado-a-lado">
        ${fig("a-acta-adicionar", "")}
        <p>${n(7)} <b>+ Adicionar tópico</b>, no fundo da lista, acrescenta um ponto novo.</p>
      </div>
      ${nota("A tabela de apólices é copiada para a ata quando guardas e fica fixa: mudanças posteriores não alteram atas antigas. Para a refrescar, marca <i>Atualizar com os dados atuais</i> e guarda de novo.")}

      <h3>13.4 Condóminos presentes</h3>
      ${fig("a-acta-presencas", "Registar as presenças.")}
      ${passos([
        `Marca ${n(1)} as frações presentes ou representadas.`,
        `O nome ${n(2)} vem de Frações, mas podes mudá-lo só nesta ata (ex.: cônjuge).`,
        `A <b>permilagem</b> ${n(3)} vem de Frações e fica gravada na ata.`,
        `Em <b>Forma</b> ${n(4)} escolhe <i>Presencial</i> ou <i>Procuração fração X</i>.`,
        `${n(5)} <b>Total presente</b> mostra a permilagem presente e a percentagem do prédio, para verificar o quórum.`,
      ])}
      <div class="lado-a-lado">
        ${fig("a-acta-guardar", "")}
        <p>Carrega em ${n(6)} <b>Guardar ata</b>. Guarda sempre antes de gerar
        documentos ou publicar, porque estes usam a última versão guardada.</p>
      </div>

      <h3>13.5 Convocatórias</h3>
      ${fig("a-acta-convocatorias", "Gerar as convocatórias.")}
      ${passos([
        `Confirma o <b>local da reunião</b> ${n(1)}.`,
        `Indica a data ${n(2)} e a hora ${n(3)} da <b>segunda convocação</b> (por omissão, uma semana depois), que vale se não houver quórum na primeira.`,
        `Carrega em ${n(4)} <b>Gerar convocatórias</b>: um Word com uma convocatória por condómino.`,
      ])}
      <p>O botão só fica ativo depois de guardares pelo menos um tópico.</p>

      <h3>13.6 Documento e publicação</h3>
      ${fig("a-acta-publicar", "Descarregar e publicar a ata.")}
      ${tabela([
        ["", "O que faz"],
        [n(1), "<b>Descarregar Word</b>: a ata oficial, com a folha de assinaturas."],
        [n(2), "<b>Pré-visualizar</b>: vê a ata como os condóminos a vão ver."],
        [n(3), "<b>Publicar ata</b>: fica visível para todos. Depois aparece <i>Voltar a rascunho</i> para a retirar."],
        [n(4), "<b>Eliminar ata</b> (com confirmação)."],
      ])}
    `,
  },
  {
    id: "excel",
    titulo: "14. Relatórios em Excel",
    corpo: `
      ${fig("a-relatorios-excel", "Descarregar o mapa de fundos em Excel.")}
      <p>Em <b>Relatórios</b>, ${n(1)} <b>Descarregar em Excel</b> gera o Mapa de
      Origem e Aplicação de Fundos (MOAF) para o período escolhido, na disposição
      do ficheiro original. Em <b>Orçamento vs Realizado</b> há um botão igual,
      com as colunas Orçamentado, Realizado, Desvio e Desvio %.</p>
    `,
  },
  {
    id: "rotinas",
    titulo: "15. Rotinas recomendadas",
    quebra: true,
    corpo: `
      <h3>Todos os meses</h3>
      ${passos([
        "Importar o extrato do banco e associar cada quota à fração (secção 10).",
        "Lançar os movimentos da caixa e os depósitos bancários (secção 11).",
        "Conferir: o saldo dos <i>Movimentos bancários</i> deve ser igual ao do extrato; o saldo da <i>Caixa</i>, igual ao dinheiro físico.",
        "Ver o mapa de <b>Quotas</b> e contactar quem estiver <i>Em falta</i>.",
        "Gerar os recibos de quota dos pagamentos novos (secção 12.1).",
      ])}
      <h3>Antes da assembleia anual</h3>
      ${passos([
        "Relatórios: confirmar que a célula de controlo está a 0 e imprimir ou descarregar o mapa.",
        "Imprimir o <i>Orçamento vs Realizado</i> do ano.",
        "Nova Assembleia → ordem de trabalhos → convocatórias → folha de presenças (secção 13).",
        "Atualizar as apólices e recibos dos seguros (secção 9).",
      ])}
      <h3>Depois da assembleia</h3>
      ${passos([
        "Completar a ata (presenças, decisões, comentários), guardar e publicar.",
        "Gerar os recibos de presença, se aplicável.",
        "Registar as decisões: quotas do ano novo, orçamento, reforços e a nova administração em Frações.",
      ])}
      <h3>Na viragem do ano</h3>
      ${passos([
        "Garantir que todos os movimentos até 31 de dezembro estão lançados.",
        "Criar o exercício do ano novo (secção 4).",
        "Rever as quotas do ano novo (secção 7).",
        "Tornar ativo o ano novo.",
      ])}
    `,
  },
  {
    id: "categorias",
    titulo: "16. Categorias",
    corpo: `
      <p>As categorias são fixas e não se editam na aplicação:</p>
      ${tabela([
        ["Natureza", "Categorias"],
        ["Receita", "Quotizações · Juros depósitos a prazo · Juros conta poupança · Reforço Fundos Obras"],
        ["Despesa", "Agua · Correios · Seguros · Despesas bancárias · Electricidade · Ferramentas e utensílios · Materiais de limpeza · Obras e reparações · Papelaria · Pagamentos a pessoal · Presença Reunião"],
        ["Transferência", "Depósito Bancário (caixa ↔ banco; não é receita nem despesa)"],
      ])}
      <p>Só os movimentos de <b>Quotizações</b> com <b>fração</b> contam no mapa
      de Quotas. Criar categorias novas ou mudar os padrões de reconhecimento dos
      extratos exige alterar a base de dados, fora da aplicação.</p>
    `,
  },
  {
    id: "problemas",
    titulo: "17. Resolução de problemas",
    corpo: tabela([
      ["Problema", "Causa provável e solução"],
      ["<i>«Falta preencher os dados do condomínio»</i> ao gerar recibos, atas ou convocatórias", "Preenche Definições › Condomínio › Identificação (secção 3)."],
      ["Um pagamento não aparece no mapa de Quotas", "O movimento não tem fração ou não é de Quotizações. Edita-o em Movimentos."],
      ["Um pagamento não aparece em Recibos › Quota", "Falta a fração, a fração não tem nome, ou o pagamento é de outro ano (muda o seletor)."],
      ["Uma fração não se pode escolher nos recibos de presença", "Falta o nome do condómino em Frações."],
      ["Um pagamento de reforço não conta na tabela do reforço", "Edita o movimento e escolhe a Fração e o Reforço."],
      ["O saldo do banco não bate com o extrato", "Faltam linhas por importar ou foram gravadas linhas repetidas. Filtra Movimentos pelo mês e compara."],
      ["«Gerar convocatórias» está desativado", "Guarda primeiro a ata com pelo menos um tópico."],
      ["Não consigo eliminar um exercício", "É o ativo (torna outro ativo) ou tem movimentos (apaga-os primeiro)."],
      ["«Tornar ativo» dá erro", "O ano ainda não tem saldos de abertura: usa Abrir ou Criar exercício primeiro."],
      ["Definições › Contas diz «Gestão de contas indisponível»", "Falta a chave SUPABASE_SERVICE_ROLE_KEY no servidor."],
      ["Estou a alterar o ano errado", "Quotas do ano, Orçamento, Apólices e a Administração do ano usam o ano do seletor do topo."],
    ]),
  },
];

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------
const ESTILO = `
  @page { size: A4; margin: 18mm 16mm 20mm; }
  :root {
    --verde: #274a43; --verde-escuro: #0f1d1b; --ocre: #b0701f;
    --papel: #f2efe7; --linha: #e6e1d5; --texto: #3e3933; --suave: #6f6659;
    --marca: #d63b1f;
  }
  * { box-sizing: border-box; }
  html { color-scheme: light; }
  body { margin: 0; background: #fff; font-family: Inter, system-ui, sans-serif; font-size: 10.5pt; line-height: 1.6; color: var(--texto); }
  h1, h2, h3 { font-family: Fraunces, Georgia, serif; color: var(--verde-escuro); letter-spacing: -0.02em; line-height: 1.2; }
  h2 { font-size: 20pt; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 2px solid var(--linha); break-after: avoid; }
  h3 { font-size: 13pt; margin: 22px 0 8px; break-after: avoid; }
  p { margin: 0 0 10px; }
  code { background: var(--papel); padding: 1px 5px; border-radius: 4px; font-size: 9.5pt; }
  section.seccao { margin-bottom: 26px; }
  section.quebra { break-before: page; }

  .capa { height: 257mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page;
    background: radial-gradient(120% 80% at 10% 5%, rgba(206,138,43,.25), transparent 55%),
                radial-gradient(90% 70% at 90% 20%, rgba(66,116,104,.6), transparent 60%), #1e322e;
    color: #faf8f4; border-radius: 14px; padding: 22mm 18mm; }
  .capa .sobre { font-family: Fraunces, serif; letter-spacing: .25em; text-transform: uppercase; color: #f0d296; font-size: 10pt; }
  .capa h1 { color: #faf8f4; font-size: 40pt; margin: 0 0 10px; }
  .capa .sub { font-size: 13pt; color: #dde9e5; max-width: 120mm; }
  .capa .rodape { font-size: 9.5pt; color: #bcd3cc; border-top: 1px solid rgba(255,255,255,.2); padding-top: 10px; }

  .indice { break-after: page; }
  .indice ol { list-style: none; padding: 0; margin: 0; columns: 1; }
  .indice li { padding: 7px 0; border-bottom: 1px dotted var(--linha); }
  .indice a { color: var(--verde); text-decoration: none; font-weight: 500; }

  figure { margin: 6px auto 10px; padding: 26px 26px 0; break-inside: avoid; max-width: 100%; }
  .quadro { position: relative; border: 1px solid var(--linha); border-radius: 8px; box-shadow: 0 1px 2px rgba(30,50,46,.06), 0 6px 18px rgba(30,50,46,.08); }
  .quadro img { display: block; width: 100%; border-radius: 8px; }
  figcaption { font-size: 8.5pt; color: var(--suave); margin-top: 6px; text-align: center; font-style: italic; }
  .caixa { position: absolute; border: 2px solid var(--marca); border-radius: 5px; box-shadow: 0 0 0 2px rgba(214,59,31,.15); }
  .num { position: absolute; width: 20px; height: 20px; border-radius: 50%; background: var(--marca); color: #fff;
    font: 700 10.5px/20px Inter, sans-serif; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,.35); border: 1.5px solid #fff; }
  .num.esquerda { transform: translate(calc(-100% - 3px), -50%); }
  .num.direita  { transform: translate(3px, -50%); }
  .num.cima     { transform: translate(-50%, calc(-100% - 3px)); }
  .num.baixo    { transform: translate(-50%, 3px); }

  .n { display: inline-block; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; background: var(--marca); color: #fff;
    font: 700 9px/17px Inter, sans-serif; text-align: center; vertical-align: 1px; margin: 0 1px; }

  table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; font-size: 9.5pt; break-inside: auto; }
  tr { break-inside: avoid; }
  th { text-align: left; background: var(--papel); color: var(--verde-escuro); font-weight: 600; padding: 6px 8px; border-bottom: 1px solid var(--linha); }
  td { padding: 6px 8px; border-bottom: 1px solid var(--linha); vertical-align: top; }
  td:first-child:has(.n) { width: 34px; white-space: nowrap; }

  ol.passos { counter-reset: p; list-style: none; padding: 0; margin: 8px 0 14px; }
  ol.passos li { counter-increment: p; position: relative; padding: 4px 0 4px 32px; }
  ol.passos li::before { content: counter(p); position: absolute; left: 0; top: 4px; width: 22px; height: 22px; border-radius: 6px;
    background: var(--verde); color: #fff; font: 600 10px/22px Inter, sans-serif; text-align: center; }
  ul { padding-left: 18px; margin: 6px 0 12px; }

  .nota { break-inside: avoid; border-left: 4px solid var(--verde); background: #f1f6f4; padding: 9px 12px; border-radius: 0 8px 8px 0; margin: 12px 0; font-size: 9.8pt; }
  .nota.atencao { border-color: var(--ocre); background: #fdf7ed; }
  .nota strong:first-child { display: block; font-family: Fraunces, serif; color: var(--verde-escuro); margin-bottom: 2px; }
  .formula { font-family: "JetBrains Mono", Consolas, monospace; font-size: 9.5pt; background: var(--papel); border-radius: 8px; padding: 9px 12px; margin: 10px 0 14px; text-align: center; color: var(--verde-escuro); break-inside: avoid; }
  .lado-a-lado { display: flex; gap: 22px; align-items: center; break-inside: avoid; }
  .lado-a-lado figure { margin: 8px 0; flex: none; }
  .est { display: inline-block; padding: 1px 8px; border-radius: 5px; font-size: 9pt; border: 1px solid; }
  .est.pago { background: rgba(63,122,78,.15); color: #2f5c3b; border-color: rgba(63,122,78,.3); }
  .est.parcial { background: #f8e9cc; color: #74451f; border-color: #e5b964; }
  .est.falta { background: rgba(166,58,43,.12); color: #7d2c20; border-color: rgba(166,58,43,.3); }
  .est.porpagar { background: #f2efe7; color: #6f6659; border-color: #d5cdbd; }
  .faq { break-inside: avoid; margin-bottom: 12px; }
  .faq .p { font-weight: 600; color: var(--verde-escuro); margin-bottom: 2px; }
  .falta { color: red; }
`;

function documento(titulo: string, subtitulo: string, publico: string, seccoes: Seccao[]): string {
  const data = new Date().toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
  return `<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><title>${titulo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${ESTILO}</style></head>
<body>
  <div class="capa">
    <div class="sobre">Gestão de Condomínio</div>
    <div>
      <h1>${titulo}</h1>
      <p class="sub">${subtitulo}</p>
    </div>
    <div class="rodape">${publico}<br>Aplicação versão ${VERSAO} · ${data}</div>
  </div>
  <nav class="indice">
    <h2>Índice</h2>
    <ol>${seccoes.map((s) => `<li><a href="#${s.id}">${s.titulo}</a></li>`).join("")}</ol>
  </nav>
  ${seccoes
    .map(
      (s, i) =>
        `<section id="${s.id}" class="seccao${s.quebra && i > 0 ? " quebra" : ""}"><h2>${s.titulo}</h2>${s.corpo}</section>`,
    )
    .join("\n")}
</body></html>`;
}

async function main() {
  mkdirSync(PASTA_SAIDA, { recursive: true });
  const guias = [
    {
      ficheiro: "Guia do Utilizador.pdf",
      titulo: "Guia do Utilizador",
      html: documento(
        "Guia do Utilizador",
        "Como consultar as contas do condomínio, passo a passo, e o que quer dizer cada valor.",
        "Para todos os condóminos com conta na aplicação.",
        GUIA_UTILIZADOR,
      ),
    },
    {
      ficheiro: "Guia do Administrador.pdf",
      titulo: "Guia do Administrador",
      html: documento(
        "Guia do Administrador",
        "Configurar o condomínio, importar e lançar movimentos, gerar recibos, preparar assembleias e fechar o ano.",
        "Para quem tem acesso de administrador na aplicação.",
        GUIA_ADMINISTRADOR,
      ),
    },
  ];

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    for (const g of guias) {
      const pagina = await browser.newPage();
      // Guardado também em HTML, para rever no browser se for preciso.
      const html = join(PASTA_CAPTURAS, `${g.titulo}.html`);
      writeFileSync(html, g.html);
      await pagina.setContent(g.html, { waitUntil: "load", timeout: 120_000 });
      await pagina.evaluate(() => document.fonts.ready);
      const destino = join(PASTA_SAIDA, g.ficheiro);
      await pagina.pdf({
        path: destino,
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: `<div style="width:100%;font:8px Inter,sans-serif;color:#8b8171;padding:0 16mm;display:flex;justify-content:space-between">
          <span>${g.titulo} · Gestão de Condomínio</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      });
      console.log(`ok ${destino}`);
      await pagina.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
