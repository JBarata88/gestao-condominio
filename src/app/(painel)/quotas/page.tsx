import type { Metadata } from "next";
import { CabecalhoPagina, Etiqueta, Painel, Vazio } from "@/components/ui";
import {
  anoDeExercicio,
  carregarFracoes,
  carregarMovimentos,
  carregarQuotasDoAno,
  definicao,
  limitesDoAno,
  perfilAtual,
  quotaEfetiva,
} from "@/lib/dados";
import { euros, MESES_ABREVIADOS } from "@/lib/formatos";
import { matrizQuotas, totalPorCobrar, type EstadoQuota } from "@/lib/quotas";

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

  const [fracoes, movimentos, quotasDoAno] = await Promise.all([
    carregarFracoes(),
    carregarMovimentos(inicio, fim),
    carregarQuotasDoAno(ano),
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

  const porCobrar = totalPorCobrar(linhas);

  return (
    <div className="mx-auto max-w-6xl">
      <CabecalhoPagina
        sobretitulo={`Exercício de ${ano}`}
        titulo="Quotas"
        descricao={`Pagamento devido até ao dia ${diaLimite} de cada mês. Um mês só conta como atraso depois dessa data. Cada fração é tratada como uma conta corrente: o total pago no ano é que determina quantos meses estão cobertos, não é preciso indicar a que mês uma transferência respeita.`}
      />

      {linhas.length === 0 ? (
        <Vazio>
          Ainda não há frações registadas. Cria-as em Definições.
        </Vazio>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Etiqueta tom="negativo">Por cobrar: {euros(porCobrar)}</Etiqueta>
            {admin && (
              <span className="text-sm text-pergaminho-600">
                Total de {linhas.length} fração(ões) no mapa.
              </span>
            )}
          </div>

          <Painel>
            {/* A tabela é larga: rola dentro do painel em vez de empurrar a página. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-sm">
                <caption className="sr-only">
                  Estado de pagamento das quotas por fração e por mês em {ano}
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 bg-white px-3 py-2.5 text-left font-medium text-verdete-800"
                    >
                      Fração
                    </th>
                    {MESES_ABREVIADOS.map((m) => (
                      <th
                        key={m}
                        scope="col"
                        className="px-2 py-2.5 text-center font-medium text-pergaminho-600"
                      >
                        {m}
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right font-medium text-verdete-800"
                    >
                      Meses pagos
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-right font-medium text-verdete-800"
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
                        className="sticky left-0 bg-white px-3 py-2.5 text-left font-medium whitespace-nowrap text-verdete-900"
                      >
                        {linha.fracao.letra}
                        <span className="ml-2 font-normal text-pergaminho-500">
                          {linha.fracao.andar}
                        </span>
                        {admin && (
                          <a
                            href={`/movimentos?fracao=${linha.fracao.id}`}
                            className="ml-2 text-xs font-normal text-pergaminho-500 underline-offset-2 hover:text-verdete-700 hover:underline"
                            title="Ver e corrigir os movimentos desta fração"
                          >
                            movimentos
                          </a>
                        )}
                      </th>

                      {linha.celulas.map((c) => (
                        <td key={c.mes} className="px-1 py-2 text-center">
                          <span
                            title={`${SIMBOLOS[c.estado]} · devido ${euros(c.devido)} · pago ${euros(c.pago)}`}
                            className={`inline-block w-full rounded-md border px-1 py-1 text-xs ${CORES[c.estado]}`}
                          >
                            {c.estado === "futuro" || c.estado === "isento"
                              ? "—"
                              : c.estado === "pago"
                                ? "✓"
                                : euros(c.emFalta).replace(/\s?€/, "")}
                          </span>
                        </td>
                      ))}

                      <td className="tabular px-3 py-2.5 text-right text-pergaminho-600">
                        {linha.mesesPagos} / 12
                      </td>
                      <td className="tabular px-3 py-2.5 text-right font-medium text-verdete-950">
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
        </>
      )}
    </div>
  );
}
