"use server";

import { perfilAtual } from "@/lib/dados";
import { clienteServidor } from "@/lib/supabase/servidor";

export type Resultado = { ok: boolean; mensagem: string };

function texto(dados: FormData, campo: string): string | null {
  const v = dados.get(campo);
  if (typeof v !== "string") return null;
  const limpo = v.trim();
  return limpo === "" ? null : limpo;
}

/**
 * Qualquer conta autenticada pode mudar a própria palavra-passe — não é
 * preciso acesso de administrador para isto, ao contrário do resto de
 * Definições. Usa a sessão do próprio, por isso não precisa da chave de
 * serviço que a gestão de contas (de terceiros) usa.
 */
export async function alterarPropriaPalavraPasse(
  _anterior: Resultado | null,
  dados: FormData,
): Promise<Resultado> {
  try {
    const perfil = await perfilAtual();
    if (!perfil) {
      return { ok: false, mensagem: "A sessão terminou. Entra novamente." };
    }

    const nova = texto(dados, "palavra_passe");
    const confirmacao = texto(dados, "confirmacao");
    if (!nova || nova.length < 8) {
      return {
        ok: false,
        mensagem: "A palavra-passe tem de ter pelo menos 8 caracteres.",
      };
    }
    if (nova !== confirmacao) {
      return { ok: false, mensagem: "As duas palavras-passe não coincidem." };
    }

    const supabase = await clienteServidor();
    const { error } = await supabase.auth.updateUser({ password: nova });
    if (error) return { ok: false, mensagem: error.message };

    return { ok: true, mensagem: "Palavra-passe alterada." };
  } catch (e) {
    return { ok: false, mensagem: (e as Error).message };
  }
}
