"use server";

import { revalidatePath } from "next/cache";
import { clienteServidor } from "@/lib/supabase/servidor";
import {
  carregarFracoes,
  carregarMovimentos,
  carregarQuotasDoAno,
  carregarSaldosIniciais,
  definicao,
  limitesDoAno,
  paraCalculo,
  perfilAtual,
  temSaldosIniciais,
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

    // A quota mensal não se edita aqui: define-se em Definições > Quotas do
    // ano, por ano de exercício.
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
      ativo: dados.get("ativo") !== null,
      ordem: Number(texto(dados, "ordem") ?? "0"),
      atualizado_em: new Date().toISOString(),
    };

    let fracaoId = id;
    if (id) {
      const { error } = await supabase.from("fracoes").update(registo).eq("id", id);
      if (error) return { ok: false, mensagem: error.message };
    } else {
      const { data: nova, error } = await supabase
        .from("fracoes")
        .insert(registo)
        .select("id")
        .single();
      if (error || !nova) {
        return { ok: false, mensagem: error?.message ?? "Não foi possível criar a fração." };
      }
      fracaoId = nova.id;
    }

    // Administração do condomínio nesse ano — puramente informativa (ver
    // administradores_condominio), não concede acesso nenhum.
    const ano = numero(dados, "ano");
    if (ano !== null && fracaoId) {
      const administrador = dados.get("administracao") !== null;
      const { error: erroAdmin } = administrador
        ? await supabase
            .from("administradores_condominio")
            .upsert({ fracao_id: fracaoId, ano }, { onConflict: "fracao_id,ano" })
        : await supabase
            .from("administradores_condominio")
            .delete()
            .eq("fracao_id", fracaoId)
            .eq("ano", ano);
      if (erroAdmin) return { ok: false, mensagem: erroAdmin.message };
    }

    revalidatePath("/definicoes", "layout");
    revalidatePath("/");
    revalidatePath("/quotas");
    revalidatePath("/relatorios");
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
// Definições gerais
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

    const entradas = [
      { chave: "dia_limite_quota", valor: dia },
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
// Orçamento aprovado em assembleia
// ---------------------------------------------------------------------------
/**
 * Grava o orçamento de um ano: um valor por categoria (campo `categoria-<id>`
 * por cada uma) mais as disponibilidades previstas no fim do ano. Um campo de
 * categoria em branco apaga a linha, o que conta como "não orçamentado" (zero
 * na comparação), tal como em guardarQuotasDoAno.
 */
export async function guardarOrcamentoDoAno(
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
      categoria_id: string;
      ano: number;
      valor: number;
      atualizado_em: string;
    }> = [];
    const aApagar: string[] = [];

    for (const [chave, valor] of dados.entries()) {
      if (!chave.startsWith("categoria-")) continue;
      const categoriaId = chave.slice("categoria-".length);
      const bruto = typeof valor === "string" ? valor.trim() : "";
      if (bruto === "") {
        aApagar.push(categoriaId);
        continue;
      }
      const n = Number(bruto.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        return {
          ok: false,
          mensagem: "Há um valor de orçamento inválido. Usa números, com vírgula ou ponto.",
        };
      }
      aGravar.push({
        categoria_id: categoriaId,
        ano,
        valor: n,
        atualizado_em: new Date().toISOString(),
      });
    }

    if (aGravar.length > 0) {
      const { error } = await supabase
        .from("orcamento_categorias")
        .upsert(aGravar, { onConflict: "categoria_id,ano" });
      if (error) return { ok: false, mensagem: error.message };
    }
    if (aApagar.length > 0) {
      const { error } = await supabase
        .from("orcamento_categorias")
        .delete()
        .eq("ano", ano)
        .in("categoria_id", aApagar);
      if (error) return { ok: false, mensagem: error.message };
    }

    const { error: erroDisponibilidades } = await supabase
      .from("orcamento_disponibilidades")
      .upsert(
        {
          ano,
          caixa: numero(dados, "disp_caixa") ?? 0,
          deposito_ordem: numero(dados, "disp_deposito_ordem") ?? 0,
          deposito_prazo: numero(dados, "disp_deposito_prazo") ?? 0,
          conta_poupanca: numero(dados, "disp_conta_poupanca") ?? 0,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "ano" },
      );
    if (erroDisponibilidades) {
      return { ok: false, mensagem: erroDisponibilidades.message };
    }

    revalidatePath("/relatorios");
    revalidatePath("/definicoes", "layout");
    return { ok: true, mensagem: `Orçamento de ${ano} guardado.` };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Reforços extraordinários
// ---------------------------------------------------------------------------
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Cria um reforço extraordinário — um valor único por fração, com prazo
 * próprio, ao contrário da quota mensal. Pode haver vários no mesmo ano.
 *
 * Associa automaticamente os movimentos já lançados nessa categoria e nesse
 * ano que ainda não pertencem a nenhum reforço, para o caso de os pagamentos
 * já terem sido lançados antes de o reforço ficar formalmente criado — foi o
 * que aconteceu com o reforço de obras de 2025.
 */
export async function criarReforco(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    const perfil = await perfilAtual();
    if (!perfil?.admin) {
      return { ok: false, mensagem: "Sem permissão para alterar definições." };
    }
    const supabase = await clienteServidor();

    const ano = numero(dados, "ano");
    if (ano === null || !Number.isInteger(ano) || ano < 1900 || ano > 2200) {
      return { ok: false, mensagem: "Ano inválido." };
    }

    const descricao = texto(dados, "descricao");
    if (!descricao) {
      return { ok: false, mensagem: "Indica uma descrição para o reforço." };
    }

    const valorFracao = numero(dados, "valor_fracao");
    if (valorFracao === null || valorFracao <= 0) {
      return { ok: false, mensagem: "O valor por fração tem de ser maior do que zero." };
    }

    const dataLimite = texto(dados, "data_limite");
    if (!dataLimite || !DATA_ISO.test(dataLimite)) {
      return { ok: false, mensagem: "Indica uma data limite válida." };
    }

    const categoriaId = texto(dados, "categoria_id");
    if (!categoriaId) {
      return { ok: false, mensagem: "Escolhe a categoria de receita do reforço." };
    }
    const { data: categoria } = await supabase
      .from("categorias")
      .select("natureza")
      .eq("id", categoriaId)
      .maybeSingle();
    if (!categoria || categoria.natureza !== "receita") {
      return { ok: false, mensagem: "A categoria do reforço tem de ser uma categoria de receita." };
    }

    const { data: novo, error } = await supabase
      .from("reforcos")
      .insert({
        ano,
        descricao,
        valor_fracao: valorFracao,
        data_limite: dataLimite,
        categoria_id: categoriaId,
        criado_por: perfil.id,
      })
      .select("id")
      .single();
    if (error || !novo) {
      return { ok: false, mensagem: error?.message ?? "Não foi possível criar o reforço." };
    }

    // Pagamentos já lançados nesta categoria e neste ano, para uma fração,
    // que ainda não pertenciam a nenhum reforço. Isto é o que liga os
    // movimentos de 2025 (lançados antes de este conceito existir) ao
    // reforço assim que ele é criado.
    const [inicio, fim] = limitesDoAno(ano);
    const { data: ligados } = await supabase
      .from("movimentos")
      .update({ reforco_id: novo.id })
      .eq("categoria_id", categoriaId)
      .is("reforco_id", null)
      .not("fracao_id", "is", null)
      .gte("data", inicio)
      .lte("data", fim)
      .select("id");

    revalidatePath("/quotas");
    revalidatePath("/definicoes/quotas");
    revalidatePath("/");

    const quantos = ligados?.length ?? 0;
    return {
      ok: true,
      mensagem:
        quantos > 0
          ? `Reforço "${descricao}" criado. ${quantos} pagamento(s) já lançado(s) foram associados automaticamente.`
          : `Reforço "${descricao}" criado.`,
    };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

/**
 * Elimina um reforço. Os movimentos que lhe estavam ligados não são apagados,
 * só deixam de apontar para ele (reforco_id volta a NULL): o dinheiro
 * continua lançado na sua categoria, só a etiqueta do reforço desaparece.
 */
export async function eliminarReforco(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();
    const supabase = await clienteServidor();

    const id = texto(dados, "id");
    if (!id) return { ok: false, mensagem: "Reforço não indicado." };

    const { error } = await supabase.from("reforcos").delete().eq("id", id);
    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/quotas");
    revalidatePath("/definicoes/quotas");
    revalidatePath("/");
    return { ok: true, mensagem: "Reforço eliminado." };
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
 * abertura do novo, e transporta as quotas em vigor. Não mexe se o ano novo
 * já tiver saldos de abertura definidos à mão.
 *
 * Não activa o exercício sozinho — fica com a etiqueta "futuro" na tabela até
 * alguém escolher "Tornar activo", para se poder preparar o ano seguinte com
 * antecedência sem trocar o que toda a gente vê por omissão.
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
        mensagem: `O exercício de ${ano} já tem saldos de abertura.`,
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

    revalidatePath("/", "layout");
    return {
      ok: true,
      mensagem: `Exercício de ${ano} aberto. Abertura transportada: caixa ${euros(fecho.caixa)}, banco ${euros(fecho.depositoOrdem)}. Continua "futuro" até seres tu a tornar activo.`,
    };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

/**
 * Torna um exercício já aberto no exercício activo — a definição
 * "ano_exercicio" que todos vêem por omissão.
 *
 * Recusa se o ano ainda não tiver saldos de abertura: primeiro abre-se o
 * exercício (transporta o fecho do ano anterior), só depois é que faz
 * sentido torná-lo o que toda a gente vê.
 */
export async function definirExercicioActivo(
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

    if (!(await temSaldosIniciais(ano))) {
      return {
        ok: false,
        mensagem: `${ano} ainda não tem saldos de abertura. Abre o exercício primeiro.`,
      };
    }

    const { error } = await supabase.from("definicoes").upsert(
      { chave: "ano_exercicio", valor: ano, atualizado_em: new Date().toISOString() },
      { onConflict: "chave" },
    );
    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/", "layout");
    return { ok: true, mensagem: `${ano} passou a ser o exercício activo.` };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

/**
 * Elimina um exercício: apaga os saldos de abertura e as quotas desse ano.
 *
 * Recusa se o ano tiver movimentos lançados (têm de ser apagados primeiro, em
 * Movimentos ou na importação de Extratos) ou se for o exercício activo
 * (torna-se outro ano activo primeiro, na tabela). Os movimentos nunca são
 * apagados aqui.
 */
export async function eliminarExercicio(
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

    const anoPorOmissao = await definicao<number>(
      "ano_exercicio",
      new Date().getFullYear(),
    );
    if (ano === anoPorOmissao) {
      return {
        ok: false,
        mensagem: `${ano} é o exercício activo. Torna outro ano activo antes de o eliminar.`,
      };
    }

    const { count } = await supabase
      .from("movimentos")
      .select("id", { count: "exact", head: true })
      .gte("data", `${ano}-01-01`)
      .lte("data", `${ano}-12-31`);
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        mensagem: `${ano} tem ${count} movimento(s) lançado(s). Apaga-os primeiro em Movimentos ou na importação de Extratos.`,
      };
    }

    const { error: erroSaldos } = await supabase
      .from("saldos_iniciais")
      .delete()
      .eq("ano", ano);
    if (erroSaldos) return { ok: false, mensagem: erroSaldos.message };

    await supabase.from("quotas_fracao").delete().eq("ano", ano);

    revalidatePath("/", "layout");
    return { ok: true, mensagem: `Exercício de ${ano} eliminado.` };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}
