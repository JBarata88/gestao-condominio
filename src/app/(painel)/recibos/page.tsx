import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabecalhoPagina, Painel } from "@/components/ui";
import {
  carregarFracoes,
  carregarMovimentosQuota,
  definicao,
  limitesDoAno,
  perfilAtual,
} from "@/lib/dados";
import { clienteServidor } from "@/lib/supabase/servidor";
import FormularioRecibos, { type MovimentoQuotaEscolha } from "./formulario";

export const metadata: Metadata = { title: "Recibos" };

export default async function PaginaRecibos() {
  const perfil = await perfilAtual();
  if (!perfil?.admin) redirect("/");

  const ano = await definicao<number>("ano_exercicio", new Date().getFullYear());
  const [inicio, fim] = limitesDoAno(ano);

  const [fracoes, movimentosQuota, valorPresenca] = await Promise.all([
    carregarFracoes(),
    carregarMovimentosQuota(inicio, fim),
    definicao<number>("valor_presenca_assembleia", 5),
  ]);

  // Para não gerar sem querer o mesmo recibo duas vezes: um movimento que já
  // tenha um recibo emitido aparece assinalado, mas continua seleccionável,
  // caso seja mesmo preciso reimprimir.
  const supabase = await clienteServidor();
  const { data: comRecibo } = await supabase
    .from("recibos")
    .select("movimento_id")
    .eq("tipo", "quota")
    .not("movimento_id", "is", null);
  const idsComRecibo = new Set(
    (comRecibo ?? []).map((r) => r.movimento_id as string),
  );

  const pagamentos: MovimentoQuotaEscolha[] = movimentosQuota
    .filter((m) => m.fracoes?.condomino_nome)
    .map((m) => ({
      id: m.id,
      data: m.data,
      valor: Number(m.receita),
      fracaoId: m.fracao_id,
      fracaoLetra: m.fracoes!.letra,
      fracaoAndar: m.fracoes!.andar,
      condomino: m.fracoes!.condomino_nome,
      quotaMes: m.quota_mes,
      quotaMesFim: m.quota_mes_fim,
      temRecibo: idsComRecibo.has(m.id),
    }));

  return (
    <div className="mx-auto max-w-5xl">
      <CabecalhoPagina
        sobretitulo="Documentos"
        titulo="Recibos"
        descricao="Os três modelos que já usavas, gerados a partir dos dados das frações. Cabem dois recibos por página, como nos ficheiros originais."
      />

      <Painel>
        <FormularioRecibos
          ano={ano}
          valorPresenca={valorPresenca}
          fracoes={fracoes
            .filter((f) => f.ativo)
            .map((f) => ({
              id: f.id,
              letra: f.letra,
              andar: f.andar,
              condomino: f.condomino_nome,
            }))}
          pagamentos={pagamentos}
        />
      </Painel>
    </div>
  );
}
