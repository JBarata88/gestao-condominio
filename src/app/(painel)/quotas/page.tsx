import type { Metadata } from "next";
import CartaoKpi from "@/components/cartao-kpi";
import { CabecalhoPagina, DicaInformacao, Painel, Vazio } from "@/components/ui";
import BotaoImprimir from "@/components/botao-imprimir";
import AdministracaoCondominio from "@/components/administracao-condominio";
import {
  anoDeExercicio,
  carregarAdministradoresDoAno,
  carregarFracoes,
  carregarMovimentos,
  carregarQuotasDoAno,
  carregarReforcosDoAno,
  definicao,
  limitesDoAno,
  perfilAtual,
  quotaEfetiva,
} from "@/lib/dados";
import { dataCurta, euros, MESES_ABREVIADOS } from "@/lib/formatos";
import { matrizQuotas, totaisQuotas, type EstadoQuota } from "@/lib/quotas";
import { matrizReforco, totaisReforco } from "@/lib/reforcos";

export const metadata: Metadata = { title: "Quotas" };

const CORES: Record<EstadoQuota, string> = {
  pago: "bg-[#3f7a4e]/15 text-[#2f5c3b] border-[#3f7a4e]/30",
  parcial: "bg-ocre-100 text-ocre-800 border-ocre-300",
  atrasado: "bg-[#a63a2b]/12 text-[#7d2c20] border-[#a63a2b]/30",
  pendente: "bg-pergaminho-100 text-pergaminho-600 border-pergaminho-300",
  futuro: "bg-transparent text-pergaminho-400 border-pergaminho-200",
  isento: "bg-transparent text-pergaminho-300 border-pergaminho-200",
};

const SIMBOLOS: Record<EstadoQuota, string> = {
  pago: "Pago",
  parcial: "Parcial",
  atrasado: "Em falta",
  pendente: "Por pagar",
  futuro: "—",
  isento: "—",
};

