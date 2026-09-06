import type { Metadata } from "next";
import { Painel } from "@/components/ui";
import FormularioAccao, { Campo } from "@/components/formulario-accao";
import { carregarFracoes } from "@/lib/dados";
import { guardarFracao } from "../accoes";

export const metadata: Metadata = { title: "Frações · Definições" };

export default async function PaginaDefinicoesFracoes() {
  const fracoes = await carregarFracoes();
  const comAdministracao = fracoes.filter((f) => f.administracao).length;

  return (
    <section>
      <p className="mb-3 leading-relaxed text-pergaminho-600">
        Cada condómino está ligado a uma fração. O tratamento define se os
        recibos dizem &quot;do condómino&quot; ou &quot;da condómina&quot;.
      </p>
      <p className="mb-6 rounded-lg border border-ocre-200 bg-ocre-50 px-4 py-3 text-sm leading-relaxed text-ocre-800">
        Marca <strong>&quot;Fração da administração&quot;</strong> nas frações
        cujos condóminos gerem o condomínio: essas contas passam a ver todas as
        secções e a poder editar. As restantes só vêem Painel, Movimentos,
        Quotas e Relatórios.
        {comAdministracao === 0 && (
          <>
            {" "}
            De momento nenhuma fração está marcada como administração.
          </>
        )}
      </p>

      <div className="flex flex-col gap-5">
        {fracoes.map((f) => (
          <Painel key={f.id} titulo={`Fração ${f.letra} · ${f.andar}`}>
            <FormularioAccao accao={guardarFracao}>
              <input type="hidden" name="id" value={f.id} />
              <input type="hidden" name="ordem" value={f.ordem} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Campo nome="letra" etiqueta="Fração" valor={f.letra} obrigatorio />
                <Campo nome="andar" etiqueta="Andar" valor={f.andar} obrigatorio />
                <Campo
                  nome="condomino_nome"
                  etiqueta="Nome do condómino"
                  valor={f.condomino_nome}
                  className="sm:col-span-2"
                />
                <Campo nome="email" etiqueta="Email" tipo="email" valor={f.email} />
                <Campo nome="telefone" etiqueta="Telefone" valor={f.telefone} />
                <Campo
                  nome="quota_mensal"
                  etiqueta="Quota mensal"
                  valor={f.quota_mensal}
                  dica="Em euros."
                />
                <Campo
                  nome="permilagem"
                  etiqueta="Permilagem"
                  valor={f.permilagem}
                />

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={`tratamento-${f.id}`}
                    className="text-sm font-medium text-verdete-800"
                  >
                    Tratamento nos recibos
                  </label>
                  <select
                    id={`tratamento-${f.id}`}
                    name="tratamento"
                    defaultValue={f.tratamento}
                    className="rounded-lg border border-pergaminho-300 bg-white px-3 py-2.5 text-verdete-950 transition-colors duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none"
                  >
                    <option value="masculino">do condómino</option>
                    <option value="feminino">da condómina</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 self-end pb-2.5 text-sm text-verdete-800">
                  <input
                    type="checkbox"
                    name="ativo"
                    defaultChecked={f.ativo}
                    className="size-4 accent-[#274a43]"
                  />
                  Fração activa
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-pergaminho-200 bg-pergaminho-50 p-3 text-sm text-verdete-800 sm:col-span-2">
                  <input
                    type="checkbox"
                    name="administracao"
                    defaultChecked={f.administracao}
                    className="mt-0.5 size-4 accent-[#274a43]"
                  />
                  <span>
                    <span className="font-medium">Fração da administração</span>
                    <span className="block text-pergaminho-600">
                      O condómino ligado a esta fração tem acesso de
                      administrador: vê e edita todas as secções.
                    </span>
                  </span>
                </label>
              </div>
            </FormularioAccao>
          </Painel>
        ))}
      </div>
    </section>
  );
}
