import { NextResponse, type NextRequest } from "next/server";
import { carregarActa, perfilAtual } from "@/lib/dados";
import { gerarActa } from "@/lib/relatorios/acta";

export const runtime = "nodejs";

/**
 * Documento Word de uma acta. Qualquer condómino com sessão pode pedir, mas a
 * RLS só lhe devolve actas publicadas: um rascunho dá 404, como se não
 * existisse.
 */
export async function GET(
  _pedido: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perfil = await perfilAtual();
  if (!perfil) {
    return NextResponse.json({ erro: "Sessão necessária." }, { status: 401 });
  }

  const { id } = await params;
  const completa = await carregarActa(id);
  if (!completa) {
    return NextResponse.json({ erro: "Ata não encontrada." }, { status: 404 });
  }

  const { acta, topicos, presencas, seguros } = completa;

  try {
    const ficheiro = await gerarActa({
      numero: acta.numero,
      data: acta.data,
      horaInicio: acta.hora_inicio,
      horaFim: acta.hora_fim,
      local: acta.local,
      topicos: topicos.map((t) => ({
        titulo: t.titulo,
        decisao: t.decisao,
        comentario: t.comentario,
      })),
      presencas: presencas.map((p) => ({
        andar: p.andar,
        letra: p.letra,
        nome: p.condomino_nome,
        forma: p.forma,
        permilagem: p.permilagem,
      })),
      seguros: seguros.map((s) => ({
        andar: s.andar,
        letra: s.letra,
        nome: s.condomino_nome,
        apolice: s.apolice,
        recibo: s.recibo,
      })),
    });

    const nome = `Ata_n${acta.numero}_${acta.data.slice(0, 4)}.docx`;

    return new NextResponse(new Uint8Array(ficheiro), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
