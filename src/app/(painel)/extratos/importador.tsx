"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao, Etiqueta, Vazio } from "@/components/ui";
import { dataCurta, euros } from "@/lib/formatos";
import SeletorMesQuota from "@/app/(painel)/movimentos/seletor-mes-quota";

type Sugestao = {
  categoriaId: string | null;
  fracaoId: string | null;
  quotaMes: string | null;
  confianca: number;
  motivo: string;
};

type LinhaLida = {
  dataMov: string;
  dataValor: string | null;
  descricao: string;
  valor: number;
  saldo: number | null;
  impressaoDigital: string;
  linhaOrigem: number;
  duplicada: boolean;
  sugestao: Sugestao;
};

type Analise = {
  formato: string;
  aviso?: string;
  nomeFicheiro: string;
  total: number;
  duplicadas: number;
  linhas: LinhaLida[];
  categorias: { id: string; nome: string; natureza: string }[];
  fracoes: { id: string; letra: string; andar: string }[];
};

type Escolha = {
  incluir: boolean;
  categoriaId: string;
  fracaoId: string;
  /** Em ISO completo ("AAAA-MM-01"), ou "" quando não escolhido. */
  quotaMes: string;
  quotaMesFim: string;
};

const CLASSE_SELECT =
  "w-full rounded-md border border-pergaminho-300 bg-white px-2 py-1.5 text-sm text-verdete-950 transition-colors duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

