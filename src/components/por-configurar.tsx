/**
 * Mostrada quando as variáveis de ambiente do Supabase ainda não existem.
 * Um ecrã com instruções é mais útil do que um erro 500.
 */
export default function PorConfigurar() {
  const passos = [
    "Cria um projecto em supabase.com e abre Definições > API.",
    "Copia o ficheiro .env.example para .env.local.",
    "Preenche NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    "Aplica as migrações de supabase/migrations/ à base de dados.",
    "Reinicia o servidor de desenvolvimento.",
  ];

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-lg">
        <p className="font-display text-sm tracking-[0.2em] text-ocre-600 uppercase">
          Configuração
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] text-verdete-950">
          Falta ligar a base de dados
        </h1>
        <p className="mt-3 leading-relaxed text-pergaminho-600">
          A aplicação está instalada mas ainda não sabe onde guardar os dados.
        </p>

        <ol className="mt-8 flex flex-col gap-4">
          {passos.map((passo, i) => (
            <li key={passo} className="flex gap-4">
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-verdete-700 text-sm font-medium text-pergaminho-50"
              >
                {i + 1}
              </span>
              <span className="leading-relaxed text-verdete-900">{passo}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