export default async function PaginaQuotas({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const perfil = await perfilAtual();
  const { ano: anoParam } = await searchParams;
  const ano = await anoDeExercicio(anoParam);
  const diaLimite = await definicao<number>("dia_limite_quota", 8);
  const [inicio, fim] = limitesDoAno(ano);

  const [fracoes, movimentos, quotasDoAno, reforcos, administradores] =
    await Promise.all([
      carregarFracoes(),
      carregarMovimentos(inicio, fim),
      carregarQuotasDoAno(ano),
      carregarReforcosDoAno(ano),
      carregarAdministradoresDoAno(ano),
    ]);

  const admin = perfil?.admin === true;

  const hoje = new Date().toISOString().slice(0, 10);
  const linhas = matrizQuotas({
    fracoes: fracoes.map((f) => ({
      id: f.id,
      letra: f.letra,
      andar: f.andar,
      quotaMensal: quotaEfetiva(f, quotasDoAno),
      ativo: f.ativo,
    })),
    // Todos os recebimentos de Quotizações contam, com ou sem mês etiquetado:
    // o total pago é que determina quantos meses ficam cobertos.
    pagamentos: movimentos
      .filter((m) => m.categorias?.nome === "Quotizações" && m.fracao_id)
      .map((m) => ({
        fracaoId: m.fracao_id,
        valor: Number(m.receita) - Number(m.despesa),
      })),
    ano,
    diaLimite,
    hoje,
  });

  const totais = totaisQuotas(linhas);

  const fracoesParaReforco = fracoes.map((f) => ({
    id: f.id,
    letra: f.letra,
    andar: f.andar,
    ativo: f.ativo,
  }));
  const mapasReforco = reforcos.map((r) => ({
    reforco: r,
    linhas: matrizReforco({
      fracoes: fracoesParaReforco,
      pagamentos: movimentos
        .filter((m) => m.reforco_id === r.id)
        .map((m) => ({
          fracaoId: m.fracao_id,
          valor: Number(m.receita) - Number(m.despesa),
        })),
      valorFracao: Number(r.valor_fracao),
      dataLimite: r.data_limite,
      hoje,
    }),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      {/* @page é do documento inteiro, não desta secção: como só esta página
          precisa de A4 horizontal, a regra vem depois da global (que fica em
          vertical) para a sobrepor só quando é este ecrã a ser impresso. */}
      <style>{"@media print { @page { size: A4 landscape; } }"}</style>

      <CabecalhoPagina
        sobretitulo={`Exercício de ${ano}`}
        titulo="Quotas"
        dica={
          <DicaInformacao>
            Pagamento devido até ao dia {diaLimite} de cada mês. Um mês só
            conta como atraso depois dessa data. Cada fração é tratada como
            uma conta corrente: o total pago no ano é que determina quantos
            meses estão cobertos, não é preciso indicar a que mês uma
            transferência respeita.
          </DicaInformacao>
        }
        accao={<BotaoImprimir />}
      />

      <div className="-mt-6 mb-6 print:-mt-3 print:mb-3">
        <AdministracaoCondominio administradores={administradores} ano={ano} />
      </div>

      {linhas.length === 0 ? (
        <Vazio>
          Ainda não há frações registadas. Cria-as em Definições.
        </Vazio>
      ) : (
        <>
          <p className="mb-6 text-sm text-pergaminho-600 print:mb-4">
            Total de {linhas.length} fração(ões) no mapa.
          </p>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 print:mb-4 print:gap-2">
            <CartaoKpi rotulo="Total Pago" valor={totais.pago} />
            <CartaoKpi rotulo="Total Em Falta" valor={totais.atrasado} />
            <CartaoKpi rotulo="Total Por Pagar" valor={totais.porPagar} />
          </div>

          <Painel className="print:border-0 print:p-0 print:shadow-none">
            {/* A tabela é larga: rola dentro do painel em vez de empurrar a página. */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[52rem] border-collapse text-sm print:min-w-0 print:text-[9pt]">
                <caption className="sr-only">
                  Estado de pagamento das quotas por fração e por mês em {ano}
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 bg-white px-3 py-2.5 text-left font-medium text-verdete-800 print:static print:px-2 print:py-1.5"
                    >
                      Fração
                    </th>
                    {MESES_ABREVIADOS.map((m) => (
                      <th
                        key={m}
                        scope="col"
                        className="px-2 py-2.5 text-center font-medium text-pergaminho-600 print:px-1 print:py-1.5"
                      >
                        {m}
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right font-medium text-verdete-800 print:px-2 print:py-1.5"
                    >
                      Meses pagos
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right font-medium text-verdete-800 print:px-2 print:py-1.5"
                    >
                      Em falta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => (
                    <tr
                      key={linha.fracao.id}
                      className="border-t border-pergaminho-200"
                    >
                      <th
                        scope="row"
                        className="sticky left-0 bg-white px-3 py-2.5 text-left font-medium whitespace-nowrap text-verdete-900 print:static print:px-2 print:py-1.5"
                      >
                        {linha.fracao.letra}
                        <span className="ml-2 font-normal text-pergaminho-500">
                          {linha.fracao.andar}
                        </span>
                        {admin && (
                          <a
                            href={`/movimentos?fracao=${linha.fracao.id}`}
                            className="ml-2 text-xs font-normal text-pergaminho-500 underline-offset-2 hover:text-verdete-700 hover:underline print:hidden"
                            title="Ver e corrigir os movimentos desta fração"
                          >
                            movimentos
                          </a>
                        )}
                      </th>

                      {linha.celulas.map((c) => (
                        <td
                          key={c.mes}
                          className="px-1 py-2 text-center print:px-1 print:py-1"
                        >
                          <span
                            title={`${SIMBOLOS[c.estado]} · devido ${euros(c.devido)} · pago ${euros(c.pago)}`}
                            className={`inline-block w-full rounded-md border px-1 py-1 text-xs print:rounded-sm print:px-1 print:py-0.5 print:text-[9pt] ${CORES[c.estado]}`}
                          >
                            {c.estado === "futuro" || c.estado === "isento"
                              ? "—"
                              : c.estado === "pago"
                                ? "✓"
                                : euros(c.emFalta).replace(/\s?€/, "")}
                          </span>
                        </td>
                      ))}

                      <td className="tabular px-3 py-2.5 text-right text-pergaminho-600 print:px-2 print:py-1.5">
                        {linha.mesesPagos} / 12
                      </td>
                      <td className="tabular px-3 py-2.5 text-right font-medium text-verdete-950 print:px-2 print:py-1.5">
                        {euros(linha.totalEmFalta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-5 flex flex-wrap gap-4 text-sm text-pergaminho-600">
              {(["pago", "parcial", "atrasado", "pendente"] as const).map(
                (estado) => (
                  <li key={estado} className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`inline-block size-3 rounded border ${CORES[estado]}`}
                    />
                    {SIMBOLOS[estado]}
                  </li>
                ),
              )}
            </ul>
          </Painel>

          {mapasReforco.map(({ reforco, linhas: linhasReforco }) => {
            const totaisR = totaisReforco(linhasReforco);
            return (
              <Painel
                key={reforco.id}
                className="mt-6 print:border-0 print:p-0 print:shadow-none"
              >
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-verdete-900">
                      {reforco.descricao}
                    </h2>
                    <p className="text-sm text-pergaminho-600">
                      {euros(Number(reforco.valor_fracao))} por fração · prazo{" "}
                      {dataCurta(reforco.data_limite)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-[#2f5c3b]">
                      Pago {euros(totaisR.pago)}
                    </span>
                    <span className="text-[#7d2c20]">
                      Em falta {euros(totaisR.atrasado)}
                    </span>
                    <span className="text-pergaminho-600">
                      Por pagar {euros(totaisR.porPagar)}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full min-w-[28rem] border-collapse text-sm print:min-w-0 print:text-[9pt]">
                    <caption className="sr-only">
                      Estado de pagamento do reforço &quot;{reforco.descricao}&quot;
                      por fração
                    </caption>
                    <thead>
                      <tr className="border-b border-pergaminho-200 text-left">
                        <th className="px-3 py-2.5 font-medium text-verdete-800">
                          Fração
                        </th>
                        <th className="px-3 py-2.5 text-right font-medium text-pergaminho-600">
                          Devido
                        </th>
                        <th className="px-3 py-2.5 text-right font-medium text-pergaminho-600">
                          Pago
                        </th>
                        <th className="px-3 py-2.5 text-right font-medium text-pergaminho-600">
                          Em falta
                        </th>
                        <th className="px-3 py-2.5 text-center font-medium text-verdete-800">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasReforco.map((linha) => (
                        <tr
                          key={linha.fracao.id}
                          className="border-b border-pergaminho-100 last:border-0"
                        >
                          <th
                            scope="row"
                            className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-verdete-900"
                          >
                            {linha.fracao.letra}
                            <span className="ml-2 font-normal text-pergaminho-500">
                              {linha.fracao.andar}
                            </span>
                          </th>
                          <td className="tabular px-3 py-2.5 text-right text-pergaminho-600">
                            {euros(linha.devido)}
                          </td>
                          <td className="tabular px-3 py-2.5 text-right text-pergaminho-600">
                            {euros(linha.pago)}
                          </td>
                          <td className="tabular px-3 py-2.5 text-right font-medium text-verdete-950">
                            {euros(linha.emFalta)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`inline-block rounded-md border px-2 py-1 text-xs ${CORES[linha.estado]}`}
                            >
                              {SIMBOLOS[linha.estado]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Painel>
            );
          })}
        </>
      )}
    </div>
  );
}
