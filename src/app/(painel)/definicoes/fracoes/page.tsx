import type { Metadata } from "next";
import { anoDeExercicio, carregarFracoes } from "@/lib/dados";
import { clienteServidor } from "@/lib/supabase/servidor";
import { exigirAdminOuRedirecionar } from "../exigir-admin";
import LinhaFracao from "./linha-fracao";

export const metadata: Metadata = { title: "Frações · Definições" };

export default async function PaginaDefinicoesFracoes({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  await exigirAdminOuRedirecionar();

  const { ano: anoParam } = await searchParams;
  const ano = await anoDeExercicio(anoParam);

  const [fracoes, supabase] = await Promise.all([
    carregarFracoes(),
    clienteServidor(),
  ]);
  const { data: administradores } = await supabase
    .from("administradores_condominio")
    .select("fracao_id")
    .eq("ano", ano);
  const idsAdministradores = new Set(
    (administradores ?? []).map((a) => a.fracao_id),
  );

  return (
    <section className="flex flex-col gap-6">
      <p className="leading-relaxed text-pergaminho-600">
        Cada condómino está ligado a uma fração. O tratamento define se os
        recibos dizem &quot;do condómino&quot; ou &quot;da condómina&quot;. A
        quota mensal define-se em <strong>Quotas do ano</strong>, não aqui.
      </p>
      <p className="rounded-lg border border-ocre-200 bg-ocre-50 px-4 py-3 text-sm leading-relaxed text-ocre-800">
        A coluna <strong>Administração de {ano}</strong> diz que fração geria
        o condomínio nesse ano — é só informativo, mostrado em Painel, Quotas
        e Relatórios. Não dá nenhum acesso na aplicação: isso define-se em{" "}
        <strong>Contas</strong>.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[54rem] border-collapse text-sm">
          <caption className="sr-only">Frações do condomínio</caption>
          <thead>
            <tr className="border-b border-pergaminho-200 text-left">
              <th scope="col" className="px-4 py-2.5 font-medium text-verdete-800">
                Fração
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium text-verdete-800">
                Condómino
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium text-verdete-800">
                Contacto
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium text-verdete-800">
                Estado
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium text-verdete-800">
                Administração de {ano}
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Acções</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {fracoes.map((f) => (
              <LinhaFracao
                key={f.id}
                fracao={f}
                ano={ano}
                administrador={idsAdministradores.has(f.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
