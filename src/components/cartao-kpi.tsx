import { euros } from "@/lib/formatos";

type Tom = "neutro" | "destaque" | "alerta";

const TONS: Record<Tom, { cartao: string; valor: string; rotulo: string }> = {
  neutro: {
    cartao: "bg-white border-pergaminho-200",
    valor: "text-verdete-950",
    rotulo: "text-pergaminho-600",
  },
  destaque: {
    cartao: "bg-verdete-800 border-verdete-900",
    valor: "text-pergaminho-50",
    rotulo: "text-verdete-100/70",
  },
  alerta: {
    cartao: "bg-ocre-50 border-ocre-200",
    valor: "text-ocre-800",
    rotulo: "text-ocre-700/80",
  },
};

export default function CartaoKpi({
  rotulo,
  valor,
  nota,
  tom = "neutro",
  moeda = true,
}: {
  rotulo: string;
  valor: number | string;
  nota?: string;
  tom?: Tom;
  moeda?: boolean;
}) {
  const t = TONS[tom];
  const texto =
    typeof valor === "number" && moeda ? euros(valor) : String(valor);

  return (
    <article
      className={`rounded-xl border p-5 shadow-[var(--shadow-baixo)] transition-[transform,box-shadow] duration-200 ease-[var(--ease-saida)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-medio)] ${t.cartao}`}
    >
      <p className={`text-sm ${t.rotulo}`}>{rotulo}</p>
      <p
        className={`tabular mt-2 font-display text-3xl font-semibold tracking-[-0.03em] ${t.valor}`}
      >
        {texto}
      </p>
      {nota && <p className={`mt-1.5 text-sm ${t.rotulo}`}>{nota}</p>}
    </article>
  );
}
