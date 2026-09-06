"use server";

import { revalidatePath } from "next/cache";
import { perfilAtual } from "@/lib/dados";
import { clienteServidor } from "@/lib/supabase/servidor";
import { arredondar } from "@/lib/formatos";
import type { TipoConta } from "@/lib/tipos-bd";

export type Resultado = { ok: boolean; mensagem: string };

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

async function exigirAdmin() {
  const perfil = await perfilAtual();
  if (!perfil?.admin) {
    throw new Error("Só a administração pode lançar movimentos.");
  }
  return perfil;
}

function texto(dados: FormData, campo: string): string | null {
  const v = dados.get(campo);
  if (typeof v !== "string") return null;
  const limpo = v.trim();
  return limpo === "" ? null : limpo;
}

/**
 * Lê um valor monetário escrito à portuguesa ou à inglesa.
 * Aceita "40", "40,50" e "40.50".
 */
function valorMonetario(bruto: string | null): number | null {
  if (!bruto) return null;
  const n = Number(bruto.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return arredondar(n);
}

const MES_ISO = /^\d{4}-\d{2}$/;

/**
 * Lê o mês, ou intervalo de meses, de um pagamento de quota.
 *
 * É só uma anotação: não influencia a matriz de Quotas, que soma o total
 * pago pela fração e distribui pelos meses sozinha. Serve para deixar
 * escrito, no próprio movimento, a que meses uma transferência respeitava.
 */
function lerIntervaloQuota(
  dados: FormData,
  fracaoId: string | null,
): { ok: true; quotaMes: string | null; quotaMesFim: string | null } | { ok: false; mensagem: string } {
  const quotaMes = texto(dados, "quota_mes");
  const quotaMesFim = texto(dados, "quota_mes_fim");

  if (!quotaMes) {
    if (quotaMesFim) {
      return { ok: false, mensagem: "Escolheste um fim de intervalo sem escolher o início." };
    }
    return { ok: true, quotaMes: null, quotaMesFim: null };
  }

  if (!MES_ISO.test(quotaMes)) {
    return { ok: false, mensagem: "Mês de quota inválido." };
  }
  if (!fracaoId) {
    return {
      ok: false,
      mensagem: "Escolheste um mês de quota mas não indicaste a fração.",
    };
  }
  if (quotaMesFim) {
    if (!MES_ISO.test(quotaMesFim)) {
      return { ok: false, mensagem: "Mês final do intervalo inválido." };
    }
    if (quotaMesFim < quotaMes) {
      return {
        ok: false,
        mensagem: "O fim do intervalo não pode vir antes do início.",
      };
    }
  }

  return {
    ok: true,
    quotaMes: `${quotaMes}-01`,
    quotaMesFim: quotaMesFim && quotaMesFim !== quotaMes ? `${quotaMesFim}-01` : null,
  };
}

/** Lança um movimento à mão, para o que não vem de um extrato bancário. */
export async function adicionarMovimento(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    const perfil = await exigirAdmin();

    const conta = texto(dados, "conta");
    if (conta !== "caixa" && conta !== "banco") {
      return { ok: false, mensagem: "Conta inválida." };
    }

    const data = texto(dados, "data");
    if (!data || !DATA_ISO.test(data)) {
      return { ok: false, mensagem: "Indica uma data válida." };
    }

    const categoriaId = texto(dados, "categoria_id");
    if (!categoriaId) {
      return { ok: false, mensagem: "Escolhe uma categoria." };
    }

    const sentido = texto(dados, "sentido");
    if (sentido !== "receita" && sentido !== "despesa") {
      return { ok: false, mensagem: "Indica se é receita ou despesa." };
    }

    const valor = valorMonetario(texto(dados, "valor"));
    if (valor === null || valor <= 0) {
      return { ok: false, mensagem: "O valor tem de ser maior do que zero." };
    }

    const fracaoId = texto(dados, "fracao_id");
    const intervalo = lerIntervaloQuota(dados, fracaoId);
    if (!intervalo.ok) return { ok: false, mensagem: intervalo.mensagem };

    const supabase = await clienteServidor();
    const { error } = await supabase.from("movimentos").insert({
      data,
      categoria_id: categoriaId,
      descricao: texto(dados, "descricao"),
      conta: conta as TipoConta,
      receita: sentido === "receita" ? valor : 0,
      despesa: sentido === "despesa" ? valor : 0,
      fracao_id: fracaoId,
      quota_mes: intervalo.quotaMes,
      quota_mes_fim: intervalo.quotaMesFim,
      criado_por: perfil.id,
    });

    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/movimentos");
    revalidatePath("/quotas");
    revalidatePath("/");

    return {
      ok: true,
      mensagem: `Lançado ${sentido === "receita" ? "+" : "−"}${valor.toFixed(2).replace(".", ",")} € em ${conta}.`,
    };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

/**
 * Edita um movimento já existente.
 *
 * Ao contrário de apagarMovimento, isto funciona mesmo em movimentos vindos
 * de um extrato bancário: editar não desliga a linha do extrato, só corrige
 * os seus campos, o que é exactamente o que é preciso quando o reconhecimento
 * automático da importação não encontrou o mês de uma quota, ou encontrou a
 * categoria errada. A conta (banco ou caixa) não é editável, porque é o
 * extrato que determina em que conta um movimento bancário existe.
 */
export async function editarMovimento(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();

    const id = texto(dados, "id");
    if (!id) return { ok: false, mensagem: "Movimento não indicado." };

    const data = texto(dados, "data");
    if (!data || !DATA_ISO.test(data)) {
      return { ok: false, mensagem: "Indica uma data válida." };
    }

    const categoriaId = texto(dados, "categoria_id");
    if (!categoriaId) {
      return { ok: false, mensagem: "Escolhe uma categoria." };
    }

    const sentido = texto(dados, "sentido");
    if (sentido !== "receita" && sentido !== "despesa") {
      return { ok: false, mensagem: "Indica se é receita ou despesa." };
    }

    const valor = valorMonetario(texto(dados, "valor"));
    if (valor === null || valor <= 0) {
      return { ok: false, mensagem: "O valor tem de ser maior do que zero." };
    }

    const fracaoId = texto(dados, "fracao_id");
    const intervalo = lerIntervaloQuota(dados, fracaoId);
    if (!intervalo.ok) return { ok: false, mensagem: intervalo.mensagem };

    const supabase = await clienteServidor();
    const { error } = await supabase
      .from("movimentos")
      .update({
        data,
        categoria_id: categoriaId,
        descricao: texto(dados, "descricao"),
        receita: sentido === "receita" ? valor : 0,
        despesa: sentido === "despesa" ? valor : 0,
        fracao_id: fracaoId,
        quota_mes: intervalo.quotaMes,
        quota_mes_fim: intervalo.quotaMesFim,
      })
      .eq("id", id);

    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/movimentos");
    revalidatePath("/quotas");
    revalidatePath("/");

    return { ok: true, mensagem: "Movimento actualizado." };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

/**
 * Apaga um movimento lançado à mão.
 *
 * Só apaga movimentos sem ligação a uma linha de extrato. Apagar um movimento
 * importado deixaria a linha do extrato órfã, e uma reimportação do mesmo
 * ficheiro continuaria a considerá-la já importada, o que daria a impressão
 * de que o movimento tinha desaparecido sem explicação.
 */
export async function apagarMovimento(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();

    const id = texto(dados, "id");
    if (!id) return { ok: false, mensagem: "Movimento não indicado." };

    const supabase = await clienteServidor();

    const { data: movimento, error: erroLeitura } = await supabase
      .from("movimentos")
      .select("id, extrato_linha_id")
      .eq("id", id)
      .maybeSingle();

    if (erroLeitura) return { ok: false, mensagem: erroLeitura.message };
    if (!movimento) return { ok: false, mensagem: "Movimento não encontrado." };

    if (movimento.extrato_linha_id) {
      return {
        ok: false,
        mensagem:
          "Este movimento veio de um extrato bancário e não pode ser apagado aqui. Apaga a importação inteira em Extratos.",
      };
    }

    const { error } = await supabase.from("movimentos").delete().eq("id", id);
    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/movimentos");
    revalidatePath("/quotas");
    revalidatePath("/");

    return { ok: true, mensagem: "Movimento apagado." };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}
