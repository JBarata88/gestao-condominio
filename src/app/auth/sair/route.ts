import { NextResponse, type NextRequest } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Termina a sessão.
 *
 * Só aceita POST: um GET permitiria terminar a sessão de alguém através de uma
 * simples imagem apontada a este endereço noutro sítio.
 */
export async function POST(pedido: NextRequest) {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/entrar", pedido.url), {
    status: 303,
  });
}
