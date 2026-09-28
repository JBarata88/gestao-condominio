/**
 * Os guias de utilização em PDF.
 *
 * Os PDFs são gerados por scripts/guias/ e guardados num bucket privado do
 * Supabase Storage, não no repositório: as capturas de ecrã mostram valores
 * reais das contas e o repositório é público. A rota /api/guias/[guia] só os
 * serve a quem tem sessão iniciada.
 */

export const BUCKET_GUIAS = "guias";

export type Guia = {
  id: "utilizador" | "administrador";
  titulo: string;
  descricao: string;
  /** Nome do ficheiro no bucket. */
  ficheiro: string;
  /** Nome sugerido ao descarregar. */
  nomeDescarga: string;
  /** Só a administração vê e descarrega este guia. */
  soAdmin: boolean;
};

export const GUIAS: readonly Guia[] = [
  {
    id: "utilizador",
    titulo: "Guia do Utilizador",
    descricao:
      "Como consultar as contas do condomínio, passo a passo: Painel, Movimentos, Quotas, Relatórios e atas, e o que quer dizer cada valor.",
    ficheiro: "guia-do-utilizador.pdf",
    nomeDescarga: "Guia do Utilizador.pdf",
    soAdmin: false,
  },
  {
    id: "administrador",
    titulo: "Guia do Administrador",
    descricao:
      "Configurar o condomínio, importar extratos, lançar movimentos, gerar recibos, preparar assembleias e fechar o ano.",
    ficheiro: "guia-do-administrador.pdf",
    nomeDescarga: "Guia do Administrador.pdf",
    soAdmin: true,
  },
];

/** Os guias que um utilizador pode ver, conforme tenha ou não acesso de administrador. */
export function guiasVisiveis(admin: boolean): Guia[] {
  return GUIAS.filter((g) => admin || !g.soAdmin);
}
