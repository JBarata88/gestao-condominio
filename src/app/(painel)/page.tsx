import type { Metadata } from "next";
import CartaoKpi from "@/components/cartao-kpi";
import { saldosApos } from "@/lib/contas";
import {
  anoDeExercicio,
  carregarFracoes,
  carregarMovimentos,
  carregarQuotasDoAno,
  carregarSaldosIniciais,
  definicao,
  limitesDoAno,
  paraCalculo,
  quotaEfetiva,
} from "@/lib/dados";
import { chaveMes, euros, MESES, somar } from "@/lib/formatos";
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
  const [movimentos, fracoes, abertura, quotasDoAno] = await Promise.all([
    carregarMovimentos(inicio, fim),
    carregarFracoes(),
    carregarSaldosIniciais(ano),
    carregarQuotasDoAno(ano),
  ]);

  const calculo = paraCalculo(movimentos);
  const saldos = saldosApos(calculo, abertura);

  const hoje = new Date().toISOString().slice(0, 10);
  // Num ano passado ou futuro não há "mês corrente"; mostra-se Dezembro, o
  // fecho do exercício.
  const anoCivil = new Date().getUTCFullYear();
  const mesReferencia = ano === anoCivil ? new Date().getUTCMonth() + 1 : 12;
  const chaveMesReferencia = `${ano}-${String(mesReferencia).padStart(2, "0")}`;
  const doMes = calculo.filter((m) => chaveMes(m.data) === chaveMesReferencia);
  const receitasMes = somar(doMes.map((m) => m.receita));
  const despesasMes = somar(doMes.map((m) => m.despesa));

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
  const nomeMes = `${MESES[mesReferencia - 1]} de ${ano}`;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <p className="font-display text-sm tracking-[0.2em] text-ocre-600 uppercase">
          Exercício de {ano}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em] text-verdete-950">
          Painel
        </h1>
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

      <section aria-labelledby="movimento-mes" className="mb-10">
        <h2
          id="movimento-mes"
          className="mb-4 font-display text-xl font-semibold text-verdete-900"
        >
          {nomeMes}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CartaoKpi rotulo="Receitas do mês" valor={receitasMes} />
          <CartaoKpi rotulo="Despesas do mês" valor={despesasMes} />
          <CartaoKpi
            rotulo="Resultado do mês"
            valor={somar([receitasMes, -despesasMes])}
          />
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
