import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { chaveAnonima, chaveServico, urlSupabase } from "./ambiente";
import type { BaseDados } from "@/lib/tipos-bd";

/** Forma dos cookies que o Supabase pede para escrever. */
type CookiesAEscrever = Array<{
  name: string;
  value: string;
  options?: Record<string, unknown>;
}>;

/**
 * Cliente para componentes de servidor e Route Handlers.
 *
 * Corre com a chave anónima, ou seja, sujeito às políticas de Row Level
 * Security em nome do utilizador autenticado. É este o cliente a usar em
 * praticamente todo o lado.
 */
export async function clienteServidor() {
  const armazem = await cookies();

  return createServerClient<BaseDados>(urlSupabase(), chaveAnonima(), {
    cookies: {
      getAll() {
        return armazem.getAll();
      },
      setAll(lista: CookiesAEscrever) {
        try {
          for (const { name, value, options } of lista) {
            armazem.set(name, value, options);
          }
        } catch {
          // Componentes de servidor não podem escrever cookies. A renovação
          // da sessão acontece no middleware, por isso ignorar aqui é seguro.
        }
      },
    },
  });
}

/**
 * Cliente com a chave de serviço, que ignora as políticas de segurança.
 *
 * Reservado para o que a API do Supabase não permite fazer de outra forma:
 * criar contas de utilizador a partir da página de Definições. Nunca deve ser
 * usado para ler ou escrever dados do condomínio, porque isso contornaria o
 * isolamento entre administrador e condómino.
 */
export function clienteAdministrativo() {
  return createServerClient<BaseDados>(urlSupabase(), chaveServico(), {
    cookies: {
      getAll() {
        return [];
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
