/**
 * Uma linha sozinha com este texto, no comentário de um tópico da acta, é
 * substituída pela tabela de apólices e recibos das frações.
 *
 * Fica num módulo à parte, sem a biblioteca docx, para o editor da acta (que
 * corre no browser) o poder importar.
 */
export const MARCADOR_SEGUROS = "[tabela de apólices e recibos]";

export function eMarcadorSeguros(linha: string): boolean {
  return linha.trim().toLowerCase() === MARCADOR_SEGUROS;
}

export function temTabelaSeguros(comentario: string): boolean {
  return comentario.split(/\r?\n/).some(eMarcadorSeguros);
}
