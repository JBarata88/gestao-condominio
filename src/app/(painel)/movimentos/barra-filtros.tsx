import { MESES } from "@/lib/formatos";

export type OpcaoFiltro = { id: string; rotulo: string };

/**
 * Filtros dos movimentos.
 *
 * É um formulário GET simples, sem JavaScript: os filtros ficam no endereço,
 * por isso um filtro pode ser guardado nos favoritos ou enviado a alguém.
 */
export default function BarraFiltros({
  mes,
  categoria,
  fracao,
  categorias,
  fracoes,
  mostrarFracao,
}: {
  mes: number | null;
  categoria: string | null;
  fracao: string | null;
  categorias: OpcaoFiltro[];
  fracoes: OpcaoFiltro[];
  /** Esconde o filtro de fração quando não há frações para escolher. */
  mostrarFracao: boolean;
}) {
  const comFiltro = Boolean(categoria || fracao);

  /** Mantém os filtros de conteúdo ao saltar de mês. */
  const hrefMes = (novoMes: number | null) => {
    const p = new URLSearchParams();
    if (novoMes) p.set("mes", String(novoMes));
    if (categoria) p.set("categoria", categoria);
    if (fracao) p.set("fracao", fracao);
    const q = p.toString();
    return q ? `/movimentos?${q}` : "/movimentos";
  };

  const classeSelect =
    "rounded-lg border border-pergaminho-300 bg-white px-3 py-2 text-sm text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none";

  return (
    <div className="mb-6 flex flex-col gap-4">
      <nav aria-label="Filtrar por mês" className="flex flex-wrap gap-2">
        <PastilhaMes activo={!mes} href={hrefMes(null)} rotulo="Ano inteiro" />
        {MESES.map((nome, i) => (
          <PastilhaMes
            key={nome}
            activo={mes === i + 1}
            href={hrefMes(i + 1)}
            rotulo={nome.slice(0, 3)}
          />
        ))}
      </nav>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-pergaminho-200 bg-white px-4 py-3 shadow-[var(--shadow-baixo)]"
      >
        {/* O mês vem das pastilhas acima e tem de sobreviver à submissão. */}
        {mes && <input type="hidden" name="mes" value={mes} />}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filtro-categoria"
            className="text-xs font-medium tracking-wide text-pergaminho-600 uppercase"
          >
            Categoria
          </label>
          <select
            id="filtro-categoria"
            name="categoria"
            defaultValue={categoria ?? ""}
            className={classeSelect}
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </div>

        {mostrarFracao && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="filtro-fracao"
              className="text-xs font-medium tracking-wide text-pergaminho-600 uppercase"
            >
              Fração
            </label>
            <select
              id="filtro-fracao"
              name="fracao"
              defaultValue={fracao ?? ""}
              className={classeSelect}
            >
              <option value="">Todas</option>
              <option value="sem">Sem fração associada</option>
              {fracoes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          className="rounded-lg bg-verdete-700 px-4 py-2 text-sm font-medium text-pergaminho-50 shadow-[var(--shadow-baixo)] transition-[transform,background-color] duration-200 ease-[var(--ease-mola)] hover:-translate-y-0.5 hover:bg-verdete-600 active:translate-y-0 active:bg-verdete-800"
        >
          Filtrar
        </button>

        {comFiltro && (
          <a
            href={mes ? `/movimentos?mes=${mes}` : "/movimentos"}
            className="rounded-lg px-3 py-2 text-sm text-pergaminho-600 underline-offset-4 transition-colors duration-150 hover:text-verdete-700 hover:underline"
          >
            Limpar filtros
          </a>
        )}
      </form>
    </div>
  );
}

function PastilhaMes({
  activo,
  href,
  rotulo,
}: {
  activo: boolean;
  href: string;
  rotulo: string;
}) {
  return (
    <a
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`rounded-lg border px-3 py-1.5 text-sm transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-saida)] active:scale-[0.98] ${
        activo
          ? "border-verdete-700 bg-verdete-700 font-medium text-pergaminho-50"
          : "border-pergaminho-300 bg-white text-verdete-800 hover:border-pergaminho-400 hover:bg-pergaminho-50"
      }`}
    >
      {rotulo}
    </a>
  );
}
