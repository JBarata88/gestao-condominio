import type { AdministradorAno } from "@/lib/dados";

/**
 * Quem geria o condomínio num dado ano — puramente informativo (ver
 * administradores_condominio). Não aparece nada quando ainda não foi
 * definido, em vez de forçar uma frase vazia.
 */
export default function AdministracaoCondominio({
  administradores,
  ano,
}: {
  administradores: AdministradorAno[];
  ano: number;
}) {
  if (administradores.length === 0) return null;

  return (
    <p className="text-sm text-pergaminho-600 print:text-xs">
      Administração de {ano}:{" "}
      {administradores
        .map(
          (a) =>
            `${a.letra} · ${a.andar}${a.condominoNome ? ` — ${a.condominoNome}` : ""}`,
        )
        .join("; ")}
    </p>
  );
}
