import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { BaseDados } from "@/lib/tipos-bd";

/** Rotas acessíveis sem sessão iniciada. */
const PUBLICAS = ["/entrar", "/auth"];

/** Forma dos cookies que o Supabase pede para escrever. */
type CookiesAEscrever = Array<{
  name: string;
  value: string;
  options?: Record<string, unknown>;
}>;

export async function proxy(pedido: NextRequest) {
  let resposta = NextResponse.next({ request: pedido });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem configuração não há sessão possível. Deixar passar em vez de rebentar
  // dá uma página de instruções em vez de um erro 500 opaco.
  if (!url || !chave) return resposta;

  const supabase = createServerClient<BaseDados>(
    url,
    chave,
    {
      cookies: {
        getAll() {
          return pedido.cookies.getAll();
        },
        setAll(lista: CookiesAEscrever) {
          for (const { name, value } of lista) {
            pedido.cookies.set(name, value);
          }
          resposta = NextResponse.next({ request: pedido });
          for (const { name, value, options } of lista) {
            resposta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser valida o token contra o servidor de autenticação. getSession leria
  // apenas o cookie, que o cliente pode forjar, por isso não serve aqui.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Servidor de autenticação inacessível. Tratar como sessão ausente
    // mantém as rotas protegidas fechadas, que é o lado seguro da falha.
    user = null;
  }

  const caminho = pedido.nextUrl.pathname;
  const ePublica = PUBLICAS.some(
    (p) => caminho === p || caminho.startsWith(`${p}/`),
  );

  if (!user && !ePublica) {
    const destino = pedido.nextUrl.clone();
    destino.pathname = "/entrar";
    // Guarda o destino para voltar lá depois de entrar.
    destino.searchParams.set("seguinte", caminho);
    return NextResponse.redirect(destino);
  }

  if (user && caminho === "/entrar") {
    const destino = pedido.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  matcher: [
    /*
     * Tudo excepto ficheiros estáticos e imagens, onde a verificação de sessão
     * seria trabalho desperdiçado em cada pedido.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
