import { NextResponse, type NextRequest } from "next/server";
import { carregarFracoes, perfilAtual } from "@/lib/dados";
import { gerarFolhaPresencas } from "@/lib/relatorios/acta";

export const runtime = "nodejs";

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Folha de presenças em Word, com todas as frações ativas. Só administração. */
export async function GET(pedido: NextRequest) {
  const perfil = await perfilAtual();
  if (!perfil?.admin) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const pedida = pedido.nextUrl.searchParams.get("data") ?? "";
  const data = DATA_ISO.test(pedida) ? pedida : new Date().toISOString().slice(0, 10);

  const fracoes = (await carregarFracoes()).filter((f) => f.ativo);

  try {
    const ficheiro = await gerarFolhaPresencas({
      data,
      fracoes: fracoes.map((f) => ({
        andar: f.andar,
        letra: f.letra,
        nome: f.condomino_nome ?? "",
        permilagem: f.permilagem === null ? null : Number(f.permilagem),
      })),
    });

    return new NextResponse(new Uint8Array(ficheiro), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Folha_presencas_${data}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
