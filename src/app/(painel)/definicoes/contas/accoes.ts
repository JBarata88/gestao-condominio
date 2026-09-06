"use server";

import { revalidatePath } from "next/cache";
import { perfilAtual } from "@/lib/dados";
import { clienteAdministrativo } from "@/lib/supabase/servidor";

export type Resultado = { ok: boolean; mensagem: string };

/**
 * A gestão de contas é a única parte da aplicação que usa a chave de serviço,
 * porque criar e apagar utilizadores em auth.users não é possível com a chave
 * anónima sujeita ao RLS. Todas as acções confirmam o papel de administrador
 * antes de tocar em nada.
 */
async function exigirAdmin() {
  const perfil = await perfilAtual();
  if (!perfil?.admin) {
    throw new Error("Sem permissão para gerir contas.");
  }
  return perfil;
}

function texto(dados: FormData, campo: string): string | null {
  const v = dados.get(campo);
  if (typeof v !== "string") return null;
  const limpo = v.trim();
  return limpo === "" ? null : limpo;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Criar conta
// ---------------------------------------------------------------------------
export async function criarConta(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();

    const email = texto(dados, "email")?.toLowerCase() ?? null;
    const palavraPasse = texto(dados, "palavra_passe");
    const nome = texto(dados, "nome");
    const fracaoId = texto(dados, "fracao_id");
    const admin = dados.get("admin") !== null;

    if (!email || !EMAIL.test(email)) {
      return { ok: false, mensagem: "Indica um email válido." };
    }
    if (!palavraPasse || palavraPasse.length < 8) {
      return {
        ok: false,
        mensagem: "A palavra-passe tem de ter pelo menos 8 caracteres.",
      };
    }
    if (!admin && !fracaoId) {
      return {
        ok: false,
        mensagem:
          "Escolhe a fração da conta. Sem fração, um condómino não vê dados nenhuns.",
      };
    }

    const supabase = clienteAdministrativo();

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: palavraPasse,
      email_confirm: true,
      user_metadata: { nome, fracao_id: fracaoId },
    });
    if (error) return { ok: false, mensagem: error.message };

    // O gatilho ao_criar_utilizador já criou a linha em profiles; o upsert
    // garante o nome, a fração e o papel escolhidos no formulário mesmo que o
    // gatilho esteja desactivado.
    const { error: erroPerfil } = await supabase.from("profiles").upsert({
      id: data.user.id,
      nome: nome ?? email,
      fracao_id: fracaoId,
      papel: admin ? "admin" : "condomino",
    });
    if (erroPerfil) return { ok: false, mensagem: erroPerfil.message };

    revalidatePath("/definicoes", "layout");
    return { ok: true, mensagem: `Conta ${email} criada.` };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Atualizar a fração e o papel de uma conta
// ---------------------------------------------------------------------------
export async function atualizarConta(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();

    const id = texto(dados, "id");
    if (!id) return { ok: false, mensagem: "Conta não indicada." };

    const fracaoId = texto(dados, "fracao_id");
    const admin = dados.get("admin") !== null;

    if (!admin && !fracaoId) {
      return {
        ok: false,
        mensagem:
          "Um condómino tem de ter fração. Marca como administrador ou escolhe uma fração.",
      };
    }

    const supabase = clienteAdministrativo();
    const { error } = await supabase
      .from("profiles")
      .update({
        fracao_id: fracaoId,
        papel: admin ? "admin" : "condomino",
      })
      .eq("id", id);
    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/definicoes", "layout");
    return { ok: true, mensagem: "Conta actualizada." };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Redefinir a palavra-passe de uma conta
// ---------------------------------------------------------------------------
export async function redefinirPalavraPasse(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    await exigirAdmin();

    const id = texto(dados, "id");
    if (!id) return { ok: false, mensagem: "Conta não indicada." };

    const nova = texto(dados, "palavra_passe");
    if (!nova || nova.length < 8) {
      return {
        ok: false,
        mensagem: "A palavra-passe tem de ter pelo menos 8 caracteres.",
      };
    }

    const supabase = clienteAdministrativo();
    const { error } = await supabase.auth.admin.updateUserById(id, {
      password: nova,
    });
    if (error) return { ok: false, mensagem: error.message };

    return {
      ok: true,
      mensagem: "Palavra-passe alterada. Comunica-a ao titular da conta.",
    };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Apagar conta
// ---------------------------------------------------------------------------
export async function apagarConta(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    const eu = await exigirAdmin();

    const id = texto(dados, "id");
    if (!id) return { ok: false, mensagem: "Conta não indicada." };
    if (id === eu.id) {
      return { ok: false, mensagem: "Não podes apagar a tua própria conta." };
    }

    const supabase = clienteAdministrativo();
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) return { ok: false, mensagem: error.message };

    revalidatePath("/definicoes", "layout");
    return { ok: true, mensagem: "Conta removida." };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}
