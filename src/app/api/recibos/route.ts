import { NextResponse, type NextRequest } from "next/server";
import {
  carregarCondominio,
  carregarFracoes,
  definicao,
  perfilAtual,
} from "@/lib/dados";
import { clienteServidor } from "@/lib/supabase/servidor";
import { arredondar, mesesDoIntervalo } from "@/lib/formatos";
import { gerarRecibos, type PedidoRecibo } from "@/lib/relatorios/recibos";
import type { CabecalhoCondominio } from "@/lib/relatorios/moaf";

export const runtime = "nodejs";

type Corpo = {
  tipo: "quota" | "presenca" | "pagamento";
  fracoes?: string[];
  /** Movimentos escolhidos, para o tipo "quota". */
  movimentoIds?: string[];
  ano?: number;
  data?: string;
  valor?: number;
  dataAssembleia?: string;
  destinatario?: string;
  servico?: string;
  periodo?: string;
};

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(pedido: NextRequest) {
  const perfil = await perfilAtual();
  if (perfil?.papel !== "admin") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  let corpo: Corpo;
  try {
    corpo = await pedido.json();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const condominio = await carregarCondominio();
  if (!condominio) {
    return NextResponse.json(
      { erro: "Falta preencher os dados do condomínio em Definições." },
      { status: 400 },
    );
  }

  const cabecalho: CabecalhoCondominio = {
    nome: condominio.nome,
    morada: condominio.morada,
    codigoPostal: condominio.codigo_postal,
    localidade: condominio.localidade,
    nif: condominio.nif,
  };

  const localidade = await definicao<string>(
    "localidade_recibos",
    "Póvoa de Santa Iria",
  );
  const assinatura = await definicao<string>(
    "assinatura_recibos",
    "A administração",
  );

  const dataEmissaoOmissao = DATA_ISO.test(corpo.data ?? "")
    ? corpo.data!
    : new Date().toISOString().slice(0, 10);

  let pedidos: PedidoRecibo[] = [];
  /** Movimentos cujo recibo vamos registar na tabela "recibos" no fim. */
  let movimentosParaRegistar: Array<{
    movimentoId: string;
    fracaoId: string;
    destinatario: string;
    valor: number;
    dataEmissao: string;
    periodoTexto: string | null;
  }> = [];

  if (corpo.tipo === "pagamento") {
    if (!corpo.destinatario || !corpo.servico || !corpo.valor) {
      return NextResponse.json(
        { erro: "Destinatário, serviço e valor são obrigatórios." },
        { status: 400 },
      );
    }
    pedidos = [
      {
        tipo: "pagamento",
        destinatario: corpo.destinatario,
        valor: corpo.valor,
        servico: corpo.servico,
        periodo: corpo.periodo ?? "",
        data: dataEmissaoOmissao,
      },
    ];
  } else if (corpo.tipo === "quota") {
    // O recibo de quota usa o valor e a data do próprio pagamento, tal como
    // está lançado em Movimentos: não se recalcula quota mensal vezes número
    // de meses, porque isso pode não bater com o que foi realmente pago.
    const movimentoIds = (corpo.movimentoIds ?? []).filter(
      (id) => typeof id === "string" && id.length > 0,
    );
    if (movimentoIds.length === 0) {
      return NextResponse.json(
        { erro: "Escolhe pelo menos um pagamento." },
        { status: 400 },
      );
    }

    const supabase = await clienteServidor();
    const { data: movimentos, error: erroMovimentos } = await supabase
      .from("movimentos")
      .select(
        "id, data, receita, quota_mes, quota_mes_fim, fracao_id, " +
          "categorias!inner(nome), fracoes(letra, andar, condomino_nome, tratamento)",
      )
      .eq("categorias.nome", "Quotizações")
      .in("id", movimentoIds);

    if (erroMovimentos) {
      return NextResponse.json({ erro: erroMovimentos.message }, { status: 500 });
    }

    type MovimentoCarregado = {
      id: string;
      data: string;
      receita: number;
      quota_mes: string | null;
      quota_mes_fim: string | null;
      fracao_id: string | null;
      fracoes: {
        letra: string;
        andar: string;
        condomino_nome: string | null;
        tratamento: "masculino" | "feminino";
      } | null;
    };

    const validos = ((movimentos ?? []) as unknown as MovimentoCarregado[]).filter(
      (m) => m.fracao_id && m.fracoes?.condomino_nome && Number(m.receita) > 0,
    );

    if (validos.length === 0) {
      return NextResponse.json(
        {
          erro:
            "Nenhum dos pagamentos escolhidos tem fração com condómino preenchido.",
        },
        { status: 400 },
      );
    }

    pedidos = validos.map((m) => {
      const valor = arredondar(Number(m.receita));
      const ano = Number((m.quota_mes ?? m.data).slice(0, 4));
      const meses = m.quota_mes
        ? mesesDoIntervalo(m.quota_mes, m.quota_mes_fim)
        : [Number(m.data.slice(5, 7))];

      return {
        tipo: "quota" as const,
        condomino: {
          nome: m.fracoes!.condomino_nome!,
          letra: m.fracoes!.letra,
          andar: m.fracoes!.andar,
          tratamento: m.fracoes!.tratamento,
        },
        valor,
        meses,
        ano,
        // A data impressa no recibo é a data real do pagamento, não uma data
        // de emissão escolhida à parte.
        data: m.data,
      };
    });

    movimentosParaRegistar = validos.map((m) => ({
      movimentoId: m.id,
      fracaoId: m.fracao_id!,
      destinatario: m.fracoes!.condomino_nome!,
      valor: arredondar(Number(m.receita)),
      dataEmissao: m.data,
      periodoTexto: m.quota_mes
        ? `${m.quota_mes.slice(0, 7)}` +
          (m.quota_mes_fim ? ` a ${m.quota_mes_fim.slice(0, 7)}` : "")
        : null,
    }));
  } else {
    const fracoes = await carregarFracoes();
    const escolhidas = fracoes.filter(
      (f) => corpo.fracoes?.includes(f.id) && f.condomino_nome,
    );

    if (escolhidas.length === 0) {
      return NextResponse.json(
        {
          erro:
            "Selecciona pelo menos uma fração com o nome do condómino preenchido.",
        },
        { status: 400 },
      );
    }

    if (!DATA_ISO.test(corpo.dataAssembleia ?? "")) {
      return NextResponse.json(
        { erro: "Indica a data da assembleia." },
        { status: 400 },
      );
    }
    const valor =
      corpo.valor ?? (await definicao<number>("valor_presenca_assembleia", 5));

    pedidos = escolhidas.map((f) => ({
      tipo: "presenca" as const,
      condomino: {
        nome: f.condomino_nome!,
        letra: f.letra,
        andar: f.andar,
        tratamento: f.tratamento,
      },
      valor,
      dataAssembleia: corpo.dataAssembleia!,
      data: dataEmissaoOmissao,
    }));
  }

  try {
    const ficheiro = await gerarRecibos({
      pedidos,
      condominio: cabecalho,
      localidade,
      assinatura,
    });

    if (movimentosParaRegistar.length > 0) {
      const supabase = await clienteServidor();
      // Um recibo por movimento, identificado por ele, para saber depois
      // quais os pagamentos que já têm recibo emitido. Gerar de novo o
      // recibo do mesmo pagamento actualiza o registo em vez de duplicar.
      await supabase.from("recibos").upsert(
        movimentosParaRegistar.map((m) => ({
          numero: `Q-${m.movimentoId}`,
          tipo: "quota" as const,
          fracao_id: m.fracaoId,
          destinatario: m.destinatario,
          valor: m.valor,
          data_emissao: m.dataEmissao,
          periodo_texto: m.periodoTexto,
          movimento_id: m.movimentoId,
          criado_por: perfil.id,
        })),
        { onConflict: "numero" },
      );
    }

    const nome = `RECIBOS_${corpo.tipo.toUpperCase()}_${dataEmissaoOmissao}.docx`;

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
