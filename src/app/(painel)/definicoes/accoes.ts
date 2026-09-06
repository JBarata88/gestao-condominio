"use server";

import { revalidatePath } from "next/cache";
import { clienteServidor } from "@/lib/supabase/servidor";
import {
  carregarFracoes,
  carregarMovimentos,
  carregarQuotasDoAno,
  carregarSaldosIniciais,
  limitesDoAno,
  paraCalculo,
  perfilAtual,
} from "@/lib/dados";
import { saldosApos } from "@/lib/contas";
import { euros } from "@/lib/formatos";

export type Resultado = { ok: boolean; mensagem: string };

/**
 * Todas as acções confirmam o papel de administrador antes de escrever.
 *
 * As políticas de Row Level Security já bloqueiam a escrita de um condómino,
 * mas verificar aqui devolve uma mensagem clara em vez de um erro do Postgres.
 */
async function exigirAdmin() {
  const perfil = await perfilAtual();
  if (!perfil?.admin) {
    throw new Error("Sem permissão para alterar definições.");
  }
}

function texto(dados: FormData, campo: string): string | null {
  const v = dados.get(campo);
  if (typeof v !== "string") return null;
  const limpo = v.trim();
  return limpo === "" ? null : limpo;
}

function numero(dados: FormData, campo: string): number | null {
  const v = texto(dados, campo);
  if (v === null) return null;
  // Aceita tanto "40,00" como "40.00", porque o teclado português usa vírgula.
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Condomínio
// ---------------------------------------------------------------------------
export async function guardarCondominio(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();
    const supabase = await clienteServidor();

    const registo = {
      id: 1 as const,
      nome: texto(dados, "nome") ?? "",
      morada: texto(dados, "morada") ?? "",
      codigo_postal: texto(dados, "codigo_postal") ?? "",
      localidade: texto(dados, "localidade") ?? "",
      nif: texto(dados, "nif") ?? "",
      nib: texto(dados, "nib"),
      iban: texto(dados, "iban"),
      atualizado_em: new Date().toISOString(),
    };

    if (!registo.nome || !registo.morada || !registo.nif) {
      return { ok: false, mensagem: "Nome, morada e contribuinte são obrigatórios." };
    }

    const { error } = await supabase.from("condominio").upsert(registo);
    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/definicoes", "layout");
    return { ok: true, mensagem: "Dados do condomínio guardados." };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Frações e condóminos
// ---------------------------------------------------------------------------
export async function guardarFracao(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();
    const supabase = await clienteServidor();

    const id = texto(dados, "id");
    const letra = texto(dados, "letra");
    const andar = texto(dados, "andar");
    if (!letra || !andar) {
      return { ok: false, mensagem: "A letra da fração e o andar são obrigatórios." };
    }

    const registo = {
      letra,
      andar,
      condomino_nome: texto(dados, "condomino_nome"),
      tratamento:
        texto(dados, "tratamento") === "feminino"
          ? ("feminino" as const)
          : ("masculino" as const),
      email: texto(dados, "email"),
      telefone: texto(dados, "telefone"),
      permilagem: numero(dados, "permilagem"),
      quota_mensal: numero(dados, "quota_mensal") ?? 0,
      ativo: dados.get("ativo") !== null,
      // Marca a fração como sendo da administração: o condómino ligado a ela
      // passa a ter acesso de administrador (ver e_admin() no RLS).
      administracao: dados.get("administracao") !== null,
      ordem: Number(texto(dados, "ordem") ?? "0"),
      atualizado_em: new Date().toISOString(),
    };

    const { error } = id
      ? await supabase.from("fracoes").update(registo).eq("id", id)
      : await supabase.from("fracoes").insert(registo);

    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/definicoes", "layout");
    revalidatePath("/quotas");
    return { ok: true, mensagem: `Fração ${letra} guardada.` };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Fornecedores
// ---------------------------------------------------------------------------
export async function guardarFornecedor(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();
    const supabase = await clienteServidor();

    const id = texto(dados, "id");
    const nome = texto(dados, "nome");
    if (!nome) return { ok: false, mensagem: "O nome do fornecedor é obrigatório." };

    const registo = {
      nome,
      tipo: texto(dados, "tipo"),
      email: texto(dados, "email"),
      telefone: texto(dados, "telefone"),
      iban: texto(dados, "iban"),
      notas: texto(dados, "notas"),
      ativo: true,
      atualizado_em: new Date().toISOString(),
    };

    const { error } = id
      ? await supabase.from("fornecedores").update(registo).eq("id", id)
      : await supabase.from("fornecedores").insert(registo);

    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/definicoes", "layout");
    return { ok: true, mensagem: `Fornecedor ${nome} guardado.` };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

export async function apagarFornecedor(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();
    const id = texto(dados, "id");
    if (!id) return { ok: false, mensagem: "Fornecedor não indicado." };

    const supabase = await clienteServidor();
    const { error } = await supabase.from("fornecedores").delete().eq("id", id);
    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/definicoes", "layout");
    return { ok: true, mensagem: "Fornecedor removido." };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Definições gerais e saldos de abertura
// ---------------------------------------------------------------------------
export async function guardarDefinicoes(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();
    const supabase = await clienteServidor();

    const dia = numero(dados, "dia_limite_quota");
    if (dia === null || !Number.isInteger(dia) || dia < 1 || dia > 31) {
      return {
        ok: false,
        mensagem: "O dia limite tem de ser um número inteiro entre 1 e 31.",
      };
    }

    const ano = numero(dados, "ano_exercicio");
    if (ano === null || !Number.isInteger(ano) || ano < 1900 || ano > 2200) {
      return { ok: false, mensagem: "Ano de exercício inválido." };
    }

    const entradas = [
      { chave: "dia_limite_quota", valor: dia },
      { chave: "ano_exercicio", valor: ano },
      {
        chave: "localidade_recibos",
        valor: texto(dados, "localidade_recibos") ?? "",
      },
      {
        chave: "valor_presenca_assembleia",
        valor: numero(dados, "valor_presenca_assembleia") ?? 0,
      },
    ].map((e) => ({ ...e, atualizado_em: new Date().toISOString() }));

    const { error } = await supabase
      .from("definicoes")
      .upsert(entradas, { onConflict: "chave" });
    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/", "layout");
    return { ok: true, mensagem: "Definições guardadas." };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

export async function guardarSaldosIniciais(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();
    const supabase = await clienteServidor();

    const ano = numero(dados, "ano");
    if (ano === null || !Number.isInteger(ano)) {
      return { ok: false, mensagem: "Ano inválido." };
    }

    const { error } = await supabase.from("saldos_iniciais").upsert({
      ano,
      caixa: numero(dados, "caixa") ?? 0,
      deposito_ordem: numero(dados, "deposito_ordem") ?? 0,
      deposito_prazo: numero(dados, "deposito_prazo") ?? 0,
      conta_poupanca: numero(dados, "conta_poupanca") ?? 0,
      atualizado_em: new Date().toISOString(),
    });
    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/", "layout");
    return { ok: true, mensagem: `Saldos de abertura de ${ano} guardados.` };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Quotas por ano
// ---------------------------------------------------------------------------
/**
 * Grava a quota mensal de cada fração para um ano.
 *
 * O formulário traz um campo `quota-<fracaoId>` por fração. Um campo vazio
 * apaga a linha desse ano, fazendo a fração voltar à quota base
 * (fracoes.quota_mensal).
 */
export async function guardarQuotasDoAno(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();
    const supabase = await clienteServidor();

    const ano = numero(dados, "ano");
    if (ano === null || !Number.isInteger(ano) || ano < 1900 || ano > 2200) {
      return { ok: false, mensagem: "Ano inválido." };
    }

    const aGravar: Array<{
      fracao_id: string;
      ano: number;
      quota_mensal: number;
      atualizado_em: string;
    }> = [];
    const aApagar: string[] = [];

    for (const [chave, valor] of dados.entries()) {
      if (!chave.startsWith("quota-")) continue;
      const fracaoId = chave.slice("quota-".length);
      const bruto = typeof valor === "string" ? valor.trim() : "";
      if (bruto === "") {
        aApagar.push(fracaoId);
        continue;
      }
      const n = Number(bruto.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        return {
          ok: false,
          mensagem: "Há uma quota com um valor inválido. Usa números, com vírgula ou ponto.",
        };
      }
      aGravar.push({
        fracao_id: fracaoId,
        ano,
        quota_mensal: n,
        atualizado_em: new Date().toISOString(),
      });
    }

    if (aGravar.length > 0) {
      const { error } = await supabase
        .from("quotas_fracao")
        .upsert(aGravar, { onConflict: "fracao_id,ano" });
      if (error) return { ok: false, mensagem: error.message };
    }
    if (aApagar.length > 0) {
      const { error } = await supabase
        .from("quotas_fracao")
        .delete()
        .eq("ano", ano)
        .in("fracao_id", aApagar);
      if (error) return { ok: false, mensagem: error.message };
    }

    revalidatePath("/quotas");
    revalidatePath("/");
    revalidatePath("/definicoes", "layout");
    return { ok: true, mensagem: `Quotas de ${ano} guardadas.` };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Abertura de exercício
// ---------------------------------------------------------------------------
/**
 * Abre um exercício novo a partir do fecho do anterior.
 *
 * Calcula os saldos de caixa e banco no fim do ano anterior e usa-os como
 * abertura do novo, transporta as quotas em vigor e passa a definição
 * "ano_exercicio" para o ano novo. Não mexe se o ano novo já tiver saldos de
 * abertura definidos à mão.
 */
export async function abrirExercicio(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();
    const supabase = await clienteServidor();

    const ano = numero(dados, "ano");
    if (ano === null || !Number.isInteger(ano) || ano < 1900 || ano > 2200) {
      return { ok: false, mensagem: "Ano inválido." };
    }
    const anoAnterior = ano - 1;
    const [inicio, fim] = limitesDoAno(anoAnterior);

    const [movimentos, aberturaAnterior, existente, quotasAnteriores, fracoes] =
      await Promise.all([
        carregarMovimentos(inicio, fim),
        carregarSaldosIniciais(anoAnterior),
        supabase.from("saldos_iniciais").select("ano").eq("ano", ano).maybeSingle(),
        carregarQuotasDoAno(anoAnterior),
        carregarFracoes(),
      ]);

    if (existente.data) {
      return {
        ok: false,
        mensagem: `O exercício de ${ano} já tem saldos de abertura. Ajusta-os no formulário abaixo.`,
      };
    }

    const fecho = saldosApos(paraCalculo(movimentos), aberturaAnterior);

    const { error: erroSaldos } = await supabase.from("saldos_iniciais").insert({
      ano,
      caixa: fecho.caixa,
      deposito_ordem: fecho.depositoOrdem,
      deposito_prazo: fecho.depositoPrazo,
      conta_poupanca: fecho.contaPoupanca,
      atualizado_em: new Date().toISOString(),
    });
    if (erroSaldos) return { ok: false, mensagem: erroSaldos.message };

    const quotasNovas = fracoes
      .filter((f) => f.ativo)
      .map((f) => ({
        fracao_id: f.id,
        ano,
        quota_mensal: quotasAnteriores.get(f.id) ?? Number(f.quota_mensal),
        atualizado_em: new Date().toISOString(),
      }))
      .filter((q) => q.quota_mensal > 0);
    if (quotasNovas.length > 0) {
      await supabase
        .from("quotas_fracao")
        .upsert(quotasNovas, { onConflict: "fracao_id,ano", ignoreDuplicates: true });
    }

    await supabase.from("definicoes").upsert(
      { chave: "ano_exercicio", valor: ano, atualizado_em: new Date().toISOString() },
      { onConflict: "chave" },
    );

    revalidatePath("/", "layout");
    return {
      ok: true,
      mensagem: `Exercício de ${ano} aberto. Abertura transportada: caixa ${euros(fecho.caixa)}, banco ${euros(fecho.depositoOrdem)}.`,
    };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}
