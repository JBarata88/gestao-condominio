"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clienteBrowser } from "@/lib/supabase/cliente";

export default function FormularioEntrada() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [email, setEmail] = useState("");
  const [palavraPasse, setPalavraPasse] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aSubmeter, iniciar] = useTransition();

  async function submeter(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    const supabase = clienteBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: palavraPasse,
    });

    if (error) {
      // Não distinguir "email inexistente" de "palavra-passe errada": isso
      // permitiria descobrir quais os endereços registados.
      setErro("Credenciais inválidas. Verifica o email e a palavra-passe.");
      return;
    }

    const seguinte = parametros.get("seguinte");
    const destino = seguinte?.startsWith("/") ? seguinte : "/";
    iniciar(() => {
      router.replace(destino);
      router.refresh();
    });
  }

  const ocupado = aSubmeter;

  return (
    <form onSubmit={submeter} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <label
          htmlFor="email"
          className="text-sm font-medium text-verdete-800"
        >
          Endereço de email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-pergaminho-300 bg-white px-4 py-3 text-verdete-950 shadow-[var(--shadow-baixo)] transition-[border-color,box-shadow] duration-200 ease-[var(--ease-saida)] placeholder:text-pergaminho-400 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none focus:ring-2 focus:ring-ocre-500/40"
          placeholder="nome@exemplo.pt"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="palavra-passe"
          className="text-sm font-medium text-verdete-800"
        >
          Palavra-passe
        </label>
        <input
          id="palavra-passe"
          name="palavra-passe"
          type="password"
          required
          autoComplete="current-password"
          value={palavraPasse}
          onChange={(e) => setPalavraPasse(e.target.value)}
          className="rounded-lg border border-pergaminho-300 bg-white px-4 py-3 text-verdete-950 shadow-[var(--shadow-baixo)] transition-[border-color,box-shadow] duration-200 ease-[var(--ease-saida)] hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none focus:ring-2 focus:ring-ocre-500/40"
        />
      </div>

      {erro && (
        <p
          role="alert"
          className="rounded-lg border border-[#a63a2b]/25 bg-[#a63a2b]/8 px-4 py-3 text-sm text-[#7d2c20]"
        >
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={ocupado}
        className="mt-1 rounded-lg bg-verdete-700 px-5 py-3.5 font-medium text-pergaminho-50 shadow-[var(--shadow-medio)] transition-[transform,background-color,box-shadow] duration-200 ease-[var(--ease-mola)] hover:-translate-y-0.5 hover:bg-verdete-600 hover:shadow-[var(--shadow-alto)] active:translate-y-0 active:bg-verdete-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {ocupado ? "A entrar…" : "Entrar"}
      </button>

      <p className="text-center text-sm leading-relaxed text-pergaminho-600">
        As contas são criadas pela administração do condomínio. Se não
        consegues entrar, fala com o administrador.
      </p>
    </form>
  );
}
