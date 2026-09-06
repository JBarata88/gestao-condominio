"use client";

import { useMemo, useState } from "react";
import { Botao, Etiqueta } from "@/components/ui";
import { dataCurta, euros, textoIntervaloQuota } from "@/lib/formatos";

export type FracaoEscolha = {
  id: string;
  letra: string;
  andar: string;
  condomino: string | null;
};

/** Um recebimento real de quota, tal como está no livro de movimentos. */
export type MovimentoQuotaEscolha = {
  id: string;
  data: string;
  valor: number;
  fracaoId: string;
  fracaoLetra: string;
  fracaoAndar: string;
  condomino: string | null;
  quotaMes: string | null;
  quotaMesFim: string | null;
  /** Já existe um recibo gerado para este pagamento. */
  temRecibo: boolean;
};

type Tipo = "quota" | "presenca" | "pagamento";

const CLASSE_CAMPO =
  "rounded-lg border border-pergaminho-300 bg-white px-3 py-2.5 text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

export default function FormularioRecibos({
  fracoes,
  pagamentos,
  ano,
  valorPresenca,
}: {
  fracoes: FracaoEscolha[];
  pagamentos: MovimentoQuotaEscolha[];
  ano: number;
  valorPresenca: number;
}) {
  const [tipo, setTipo] = useState<Tipo>("quota");
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [pagamentosEscolhidos, setPagamentosEscolhidos] = useState<string[]>([]);
  const [filtro, setFiltro] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [dataAssembleia, setDataAssembleia] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [servico, setServico] = useState("SERVIÇOS DE LIMPEZA");
  const [periodo, setPeriodo] = useState("");
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function alternar<T>(lista: T[], item: T): T[] {
    return lista.includes(item)
      ? lista.filter((x) => x !== item)
      : [...lista, item];
  }

  const pagamentosFiltrados = useMemo(() => {
    const alvo = filtro.trim().toLowerCase();
    if (!alvo) return pagamentos;
    return pagamentos.filter(
      (p) =>
        p.fracaoLetra.toLowerCase().includes(alvo) ||
        (p.condomino ?? "").toLowerCase().includes(alvo),
    );
  }, [pagamentos, filtro]);

  async function gerar() {
    setErro(null);
    setOcupado(true);
    try {
      const resposta = await fetch("/api/recibos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          fracoes: escolhidas,
          movimentoIds: pagamentosEscolhidos,
          ano,
          data,
          dataAssembleia,
          destinatario,
          servico,
          periodo,
          valor: valor === "" ? undefined : Number(valor.replace(",", ".")),
        }),
      });

      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => ({}));
        setErro(corpo.erro ?? "Não foi possível gerar os recibos.");
        return;
      }

      // O browser não deixa o servidor forçar a gravação sem um clique, por
      // isso o ficheiro é transformado num link temporário e accionado aqui.
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recibos-${tipo}-${data}.docx`;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErro("Falha de rede ao gerar os recibos.");
    } finally {
      setOcupado(false);
    }
  }

  const semNome = fracoes.filter((f) => !f.condomino).length;
  const totalEscolhido = pagamentos
    .filter((p) => pagamentosEscolhidos.includes(p.id))
    .reduce((t, p) => t + p.valor, 0);

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-verdete-800">
          Tipo de recibo
        </legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["quota", "Quota"],
              ["presenca", "Presença em assembleia"],
              ["pagamento", "Documento de caixa"],
            ] as const
          ).map(([valorTipo, rotulo]) => (
            <label
              key={valorTipo}
              className={`cursor-pointer rounded-lg border px-4 py-2.5 text-sm transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-saida)] active:scale-[0.98] ${
                tipo === valorTipo
                  ? "border-verdete-700 bg-verdete-700 font-medium text-pergaminho-50"
                  : "border-pergaminho-300 bg-white text-verdete-800 hover:border-pergaminho-400"
              }`}
            >
              <input
                type="radio"
                name="tipo"
                value={valorTipo}
                checked={tipo === valorTipo}
                onChange={() => setTipo(valorTipo)}
                className="sr-only"
              />
              {rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      {tipo === "quota" && (
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-verdete-800">
            Pagamentos
          </legend>
          <p className="mb-3 text-sm leading-relaxed text-pergaminho-600">
            Cada recibo usa o valor e a data do próprio pagamento, tal como
            está lançado em Movimentos. Escolhe os que queres imprimir.
          </p>

          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar por fração ou nome…"
            className={`${CLASSE_CAMPO} mb-3 w-full sm:max-w-xs`}
          />

          {pagamentos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-pergaminho-300 bg-pergaminho-50 px-4 py-6 text-center text-sm text-pergaminho-600">
              Não há recebimentos de quotas lançados neste exercício.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-lg border border-pergaminho-200">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <caption className="sr-only">
                  Recebimentos de quotas para gerar recibo
                </caption>
                <thead className="sticky top-0 bg-pergaminho-50">
                  <tr>
                    <th scope="col" className="px-2 py-2 text-left font-medium text-verdete-800">
                      <span className="sr-only">Escolher</span>
                    </th>
                    <th scope="col" className="px-2 py-2 text-left font-medium text-verdete-800">
                      Data
                    </th>
                    <th scope="col" className="px-2 py-2 text-left font-medium text-verdete-800">
                      Fração
                    </th>
                    <th scope="col" className="px-2 py-2 text-left font-medium text-verdete-800">
                      Período
                    </th>
                    <th scope="col" className="px-2 py-2 text-right font-medium text-verdete-800">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagamentosFiltrados.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-pergaminho-100 hover:bg-pergaminho-50"
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Recibo de ${p.condomino ?? p.fracaoLetra} em ${dataCurta(p.data)}`}
                          checked={pagamentosEscolhidos.includes(p.id)}
                          onChange={() =>
                            setPagamentosEscolhidos((v) => alternar(v, p.id))
                          }
                          className="size-4 accent-[#274a43]"
                        />
                      </td>
                      <td className="tabular px-2 py-2 whitespace-nowrap text-pergaminho-700">
                        {dataCurta(p.data)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className="font-medium text-verdete-900">
                          {p.fracaoLetra}
                        </span>
                        <span className="text-pergaminho-500"> · {p.condomino}</span>
                      </td>
                      <td className="px-2 py-2 text-pergaminho-600">
                        {textoIntervaloQuota(p.quotaMes, p.quotaMesFim) ??
                          "sem mês definido"}
                        {p.temRecibo && (
                          <span className="ml-2">
                            <Etiqueta tom="neutro">já tem recibo</Etiqueta>
                          </span>
                        )}
                      </td>
                      <td className="tabular px-2 py-2 text-right text-verdete-950">
                        {euros(p.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagamentosEscolhidos.length > 0 && (
            <p className="mt-3 text-sm text-pergaminho-600">
              {pagamentosEscolhidos.length} recibo(s) a gerar, no total de{" "}
              <span className="tabular font-medium text-verdete-900">
                {euros(totalEscolhido)}
              </span>
              .
            </p>
          )}
        </fieldset>
      )}

      {tipo === "presenca" && (
        <>
          <fieldset>
            <legend className="mb-3 text-sm font-medium text-verdete-800">
              Frações
            </legend>
            {semNome > 0 && (
              <p className="mb-3 text-sm text-ocre-700">
                {semNome} fração(ões) sem nome de condómino. Preenche em
                Definições para poderem ser seleccionadas.
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {fracoes.map((f) => (
                <label
                  key={f.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors duration-150 ${
                    f.condomino
                      ? "cursor-pointer border-pergaminho-300 bg-white hover:border-pergaminho-400"
                      : "cursor-not-allowed border-pergaminho-200 bg-pergaminho-50 text-pergaminho-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!f.condomino}
                    checked={escolhidas.includes(f.id)}
                    onChange={() => setEscolhidas((v) => alternar(v, f.id))}
                    className="size-4 accent-[#274a43]"
                  />
                  <span>
                    <span className="font-medium text-verdete-900">
                      {f.letra}
                    </span>
                    <span className="text-pergaminho-500"> · {f.andar}</span>
                    {f.condomino && (
                      <span className="block text-pergaminho-600">
                        {f.condomino}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="assembleia" className="text-sm font-medium text-verdete-800">
                Data da assembleia
              </label>
              <input
                id="assembleia"
                type="date"
                value={dataAssembleia}
                onChange={(e) => setDataAssembleia(e.target.value)}
                className={CLASSE_CAMPO}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="valor-presenca" className="text-sm font-medium text-verdete-800">
                Valor por presença
              </label>
              <input
                id="valor-presenca"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={String(valorPresenca)}
                className={CLASSE_CAMPO}
              />
            </div>
          </div>
        </>
      )}

      {tipo === "pagamento" && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="destinatario" className="text-sm font-medium text-verdete-800">
              Destinatário
            </label>
            <input
              id="destinatario"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="D. MARIA JOSÉ OLIVEIRA"
              className={CLASSE_CAMPO}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="servico" className="text-sm font-medium text-verdete-800">
              Serviço
            </label>
            <input
              id="servico"
              value={servico}
              onChange={(e) => setServico(e.target.value)}
              className={CLASSE_CAMPO}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="periodo" className="text-sm font-medium text-verdete-800">
              Período
            </label>
            <input
              id="periodo"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              placeholder="JANEIRO DE 2026"
              className={CLASSE_CAMPO}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="valor-pagamento" className="text-sm font-medium text-verdete-800">
              Valor
            </label>
            <input
              id="valor-pagamento"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="120"
              className={CLASSE_CAMPO}
            />
          </div>
        </div>
      )}

      {/* Um recibo de quota usa a data do próprio pagamento; só os outros
          dois tipos precisam de uma data de emissão escolhida à mão. */}
      {tipo !== "quota" && (
        <div className="flex flex-col gap-2 sm:max-w-xs">
          <label htmlFor="data-emissao" className="text-sm font-medium text-verdete-800">
            Data de emissão
          </label>
          <input
            id="data-emissao"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className={CLASSE_CAMPO}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Botao
          onClick={gerar}
          disabled={ocupado || (tipo === "quota" && pagamentosEscolhidos.length === 0)}
        >
          {ocupado ? "A gerar…" : "Gerar e descarregar"}
        </Botao>
        {erro && (
          <p role="alert" className="text-sm text-[#a63a2b]">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}
