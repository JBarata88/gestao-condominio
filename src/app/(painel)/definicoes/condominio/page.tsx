import type { Metadata } from "next";
import { Painel } from "@/components/ui";
import FormularioAccao, { Campo } from "@/components/formulario-accao";
import {
  anoDeExercicio,
  carregarCondominio,
  carregarSaldosIniciais,
  definicao,
  listarExercicios,
  temSaldosIniciais,
} from "@/lib/dados";
import { euros } from "@/lib/formatos";
import {
  abrirExercicio,
  guardarCondominio,
  guardarDefinicoes,
  guardarSaldosIniciais,
} from "../accoes";
import BotaoApagarExercicio from "./botao-apagar-exercicio";

export const metadata: Metadata = { title: "Condomínio · Definições" };

export default async function PaginaDefinicoesCondominio() {
  const ano = await anoDeExercicio();

  const [condominio, saldos, saldosDefinidos, exercicios] = await Promise.all([
    carregarCondominio(),
    carregarSaldosIniciais(ano),
    temSaldosIniciais(ano),
    listarExercicios(),
  ]);

  // O campo "Ano do exercício" mexe no valor por omissão guardado, não no ano
  // que está a ser consultado através do seletor no topo da página.
  const anoPorOmissao = await definicao<number>(
    "ano_exercicio",
    new Date().getFullYear(),
  );
  const diaLimite = await definicao<number>("dia_limite_quota", 8);
  const localidade = await definicao<string>(
    "localidade_recibos",
    "Póvoa de Santa Iria",
  );
  const valorPresenca = await definicao<number>("valor_presenca_assembleia", 5);

  return (
    <div className="flex flex-col gap-6">
      <Painel
        titulo="Identificação do condomínio"
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
              etiqueta="Ano do exercício por omissão"
              tipo="number"
              valor={anoPorOmissao}
              obrigatorio
              dica="O ano que aparece a quem entra sem escolher outro no seletor."
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

        <div className="mt-8 border-t border-pergaminho-200 pt-6">
          <h3 className="font-display text-base font-semibold text-verdete-900">
            Exercícios
          </h3>
          <p className="mt-1 text-sm text-pergaminho-600">
            Todos os anos com dados, mais o exercício activo — o que está em
            &quot;Ano do exercício por omissão&quot;. Um exercício só pode ser
            eliminado se não tiver movimentos e não for o activo. Eliminar apaga
            os saldos de abertura e as quotas desse ano; os movimentos nunca são
            apagados aqui.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-pergaminho-200 text-left">
                  <th className="px-3 py-2 font-medium text-verdete-800">Ano</th>
                  <th className="px-3 py-2 font-medium text-pergaminho-600">
                    Abertura
                  </th>
                  <th className="px-3 py-2 font-medium text-pergaminho-600">
                    Movimentos
                  </th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {exercicios.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-pergaminho-500">
                      Ainda não há exercícios.
                    </td>
                  </tr>
                ) : (
                  exercicios.map((e) => {
                    const bloqueado = e.ativo || e.movimentos > 0;
                    const motivo = e.ativo
                      ? "Exercício activo"
                      : `${e.movimentos} movimento(s)`;
                    return (
                      <tr
                        key={e.ano}
                        className="border-b border-pergaminho-100 last:border-0"
                      >
                        <th
                          scope="row"
                          className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-verdete-900"
                        >
                          {e.ano}
                          {e.ativo && (
                            <span className="ml-2 text-xs font-normal text-ocre-600">
                              activo
                            </span>
                          )}
                          {!e.temSaldos && (
                            <span className="ml-2 text-xs font-normal text-pergaminho-400">
                              sem abertura
                            </span>
                          )}
                        </th>
                        <td className="tabular px-3 py-2.5 text-pergaminho-600">
                          {e.temSaldos ? euros(e.aberturaTotal) : "—"}
                        </td>
                        <td className="tabular px-3 py-2.5 text-pergaminho-600">
                          {e.movimentos}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <BotaoApagarExercicio
                            ano={e.ano}
                            bloqueado={bloqueado}
                            motivo={bloqueado ? motivo : undefined}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Painel>

      {!saldosDefinidos && (
        <Painel
          titulo={`Abrir o exercício de ${ano}`}
          descricao={`Ainda não há saldos de abertura para ${ano}. Podes transportá-los do fecho de ${ano - 1}: a app calcula os saldos de caixa e banco no fim desse ano e usa-os como abertura deste, transporta as quotas em vigor e passa a considerar ${ano} o exercício em curso. Podes ajustar tudo depois.`}
        >
          <FormularioAccao
            accao={abrirExercicio}
            rotulo={`Abrir exercício a partir do fecho de ${ano - 1}`}
          >
            <input type="hidden" name="ano" value={ano} />
          </FormularioAccao>
        </Painel>
      )}

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
    </div>
  );
}
