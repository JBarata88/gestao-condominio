import type { Metadata } from "next";
import { Painel } from "@/components/ui";
import FormularioAccao, { Campo } from "@/components/formulario-accao";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { Fornecedor } from "@/lib/tipos-bd";
import { guardarFornecedor } from "../accoes";

export const metadata: Metadata = { title: "Fornecedores · Definições" };

export default async function PaginaDefinicoesFornecedores() {
  const supabase = await clienteServidor();
  const { data: fornecedores } = await supabase
    .from("fornecedores")
    .select("*")
    .order("nome");

  return (
    <section>
      <p className="mb-6 leading-relaxed text-pergaminho-600">
        O IBAN fica visível apenas para a administração.
      </p>

      <div className="flex flex-col gap-5">
        {((fornecedores ?? []) as Fornecedor[]).map((f) => (
          <Painel key={f.id} titulo={f.nome}>
            <FormularioAccao accao={guardarFornecedor}>
              <input type="hidden" name="id" value={f.id} />
              <CamposFornecedor fornecedor={f} />
            </FormularioAccao>
          </Painel>
        ))}

        <Painel
          titulo="Novo fornecedor"
          descricao="Nome, tipo, email, telefone e IBAN."
        >
          <FormularioAccao accao={guardarFornecedor} rotulo="Adicionar">
            <CamposFornecedor />
          </FormularioAccao>
        </Painel>
      </div>
    </section>
  );
}

function CamposFornecedor({ fornecedor }: { fornecedor?: Fornecedor }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Campo nome="nome" etiqueta="Nome" valor={fornecedor?.nome} obrigatorio />
      <Campo
        nome="tipo"
        etiqueta="Tipo"
        valor={fornecedor?.tipo}
        dica="Por exemplo: limpeza, seguros, electricidade."
      />
      <Campo nome="email" etiqueta="Email" tipo="email" valor={fornecedor?.email} />
      <Campo nome="telefone" etiqueta="Telefone" valor={fornecedor?.telefone} />
      <Campo
        nome="iban"
        etiqueta="IBAN"
        valor={fornecedor?.iban}
        className="sm:col-span-2"
      />
    </div>
  );
}
