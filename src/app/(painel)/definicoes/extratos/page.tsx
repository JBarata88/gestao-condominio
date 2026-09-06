import type { Metadata } from "next";
import { Painel, Vazio } from "@/components/ui";
import { clienteServidor } from "@/lib/supabase/servidor";
import { dataCurta } from "@/lib/formatos";
import type { Extrato } from "@/lib/tipos-bd";
import Importador from "./importador";

export const metadata: Metadata = { title: "Extratos bancários · Definições" };

export default async function PaginaDefinicoesExtratos() {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("extratos")
    .select("*")
    .order("importado_em", { ascending: false })
    .limit(20);

  const extratos = (data ?? []) as Extrato[];

  return (
    <div className="flex flex-col gap-6">
      <p className="leading-relaxed text-pergaminho-600">
        Carrega o extrato e revê as sugestões antes de gravar. Movimentos já
        importados são detectados e marcados como repetidos.
      </p>

      <Painel titulo="Novo extrato">
        <Importador />
      </Painel>

      <Painel titulo="Importações anteriores">
        {extratos.length === 0 ? (
          <Vazio>Ainda não importaste nenhum extrato.</Vazio>
        ) : (
          <ul className="flex flex-col divide-y divide-pergaminho-200">
            {extratos.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3"
              >
                <span className="font-medium text-verdete-900">
                  {e.nome_ficheiro}
                </span>
                <span className="text-sm text-pergaminho-600">
                  {e.periodo_inicio && e.periodo_fim
                    ? `${dataCurta(e.periodo_inicio)} a ${dataCurta(e.periodo_fim)}`
                    : "período desconhecido"}
                  {" · "}
                  {e.total_linhas} linha(s)
                </span>
              </li>
            ))}
          </ul>
        )}
      </Painel>
    </div>
  );
}
