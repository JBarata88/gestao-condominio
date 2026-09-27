import { NextResponse, type NextRequest } from "next/server";
import { carregarActa, carregarCondominio, carregarFracoes, perfilAtual } from "@/lib/dados";
import { gerarConvocatorias } from "@/lib/relatorios/convocatoria";

export const runtime = "nodejs";

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Mais uma semana, como na convocatória original (12 → 19 de janeiro). */
function semanaDepois(dataIso: string): string {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Convocatórias da assembleia em Word, uma por fração ativa, com a ordem de
 * trabalhos definida na assembleia. Só administração.
 */
export async function GET(
  pedido: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perfil = await perfilAtual();
  if (!perfil?.admin) {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  const { id } = await params;
  const [completa, condominio, fracoes] = await Promise.all([
    carregarActa(id),
    carregarCondominio(),
    carregarFracoes(),
  ]);
  if (!completa) {
    return NextResponse.json({ erro: "Assembleia não encontrada." }, { status: 404 });
  }
  if (!condominio) {
    return NextResponse.json(
      { erro: "Falta preencher os dados do condomínio em Definições." },
      { status: 400 },
    );
  }
  if (completa.topicos.length === 0) {
    return NextResponse.json(
      { erro: "Define primeiro a ordem de trabalhos e guarda a assembleia." },
      { status: 400 },
    );
  }

  const { acta, topicos } = completa;
  const q = pedido.nextUrl.searchParams;
  const dataSegunda = DATA_ISO.test(q.get("segunda") ?? "") ? q.get("segunda")! : semanaDepois(acta.data);
  const horaSegunda = q.get("horaSegunda")?.trim() || acta.hora_inicio;
  const sala = q.get("sala")?.trim() || "na sala de reuniões dos condóminos, no 5.º piso";

  try {
    const ficheiro = await gerarConvocatorias({
      data: acta.data,
      hora: acta.hora_inicio,
      dataSegunda,
      horaSegunda,
      sala,
      morada: condominio.morada,
      codigoPostal: condominio.codigo_postal,
      localidade: condominio.localidade,
      topicos: topicos.map((t) => t.titulo),
      destinatarios: fracoes
        .filter((f) => f.ativo)
        .map((f) => ({
          nome: f.condomino_nome ?? "",
          letra: f.letra,
          tratamento: f.tratamento,
        })),
    });

    return new NextResponse(new Uint8Array(ficheiro), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Convocatorias_${acta.data}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 });
  }
}
