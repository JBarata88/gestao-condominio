import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabecalhoPagina, Painel } from "@/components/ui";
import FormularioAccao, { Campo } from "@/components/formulario-accao";
import {
  carregarCondominio,
  carregarFracoes,
  carregarSaldosIniciais,
  definicao,
  perfilAtual,
} from "@/lib/dados";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { Fornecedor } from "@/lib/tipos-bd";
import {
  guardarCondominio,
  guardarDefinicoes,
  guardarFornecedor,
  guardarFracao,
  guardarSaldosIniciais,
} from "./accoes";

export const metadata: Metadata = { title: "Definições" };

export default async function PaginaDefinicoes() {
  const perfil = await perfilAtual();
  if (perfil?.papel !== "admin") redirect("/");

  const supabase = await clienteServidor();
  const ano = await definicao<number>("ano_exercicio", new Date().getFullYear());

  const [condominio, fracoes, saldos, { data: fornecedores }] =
    await Promise.all([
      carregarCondominio(),
      carregarFracoes(),
      carregarSaldosIniciais(ano),
      supabase.from("fornecedores").select("*").order("nome"),
    ]);

  const diaLimite = await definicao<number>("dia_limite_quota", 8);
  const localidade = await definicao<string>(
    "localidade_recibos",
    "Póvoa de Santa Iria",
  );
  const valorPresenca = await definicao<number>("valor_presenca_assembleia", 5);

  return (
    <div className="mx-auto max-w-4xl">
      <CabecalhoPagina
        sobretitulo="Administração"
        titulo="Definições"
        descricao="Dados do condomínio, prazos, condóminos e fornecedores."
      />

      <div className="flex flex-col gap-6">
        {/* ---------------------------------------------------------------- */}
        <Painel
          titulo="Prazos e exercício"
          descricao="O dia limite determina a partir de quando uma quota conta como atraso."
        >
          <FormularioAccao accao={guardarDefinicoes}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo
                nome="dia_limite_quota"
                etiqueta="Dia limite de pagamento das quotas"
                tipo="number"
                min={1}
                max={31}
                valor={diaLimite}
                obrigatorio
                dica="As quotas devem estar pagas até este dia de cada mês."
              />
              <Campo
                nome="ano_exercicio"
                etiqueta="Ano do exercício"
                tipo="number"
                valor={ano}
                obrigatorio
              />
              <Campo
                nome="localidade_recibos"
                etiqueta="Localidade nos recibos"
                valor={localidade}
              />
              <Campo
                nome="valor_presenca_assembleia"
                etiqueta="Valor por presença em assembleia"
                valor={valorPresenca}
                dica="Em euros. Usado nos recibos de presença."
              />
            </div>
          </FormularioAccao>
        </Painel>

        {/* ---------------------------------------------------------------- */}
        <Painel
          titulo="Condomínio"
          descricao="Aparece no cabeçalho dos relatórios e dos recibos."
        >
          <FormularioAccao accao={guardarCondominio}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo
                nome="nome"
                etiqueta="Nome"
                valor={condominio?.nome}
                obrigatorio
              />
              <Campo
                nome="nif"
                etiqueta="Contribuinte"
                valor={condominio?.nif}
                obrigatorio
              />
              <Campo
                nome="morada"
                etiqueta="Morada"
                valor={condominio?.morada}
                obrigatorio
                className="sm:col-span-2"
              />
              <Campo
                nome="codigo_postal"
                etiqueta="Código postal"
                valor={condominio?.codigo_postal}
              />
              <Campo
                nome="localidade"
                etiqueta="Localidade"
                valor={condominio?.localidade}
              />
              <Campo nome="nib" etiqueta="NIB" valor={condominio?.nib} />
              <Campo nome="iban" etiqueta="IBAN" valor={condominio?.iban} />
            </div>
          </FormularioAccao>
        </Painel>

        {/* ---------------------------------------------------------------- */}
        <Painel
          titulo="Saldos de abertura"
          descricao={`Correspondem à secção "Administração anterior" do mapa, para ${ano}.`}
        >
          <FormularioAccao accao={guardarSaldosIniciais}>
            <input type="hidden" name="ano" value={ano} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo nome="caixa" etiqueta="Caixa" valor={saldos.caixa} />
              <Campo
                nome="deposito_ordem"
                etiqueta="Depósitos à ordem"
                valor={saldos.depositoOrdem}
              />
              <Campo
                nome="deposito_prazo"
                etiqueta="Depósitos a prazo"
                valor={saldos.depositoPrazo}
              />
              <Campo
                nome="conta_poupanca"
                etiqueta="Conta poupança"
                valor={saldos.contaPoupanca}
              />
            </div>
          </FormularioAccao>
        </Painel>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="mb-2 font-display text-2xl font-semibold text-verdete-900">
            Condóminos
          </h2>
          <p className="mb-5 leading-relaxed text-pergaminho-600">
            Cada condómino está ligado a uma fração. O tratamento define se os
            recibos dizem &quot;do condómino&quot; ou &quot;da condómina&quot;.
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
                  </div>
                </FormularioAccao>
              </Painel>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        <section>
          <h2 className="mb-2 font-display text-2xl font-semibold text-verdete-900">
            Fornecedores
          </h2>
          <p className="mb-5 leading-relaxed text-pergaminho-600">
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
      </div>
    </div>
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