export default function Importador() {
  const router = useRouter();
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [escolhas, setEscolhas] = useState<Escolha[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);
    setOcupado(true);

    try {
      const dados = new FormData(evento.currentTarget);
      const resposta = await fetch("/api/extratos/analisar", {
        method: "POST",
        body: dados,
      });
      const corpo = await resposta.json();

      if (!resposta.ok) {
        setErro(corpo.erro ?? "Não foi possível ler o ficheiro.");
        return;
      }

      const lido = corpo as Analise;
      setAnalise(lido);
      setEscolhas(
        lido.linhas.map((l) => ({
          // Linhas repetidas e sugestões fracas ficam por marcar, para
          // obrigar a uma decisão consciente.
          incluir: !l.duplicada && l.sugestao.confianca >= 0.8,
          categoriaId: l.sugestao.categoriaId ?? "",
          fracaoId: l.sugestao.fracaoId ?? "",
          quotaMes: l.sugestao.quotaMes ?? "",
          quotaMesFim: "",
        })),
      );
    } catch {
      setErro("Falha de rede ao enviar o ficheiro.");
    } finally {
      setOcupado(false);
    }
  }

  async function gravar() {
    if (!analise) return;
    setErro(null);
    setOcupado(true);

    const seleccionadas = analise.linhas
      .map((l, i) => ({ l, e: escolhas[i] }))
      .filter(({ e }) => e.incluir && e.categoriaId);

    if (seleccionadas.length === 0) {
      setErro("Não há nenhuma linha marcada com categoria escolhida.");
      setOcupado(false);
      return;
    }

    try {
      const resposta = await fetch("/api/extratos/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeFicheiro: analise.nomeFicheiro,
          linhas: seleccionadas.map(({ l, e }) => ({
            dataMov: l.dataMov,
            dataValor: l.dataValor,
            descricao: l.descricao,
            valor: l.valor,
            saldo: l.saldo,
            impressaoDigital: l.impressaoDigital,
            linhaOrigem: l.linhaOrigem,
            categoriaId: e.categoriaId,
            fracaoId: e.fracaoId || null,
            quotaMes: e.quotaMes || null,
            quotaMesFim: e.quotaMesFim || null,
          })),
        }),
      });

      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo.erro ?? "Não foi possível gravar.");
        return;
      }

      setSucesso(`${corpo.gravadas} movimento(s) gravados.`);
      setAnalise(null);
      setEscolhas([]);
      router.refresh();
    } catch {
      setErro("Falha de rede ao gravar.");
    } finally {
      setOcupado(false);
    }
  }

  function actualizar(i: number, campo: keyof Escolha, valor: string | boolean) {
    setEscolhas((v) =>
      v.map((e, j) => (i === j ? { ...e, [campo]: valor } : e)),
    );
  }

  /** Categoria "Quotizações", que é a única que precisa do mês da quota. */
  const idCategoriaQuotas = analise?.categorias.find(
    (c) => c.nome === "Quotizações",
  )?.id;

  /**
   * Ao escolher a categoria à mão, se for Quotizações e o mês ainda estiver
   * por preencher, sugere o mês da própria data do movimento como ponto de
   * partida. É só um valor por omissão: o campo continua editável.
   */
  function escolherCategoria(i: number, categoriaId: string) {
    setEscolhas((v) =>
      v.map((e, j) => {
        if (i !== j) return e;
        const precisaDeMes = categoriaId === idCategoriaQuotas && !e.quotaMes;
        if (!precisaDeMes) return { ...e, categoriaId };
        const linha = analise?.linhas[i];
        const ano = linha?.dataMov.slice(0, 4);
        const mes = linha?.dataMov.slice(5, 7);
        return { ...e, categoriaId, quotaMes: `${ano}-${mes}-01` };
      }),
    );
  }

  const marcadas = escolhas.filter((e) => e.incluir).length;

  return (
    <div className="flex flex-col gap-6">
      {!analise && (
        <form onSubmit={enviar} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="ficheiro" className="text-sm font-medium text-verdete-800">
              Ficheiro do extrato
            </label>
            <input
              id="ficheiro"
              name="ficheiro"
              type="file"
              required
              accept=".csv,.txt,.xlsx,.xls,.pdf"
              className="rounded-lg border border-dashed border-pergaminho-400 bg-pergaminho-50 px-4 py-6 text-sm text-verdete-800 transition-colors duration-150 hover:border-verdete-500 hover:bg-pergaminho-100 focus:outline-none"
            />
            <p className="text-sm text-pergaminho-500">
              CSV, XLSX ou PDF exportado do homebanking. Nada é gravado antes de
              confirmares.
            </p>
          </div>

          <div>
            <Botao type="submit" disabled={ocupado}>
              {ocupado ? "A ler…" : "Ler ficheiro"}
            </Botao>
          </div>
        </form>
      )}

      {erro && (
        <p role="alert" className="rounded-lg border border-[#a63a2b]/25 bg-[#a63a2b]/8 px-4 py-3 text-sm text-[#7d2c20]">
          {erro}
        </p>
      )}
      {sucesso && (
        <p role="status" className="rounded-lg border border-[#3f7a4e]/25 bg-[#3f7a4e]/10 px-4 py-3 text-sm text-[#2f5c3b]">
          {sucesso}
        </p>
      )}

      {analise && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Etiqueta tom="neutro">{analise.total} linhas lidas</Etiqueta>
            {analise.duplicadas > 0 && (
              <Etiqueta tom="aviso">
                {analise.duplicadas} já importadas antes
              </Etiqueta>
            )}
            <Etiqueta tom="positivo">{marcadas} marcadas para gravar</Etiqueta>
          </div>

          {analise.aviso && (
            <p className="rounded-lg border border-ocre-200 bg-ocre-50 px-4 py-3 text-sm text-ocre-800">
              {analise.aviso}
            </p>
          )}

          {analise.linhas.length === 0 ? (
            <Vazio>Não foram encontrados movimentos neste ficheiro.</Vazio>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[60rem] border-collapse text-sm">
                <caption className="sr-only">
                  Linhas lidas do extrato, para revisão antes de gravar
                </caption>
                <thead>
                  <tr className="border-b border-pergaminho-300">
                    <th scope="col" className="px-2 py-2.5 text-left font-medium text-verdete-800">
                      Gravar
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-left font-medium text-verdete-800">
                      Data
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-left font-medium text-verdete-800">
                      Descrição
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium text-verdete-800">
                      Valor
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-left font-medium text-verdete-800">
                      Categoria
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-left font-medium text-verdete-800">
                      Fração
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-left font-medium text-verdete-800">
                      Mês da quota
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analise.linhas.map((l, i) => (
                    <tr
                      // A linha de origem no ficheiro é única por definição,
                      // por isso a chave aguenta mesmo que duas impressões
                      // digitais alguma vez voltem a coincidir.
                      key={`${l.linhaOrigem}-${l.impressaoDigital}`}
                      className={`border-b border-pergaminho-100 ${
                        l.duplicada ? "bg-ocre-50/60" : ""
                      }`}
                    >
                      <td className="px-2 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Gravar movimento de ${dataCurta(l.dataMov)}`}
                          checked={escolhas[i]?.incluir ?? false}
                          onChange={(e) => actualizar(i, "incluir", e.target.checked)}
                          className="size-4 accent-[#274a43]"
                        />
                      </td>
                      <td className="tabular px-2 py-2.5 whitespace-nowrap text-pergaminho-700">
                        {dataCurta(l.dataMov)}
                      </td>
                      <td className="px-2 py-2.5 text-verdete-900">
                        {l.descricao}
                        {l.duplicada && (
                          <span className="ml-2">
                            <Etiqueta tom="aviso">repetida</Etiqueta>
                          </span>
                        )}
                        {l.sugestao.motivo && l.sugestao.confianca > 0 && (
                          <span className="block text-xs text-pergaminho-500">
                            {l.sugestao.motivo}
                          </span>
                        )}
                      </td>
                      <td
                        className={`tabular px-2 py-2.5 text-right whitespace-nowrap ${
                          l.valor > 0 ? "text-[#2f5c3b]" : "text-[#7d2c20]"
                        }`}
                      >
                        {euros(l.valor)}
                      </td>
                      <td className="px-2 py-2.5">
                        <select
                          aria-label="Categoria"
                          value={escolhas[i]?.categoriaId ?? ""}
                          onChange={(e) => escolherCategoria(i, e.target.value)}
                          className={CLASSE_SELECT}
                        >
                          <option value="">Escolher…</option>
                          {analise.categorias.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2.5">
                        <select
                          aria-label="Fração"
                          value={escolhas[i]?.fracaoId ?? ""}
                          onChange={(e) => actualizar(i, "fracaoId", e.target.value)}
                          className={CLASSE_SELECT}
                        >
                          <option value="">—</option>
                          {analise.fracoes.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.letra} · {f.andar}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2.5">
                        {/* Só faz sentido perguntar o mês quando a categoria é
                            Quotizações. É uma anotação: a fração já basta
                            para o pagamento entrar na conta corrente da
                            fração em Quotas, o mês não muda esse cálculo. */}
                        {escolhas[i]?.categoriaId === idCategoriaQuotas ? (
                          <SeletorMesQuota
                            idPrefix={`mes-${i}`}
                            ano={Number(l.dataMov.slice(0, 4))}
                            valor={{
                              de: escolhas[i]?.quotaMes
                                ? escolhas[i].quotaMes.slice(0, 7)
                                : "",
                              ate: escolhas[i]?.quotaMesFim
                                ? escolhas[i].quotaMesFim.slice(0, 7)
                                : "",
                            }}
                            aoMudar={(novo) =>
                              setEscolhas((v) =>
                                v.map((e, j) =>
                                  i === j
                                    ? {
                                        ...e,
                                        quotaMes: novo.de ? `${novo.de}-01` : "",
                                        quotaMesFim: novo.ate ? `${novo.ate}-01` : "",
                                      }
                                    : e,
                                ),
                              )
                            }
                          />
                        ) : (
                          <span className="text-pergaminho-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Botao onClick={gravar} disabled={ocupado || marcadas === 0}>
              {ocupado ? "A gravar…" : `Gravar ${marcadas} movimento(s)`}
            </Botao>
            <Botao
              variante="secundario"
              onClick={() => {
                setAnalise(null);
                setEscolhas([]);
                setErro(null);
              }}
            >
              Cancelar
            </Botao>
          </div>
        </>
      )}
    </div>
  );
}
