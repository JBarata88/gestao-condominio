import type { Metadata } from "next";
import { Painel } from "@/components/ui";
import { perfilAtual } from "@/lib/dados";
import { clienteServidor } from "@/lib/supabase/servidor";
import FormularioPalavraPasse from "./formulario-palavra-passe";

export const metadata: Metadata = { title: "Conta · Definições" };

/**
 * A única área de Definições que um condómino sem acesso de administrador
 * vê — ver exigirAdminOuRedirecionar. Serve só para alterar a própria
 * palavra-passe; os dados da conta (fração, papel) só a administração edita,
 * em Contas.
 */
export default async function PaginaDefinicoesConta() {
  const [perfil, supabase] = await Promise.all([
    perfilAtual(),
    clienteServidor(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-6">
      <Painel titulo="A tua conta">
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-pergaminho-600">Nome</dt>
            <dd className="font-medium text-verdete-950">
              {perfil?.nome ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-pergaminho-600">Email</dt>
            <dd className="font-medium text-verdete-950">
              {user?.email ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-pergaminho-600">Papel</dt>
            <dd className="font-medium text-verdete-950">
              {perfil?.admin ? "Administrador" : "Condómino"}
            </dd>
          </div>
        </dl>
      </Painel>

      <Painel
        titulo="Palavra-passe"
        descricao="Escolhe uma palavra-passe nova para a tua conta."
      >
        <FormularioPalavraPasse />
      </Painel>
    </div>
  );
}
