"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Seletor do ano de exercício a consultar.
 *
 * A escolha vai para a ligação (?ano=) e para uma cookie, para sobreviver à
 * navegação entre páginas. O servidor lê-a em anoDeExercicio(). A definição
 * global "ano_exercicio" continua a ser o valor por omissão de quem entra sem
 * nada escolhido.
 */
export default function SeletorAno({
  anos,
  anoActivo,
}: {
  anos: number[];
  anoActivo: number;
}) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();

  const selecionado = params.get("ano") ?? String(anoActivo);

  function escolher(ano: string) {
    // Um ano de validade: o seletor é uma conveniência, não um dado a guardar.
    document.cookie = `ano_exercicio_vista=${ano}; path=/; max-age=31536000; samesite=lax`;

    const novos = new URLSearchParams(params);
    novos.set("ano", ano);
    router.push(`${caminho}?${novos.toString()}`);
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm text-pergaminho-600">
      <span className="font-medium tracking-wide uppercase">Exercício</span>
      <select
        value={selecionado}
        onChange={(e) => escolher(e.target.value)}
        aria-label="Ano do exercício a consultar"
        className="rounded-lg border border-pergaminho-300 bg-white px-3 py-1.5 text-sm font-medium text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none"
      >
        {anos.map((ano) => (
          <option key={ano} value={ano}>
            {ano}
          </option>
        ))}
      </select>
    </label>
  );
}
