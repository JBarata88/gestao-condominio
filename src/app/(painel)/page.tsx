import type { Metadata } from "next";
import CartaoKpi from "@/components/cartao-kpi";
import { Painel } from "@/components/ui";
import AdministracaoCondominio from "@/components/administracao-condominio";
import { construirMapa, saldosApos } from "@/lib/contas";
import {
  anoDeExercicio,
  carregarAdministradoresDoAno,
  carregarFracoes,
  carregarMovimentos,
  carregarQuotasDoAno,
  carregarSaldosIniciais,
  definicao,
  limitesDoAno,
  paraCalculo,
  quotaEfetiva,
} from "@/lib/dados";
import { euros } from "@/lib/formatos";
import { fracoesEmAtraso, matrizQuotas, totalPorCobrar } from "@/lib/quotas";

export const metadata: Metadata = { title: "Painel" };

export default async function PaginaPainel({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const { ano: anoParam } = await searchParams;
  const ano = await anoDeExercicio(anoParam);
  const diaLimite = await definicao<number>("dia_limite_quota", 8);

  const [inicio, fim] = limitesDoAno(ano);
  const [movimentos, fracoes, abertura, quotasDoAno, administradores] =
    await Promise.all([
      carregarMovimentos(inicio, fim),
      carregarFracoes(),
      carregarSaldosIniciais(ano),
      carregarQuotasDoAno(ano),
      carregarAdministradoresDoAno(ano),
    ]);

  const calculo = paraCalculo(movimentos);
  const saldos = saldosApos(calculo, abertura);

  const hoje = new Date().toISOString().slice(0, 10);

  // carregarMovimentos já vem limitado a limitesDoAno(ano), portanto calculo
  // é o ano inteiro: nada a filtrar por mês.
  const mapaAno = construirMapa(calculo, abertura);
  const receitasAno = mapaAno.origem.atual.subtotal;
  const despesasAno = mapaAno.aplicacao.despesas.subtotal;
  const top3Despesas = mapaAno.aplicacao.despesas.linhas
    .filter((l) => l.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 3);

  const linhas = matrizQuotas({
    fracoes: fracoes.map((f) => ({
      id: f.id,
      letra: f.letra,
      andar: f.andar,
      quotaMensal: quotaEfetiva(f, quotasDoAno),
      ativo: f.ativo,
    })),
    // Todos os recebimentos de Quotizações contam, com ou sem mês etiquetado:
    // a distribuição pelos meses é feita pelo total, não por etiqueta.
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

  const emAtraso = fracoesEmAtraso(linhas);
  const porCobrar = totalPorCobrar(linhas);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <p className="font-display text-sm tracking-[0.2em] text-ocre-600 uppercase">
          Exercício de {ano}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] text-verdete-950">
          Painel
        </h1>
        <div className="mt-2">
          <AdministracaoCondominio administradores={administradores} ano={ano} />
        </div>
      </header>

      {/* Os dois indicadores pedidos: valor em caixa e valor no banco. */}
      <section aria-labelledby="disponibilidades" className="mb-10">
        <h2
          id="disponibilidades"
          className="mb-4 font-display text-xl font-semibold text-verdete-900"
        >
          Disponibilidades
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CartaoKpi rotulo="Valor em caixa" valor={saldos.caixa} />
          <CartaoKpi rotulo="Valor no banco" valor={saldos.depositoOrdem} />
          <CartaoKpi
            rotulo="Total disponível"
            valor={saldos.total}
            tom="destaque"
            nota={`Abertura de ${ano}: ${euros(
              abertura.caixa + abertura.depositoOrdem,
            )}`}
          />
        </div>
      </section>

      <section aria-labelledby="movimento-ano" className="mb-10">
        <h2
          id="movimento-ano"
          className="mb-4 font-display text-xl font-semibold text-verdete-900"
        >
          Ano de {ano}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CartaoKpi rotulo="Receitas totais do ano" valor={receitasAno} />
          <CartaoKpi rotulo="Despesas totais do ano" valor={despesasAno} />
          <Painel titulo="Top 3 despesas do ano">
            {top3Despesas.length === 0 ? (
              <p className="text-sm text-pergaminho-600">
                Sem despesas registadas.
              </p>
            ) : (
              <ol className="flex flex-col gap-2 text-sm">
                {top3Despesas.map((d, i) => (
                  <li
                    key={d.rotulo}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <span className="text-pergaminho-700">
                      <span className="tabular mr-2 text-pergaminho-400">
                        {i + 1}.
                      </span>
                      {d.rotulo}
                    </span>
                    <span className="tabular font-medium text-verdete-950">
                      {euros(d.valor)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Painel>
        </div>
      </section>

      <section aria-labelledby="quotas">
        <h2
          id="quotas"
          className="mb-4 font-display text-xl font-semibold text-verdete-900"
        >
          Quotas
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CartaoKpi
            rotulo="Frações em atraso"
            valor={`${emAtraso.length} de ${fracoes.filter((f) => f.ativo).length}`}
            moeda={false}
            tom={emAtraso.length > 0 ? "alerta" : "neutro"}
            nota={`Prazo de pagamento: dia ${diaLimite} de cada mês`}
          />
          <CartaoKpi
            rotulo="Valor por cobrar"
            valor={porCobrar}
            tom={porCobrar > 0 ? "alerta" : "neutro"}
          />
        </div>

        {emAtraso.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {emAtraso.map((l) => (
              <li
                key={l.fracao.id}
                className="rounded-lg border border-ocre-200 bg-ocre-50 px-3 py-2 text-sm text-ocre-800"
              >
                <span className="font-medium">Fração {l.fracao.letra}</span>
                <span className="text-ocre-700/80"> · {l.fracao.andar} · </span>
                <span className="tabular">{euros(l.totalEmFalta)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {movimentos.length === 0 && (
        <p className="mt-10 rounded-xl border border-pergaminho-200 bg-white p-6 leading-relaxed text-pergaminho-600">
          Ainda não há movimentos registados em {ano}. Podes importar o
          histórico com o script de arranque ou começar a lançar em Movimentos.
        </p>
      )}
    </div>
  );
}
