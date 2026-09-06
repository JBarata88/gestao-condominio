import type { Metadata } from "next";
import { CabecalhoPagina, Vazio } from "@/components/ui";
import { comSaldoAcumulado } from "@/lib/contas";
import {
  anoDeExercicio,
  carregarCategorias,
  carregarFracoes,
  carregarMovimentos,
  carregarSaldosIniciais,
  limitesDoAno,
  perfilAtual,
} from "@/lib/dados";
import { euros, MESES, somar } from "@/lib/formatos";
import SeccaoConta, { type LinhaConta } from "./seccao-conta";
import FormularioLancamento from "./formulario-lancamento";
import BarraFiltros from "./barra-filtros";

export const metadata: Metadata = { title: "Movimentos" };

export default async function PaginaMovimentos({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    categoria?: string;
    fracao?: string;
    ano?: string;
  }>;
}) {
  const perfil = await perfilAtual();
  const admin = perfil?.admin === true;

  const params = await searchParams;

  const ano = await anoDeExercicio(params.ano);
  const [inicioAno, fimAno] = limitesDoAno(ano);
  const mesNumero = Number(params.mes ?? 0);
  const mes =
    Number.isInteger(mesNumero) && mesNumero >= 1 && mesNumero <= 12
      ? mesNumero
      : null;

  const [movimentos, abertura, categorias, fracoes] = await Promise.all([
    carregarMovimentos(inicioAno, fimAno),
    carregarSaldosIniciais(ano),
    carregarCategorias(),
    carregarFracoes(),
  ]);

  // Só se aceitam identificadores que existam, para um endereço adulterado
  // não deixar a página num estado estranho.
  const categoria =
    params.categoria && categorias.some((c) => c.id === params.categoria)
      ? params.categoria
      : null;
  const fracao =
    params.fracao === "sem" ||
    (params.fracao && fracoes.some((f) => f.id === params.fracao))
      ? params.fracao
      : null;

  const filtroDeConteudo = Boolean(categoria || fracao);

  // O saldo de arrastamento é sempre calculado sobre todos os movimentos do
  // ano. Se fosse calculado só sobre as linhas filtradas, a coluna de saldo
  // deixava de corresponder ao dinheiro que existe na conta.
  const comSaldos = comSaldoAcumulado(
    movimentos.map((m) => ({
      ...m,
      receita: Number(m.receita),
      despesa: Number(m.despesa),
      categoria: m.categorias?.nome ?? "",
      natureza: m.categorias?.natureza ?? "despesa",
      linhaMoaf: m.categorias?.linha_moaf ?? null,
    })),
    abertura,
  ) as unknown as LinhaConta[];

  const dois = (n: number) => String(n).padStart(2, "0");
  const inicioPeriodo = mes ? `${ano}-${dois(mes)}-01` : inicioAno;
  const fimPeriodo = mes
    ? new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10)
    : fimAno;

  const noPeriodo = (l: LinhaConta) =>
    l.data >= inicioPeriodo && l.data <= fimPeriodo;

  const passaFiltros = (l: LinhaConta) => {
    if (!noPeriodo(l)) return false;
    if (categoria && l.categoria_id !== categoria) return false;
    if (fracao === "sem" && l.fracao_id !== null) return false;
    if (fracao && fracao !== "sem" && l.fracao_id !== fracao) return false;
    return true;
  };

  const banco = comSaldos.filter((l) => l.conta === "banco");
  const caixa = comSaldos.filter((l) => l.conta === "caixa");

  /** Saldo real de uma conta numa data, independente dos filtros de conteúdo. */
  const saldoEm = (
    linhas: LinhaConta[],
    limite: string,
    aberturaConta: number,
    conta: "banco" | "caixa",
    inclusivo: boolean,
  ) => {
    const ate = linhas.filter((l) =>
      inclusivo ? l.data <= limite : l.data < limite,
    );
    if (ate.length === 0) return aberturaConta;
    const ultima = ate[ate.length - 1];
    return conta === "banco" ? ultima.saldoBanco : ultima.saldoCaixa;
  };

  const transporteBanco = saldoEm(banco, inicioPeriodo, abertura.depositoOrdem, "banco", false);
  const fechoBanco = saldoEm(banco, fimPeriodo, abertura.depositoOrdem, "banco", true);
  const transporteCaixa = saldoEm(caixa, inicioPeriodo, abertura.caixa, "caixa", false);
  const fechoCaixa = saldoEm(caixa, fimPeriodo, abertura.caixa, "caixa", true);

  const rotuloTransporte =
    mes && mes > 1
      ? `Transporte de ${MESES[mes - 2]}`
      : `Transporte de ${ano - 1}`;

  const visiveis = comSaldos.filter(passaFiltros);
  const receitaTotal = somar(visiveis.map((l) => l.receita));
  const despesaTotal = somar(visiveis.map((l) => l.despesa));

  const nomeCategoria = categorias.find((c) => c.id === categoria)?.nome;
  const nomeFracao =
    fracao === "sem"
      ? "sem fração"
      : fracoes.find((f) => f.id === fracao)?.letra;

  const categoriasAtivas = categorias
    .filter((c) => c.ativo)
    .map((c) => ({ id: c.id, nome: c.nome, natureza: c.natureza }));
  const fracoesAtivas = fracoes
    .filter((f) => f.ativo)
    .map((f) => ({ id: f.id, letra: f.letra, andar: f.andar }));

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina
        sobretitulo={`Exercício de ${ano}`}
        titulo={admin ? "Movimentos" : "Conta corrente"}
        descricao={
          admin
            ? "Banco e caixa em blocos separados, como nas folhas mensais. O saldo é calculado a partir dos movimentos, não guardado."
            : "Movimentos associados à tua fração."
        }
      />

      <BarraFiltros
        mes={mes}
        categoria={categoria}
        fracao={fracao}
        mostrarFracao={admin}
        categorias={categorias
          .filter((c) => c.ativo)
          .map((c) => ({ id: c.id, rotulo: c.nome }))}
        fracoes={fracoes.map((f) => ({
          id: f.id,
          rotulo: `${f.letra} · ${f.andar}`,
        }))}
      />

      {filtroDeConteudo && (
        <p className="mb-6 rounded-lg border border-ocre-200 bg-ocre-50 px-4 py-3 text-sm leading-relaxed text-ocre-800">
          A mostrar apenas{" "}
          {nomeCategoria && <strong>{nomeCategoria}</strong>}
          {nomeCategoria && nomeFracao && " da fração "}
          {!nomeCategoria && nomeFracao && "movimentos da fração "}
          {nomeFracao && <strong>{nomeFracao}</strong>}. A coluna de saldo
          continua a ser o saldo real da conta, que conta com todos os
          movimentos, e não só com os que estão à vista.
        </p>
      )}

      {comSaldos.length === 0 ? (
        <Vazio>Não há movimentos registados em {ano}.</Vazio>
      ) : (
        <div className="flex flex-col gap-6">
          <SeccaoConta
            titulo="Movimentos bancários"
            conta="banco"
            visiveis={banco.filter(passaFiltros)}
            transporte={transporteBanco}
            saldoFinal={fechoBanco}
            rotuloTransporte={rotuloTransporte}
            podeGerir={admin}
            filtrado={filtroDeConteudo}
            categorias={categoriasAtivas}
            fracoes={fracoesAtivas}
            ano={ano}
          />

          <SeccaoConta
            titulo="Caixa"
            conta="caixa"
            visiveis={caixa.filter(passaFiltros)}
            transporte={transporteCaixa}
            saldoFinal={fechoCaixa}
            rotuloTransporte={rotuloTransporte}
            podeGerir={admin}
            filtrado={filtroDeConteudo}
            categorias={categoriasAtivas}
            fracoes={fracoesAtivas}
            ano={ano}
            // A caixa não tem extrato de onde vir, por isso é aqui que os
            // movimentos em numerário são lançados.
            formulario={
              admin ? (
                <FormularioLancamento
                  conta="caixa"
                  ano={ano}
                  categorias={categoriasAtivas}
                  fracoes={fracoesAtivas}
                />
              ) : undefined
            }
          />

          <section className="rounded-xl border border-verdete-800 bg-verdete-800 px-6 py-5 shadow-[var(--shadow-medio)]">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="font-display text-lg font-semibold text-pergaminho-50">
                Total das duas contas
                {mes && (
                  <span className="ml-2 font-sans text-sm font-normal text-verdete-100/70">
                    em {MESES[mes - 1]}
                  </span>
                )}
              </h2>
              <p className="tabular font-display text-2xl font-semibold text-pergaminho-50">
                {euros(somar([fechoBanco, fechoCaixa]))}
              </p>
            </div>
            <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-2 text-sm text-verdete-100/80">
              <div className="flex gap-2">
                <dt>
                  Receitas {filtroDeConteudo ? "do que está à vista" : "do período"}
                </dt>
                <dd className="tabular text-pergaminho-50">
                  {euros(receitaTotal)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt>
                  Despesas {filtroDeConteudo ? "do que está à vista" : "do período"}
                </dt>
                <dd className="tabular text-pergaminho-50">
                  {euros(despesaTotal)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt>Diferença</dt>
                <dd className="tabular text-pergaminho-50">
                  {euros(somar([receitaTotal, -despesaTotal]))}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt>Movimentos</dt>
                <dd className="tabular text-pergaminho-50">{visiveis.length}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
