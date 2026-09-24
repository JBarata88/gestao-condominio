import type { Metadata } from "next";
import { Painel } from "@/components/ui";
import FormularioAccao, { Campo } from "@/components/formulario-accao";
import {
  anoDeExercicio,
  carregarCondominio,
  definicao,
  listarExercicios,
  temSaldosIniciais,
} from "@/lib/dados";
import { euros } from "@/lib/formatos";
import { abrirExercicio, guardarCondominio, guardarDefinicoes } from "../accoes";
import { exigirAdminOuRedirecionar } from "../exigir-admin";
import BotaoAbrirExercicio from "./botao-abrir-exercicio";
import BotaoApagarExercicio from "./botao-apagar-exercicio";
import BotaoCriarExercicio from "./botao-criar-exercicio";
import BotaoTornarActivo from "./botao-tornar-activo";

export const metadata: Metadata = { title: "Condomínio · Definições" };

export default async function PaginaDefinicoesCondominio({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  await exigirAdminOuRedirecionar();

  const { ano: anoParam } = await searchParams;
  const ano = await anoDeExercicio(anoParam);

  const [condominio, saldosDefinidos, exercicios] = await Promise.all([
    carregarCondominio(),
    temSaldosIniciais(ano),
    listarExercicios(),
  ]);

  // O exercício activo (definicoes.ano_exercicio) muda-se na tabela de
  // Exercícios, com "Tornar activo" — não é o ano que está a ser consultado
  // através do seletor no topo da página.
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

  const proximoAno =
    Math.max(anoPorOmissao, ...exercicios.map((e) => e.ano)) + 1;

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
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-semibold text-verdete-900">
                Exercícios
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-pergaminho-600">
                Todos os anos com dados, mais o exercício activo. O ano
                <span className="text-ocre-600"> activo</span> é o que toda a
                gente vê por omissão; um ano criado a seguir a esse, ainda por
                activar, aparece como{" "}
                <span className="text-verdete-600">futuro</span>; todos os
                outros ficam
                <span className="text-pergaminho-500"> inactivos</span>. Um
                exercício sem saldos de abertura só se pode abrir; um
                exercício só se pode eliminar se não tiver movimentos e não
                for o activo. Eliminar apaga os saldos de abertura e as
                quotas desse ano; os movimentos nunca são apagados aqui.
              </p>
            </div>
            <BotaoCriarExercicio anoSugerido={proximoAno} />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
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
                    const estado: "activo" | "futuro" | "inactivo" = e.ativo
                      ? "activo"
                      : e.ano > anoPorOmissao
                        ? "futuro"
                        : "inactivo";
                    const ESTADO_COR: Record<typeof estado, string> = {
                      activo: "text-ocre-600",
                      futuro: "text-verdete-600",
                      inactivo: "text-pergaminho-400",
                    };
                    const bloqueadoEliminar = e.ativo || e.movimentos > 0;
                    const motivoEliminar = e.ativo
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
                          <span
                            className={`ml-2 text-xs font-normal ${ESTADO_COR[estado]}`}
                          >
                            {estado}
                          </span>
                          {estado !== "futuro" && !e.temSaldos && (
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
                          {!e.temSaldos ? (
                            <BotaoAbrirExercicio ano={e.ano} />
                          ) : (
                            <span className="flex flex-wrap items-center justify-end gap-3">
                              {!e.ativo && <BotaoTornarActivo ano={e.ano} />}
                              <BotaoApagarExercicio
                                ano={e.ano}
                                bloqueado={bloqueadoEliminar}
                                motivo={
                                  bloqueadoEliminar ? motivoEliminar : undefined
                                }
                              />
                            </span>
                          )}
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
          descricao={`Ainda não há saldos de abertura para ${ano}. A app calcula os saldos de caixa e banco no fim de ${ano - 1} e usa-os como abertura deste ano, e transporta as quotas em vigor. Fica marcado como "futuro" até escolheres "Tornar activo" na tabela acima.`}
        >
          <FormularioAccao
            accao={abrirExercicio}
            rotulo={`Abrir exercício a partir do fecho de ${ano - 1}`}
          >
            <input type="hidden" name="ano" value={ano} />
          </FormularioAccao>
        </Painel>
      )}
    </div>
  );
}
