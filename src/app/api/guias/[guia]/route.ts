import { NextResponse, type NextRequest } from "next/server";
import { perfilAtual } from "@/lib/dados";
import { BUCKET_GUIAS, guiasVisiveis } from "@/lib/guias";
import { clienteAdministrativo } from "@/lib/supabase/servidor";

export const runtime = "nodejs";

/**
 * Um guia de utilização em PDF, lido do bucket privado.
 *
 * Por omissão abre no visualizador de PDF do browser; com ?descarregar=1 é
 * gravado como ficheiro. O bucket não tem políticas de acesso: só o servidor,
 * com a chave de serviço, lá chega, e é aqui que se decide quem pode ler o
 * quê. Um condómino que peça o guia do administrador recebe 404, como se não
 * existisse.
 */
export async function GET(
  pedido: NextRequest,
  { params }: { params: Promise<{ guia: string }> },
) {
  const perfil = await perfilAtual();
  if (!perfil) {
    return NextResponse.json({ erro: "Sessão necessária." }, { status: 401 });
  }

  const { guia: id } = await params;
  const guia = guiasVisiveis(perfil.admin).find((g) => g.id === id);
  if (!guia) {
    return NextResponse.json({ erro: "Guia não encontrado." }, { status: 404 });
  }

  const { data, error } = await clienteAdministrativo()
    .storage.from(BUCKET_GUIAS)
    .download(guia.ficheiro);
  if (error || !data) {
    return NextResponse.json(
      { erro: "Este guia ainda não foi publicado." },
      { status: 404 },
    );
  }

  const descarregar = pedido.nextUrl.searchParams.has("descarregar");
  return new NextResponse(new Uint8Array(await data.arrayBuffer()), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${descarregar ? "attachment" : "inline"}; filename="${guia.nomeDescarga}"`,
      // Privado: nunca guardado em caches partilhadas, só no browser de quem pediu.
      "Cache-Control": "private, max-age=300",
    },
  });
}
