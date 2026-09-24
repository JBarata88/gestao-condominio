/**
 * Leitura do CHANGELOG.md para a página "O que mudou".
 *
 * O ficheiro segue sempre o mesmo formato (Keep a Changelog): um preâmbulo,
 * depois blocos "## [versão] — data" com secções "### Categoria" e listas
 * com no máximo um nível de sub-itens. Um parser pequeno e feito à medida
 * deste formato chega, sem precisar de trazer uma biblioteca de markdown só
 * para isto.
 */

export type ItemAlteracao = {
  texto: string;
  subitens: string[];
};

export type SeccaoAlteracoes = {
  categoria: string;
  itens: ItemAlteracao[];
};

export type VersaoAlteracoes = {
  versao: string;
  data: string;
  seccoes: SeccaoAlteracoes[];
};

export type Changelog = {
  preambulo: string[];
  versoes: VersaoAlteracoes[];
};

const CABECALHO_VERSAO = /^## \[(.+?)\] — (.+)$/;
const CABECALHO_SECCAO = /^### (.+)$/;
const SUBITEM = /^ {2}- (.+)$/;
const ITEM_TOPO = /^- (.+)$/;
const CONTINUACAO_SUBITEM = /^ {4}(.+)$/;
const CONTINUACAO_TOPO = /^ {2}(.+)$/;

export function analisarChangelog(md: string): Changelog {
  const linhas = md.split(/\r?\n/);
  const preambulo: string[] = [];

  let i = 0;
  while (i < linhas.length && !CABECALHO_VERSAO.test(linhas[i])) {
    const l = linhas[i].trim();
    if (l && l !== "---" && !l.startsWith("# ")) preambulo.push(l);
    i++;
  }

  const versoes: VersaoAlteracoes[] = [];
  let versaoActual: VersaoAlteracoes | null = null;
  let seccaoActual: SeccaoAlteracoes | null = null;
  let itemActual: ItemAlteracao | null = null;
  let subitemAberto = false;

  for (; i < linhas.length; i++) {
    const linha = linhas[i];

    const cabecalhoVersao = CABECALHO_VERSAO.exec(linha);
    if (cabecalhoVersao) {
      versaoActual = { versao: cabecalhoVersao[1], data: cabecalhoVersao[2], seccoes: [] };
      versoes.push(versaoActual);
      seccaoActual = null;
      itemActual = null;
      subitemAberto = false;
      continue;
    }

    const cabecalhoSeccao = CABECALHO_SECCAO.exec(linha);
    if (cabecalhoSeccao && versaoActual) {
      seccaoActual = { categoria: cabecalhoSeccao[1], itens: [] };
      versaoActual.seccoes.push(seccaoActual);
      itemActual = null;
      subitemAberto = false;
      continue;
    }

    if (!seccaoActual) continue;

    const subitem = SUBITEM.exec(linha);
    if (subitem && itemActual) {
      itemActual.subitens.push(subitem[1]);
      subitemAberto = true;
      continue;
    }

    const topo = ITEM_TOPO.exec(linha);
    if (topo) {
      itemActual = { texto: topo[1], subitens: [] };
      seccaoActual.itens.push(itemActual);
      subitemAberto = false;
      continue;
    }

    if (itemActual && subitemAberto) {
      const continuacaoSub = CONTINUACAO_SUBITEM.exec(linha);
      if (continuacaoSub) {
        const ultimo = itemActual.subitens.length - 1;
        itemActual.subitens[ultimo] += ` ${continuacaoSub[1].trim()}`;
        continue;
      }
    }

    if (itemActual) {
      const continuacaoTopo = CONTINUACAO_TOPO.exec(linha);
      if (continuacaoTopo) {
        itemActual.texto += ` ${continuacaoTopo[1].trim()}`;
        continue;
      }
    }
    // Linha em branco ou "---": só separa blocos, não traz conteúdo.
  }

  return { preambulo, versoes };
}
