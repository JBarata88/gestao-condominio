/**
 * Leitura validada das variáveis de ambiente do Supabase.
 *
 * Falhar aqui, com uma mensagem clara, é melhor do que deixar o cliente
 * arrancar com uma URL vazia e produzir erros de rede incompreensíveis.
 */

function obrigatoria(nome: string, valor: string | undefined): string {
  if (!valor || valor.trim() === "") {
    throw new Error(
      `Variável de ambiente em falta: ${nome}. ` +
        `Copia o .env.example para .env.local e preenche os valores do teu projeto Supabase.`,
    );
  }
  return valor;
}

export function urlSupabase(): string {
  return obrigatoria(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function chaveAnonima(): string {
  return obrigatoria(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Chave de serviço, que ignora as políticas de Row Level Security.
 *
 * Só pode ser lida em código de servidor. Se alguma vez for importada para um
 * componente de cliente, o Next inclui-a no pacote enviado ao browser e a base
 * de dados fica aberta a qualquer visitante, por isso o acesso está travado.
 */
export function chaveServico(): string {
  if (typeof window !== "undefined") {
    throw new Error(
      "A chave de serviço do Supabase não pode ser usada no browser.",
    );
  }
  return obrigatoria(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
