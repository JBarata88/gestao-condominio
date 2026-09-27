import type { Metadata } from "next";
import { Painel } from "@/components/ui";
import FormularioAccao from "@/components/formulario-accao";
import { anoDeExercicio, carregarFracoes, carregarSegurosDoAno } from "@/lib/dados";
import { MARCADOR_SEGUROS } from "@/lib/relatorios/acta-marcador";
import { guardarSegurosDoAno } from "../accoes";
import { exigirAdminOuRedirecionar } from "../exigir-admin";

export const metadata: Metadata = { title: "Apólices e recibos · Definições" };

const CAIXA = "size-5 cursor-pointer accent-verdete-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdete-500";

export default async function PaginaDefinicoesSeguros({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  await exigirAdminOuRedirecionar();

  const { ano: anoParam } = await searchParams;
  const ano = await anoDeExercicio(anoParam);
  const [fracoes, seguros] = await Promise.all([carregarFracoes(), carregarSegurosDoAno(ano)]);
  const ativas = fracoes.filter((f) => f.ativo);

  const apolices = ativas.filter((f) => seguros.get(f.id)?.apolice).length;
  const recibos = ativas.filter((f) => seguros.get(f.id)?.recibo).length;

  return (
    <Painel
      titulo={`Apólices e recibos de ${ano}`}
      descricao={`Marca as frações que já entregaram a cópia da apólice do seguro de habitação e o recibo do pagamento. Para mostrar esta tabela numa ata, usa o botão "Inserir tabela de apólices" num tópico (ou escreve ${MARCADOR_SEGUROS} numa linha sozinha).`}
    >
      <p className="mb-4 text-sm text-pergaminho-600">
        Entregues: <span className="tabular font-medium text-verdete-900">{apolices}</span> de{" "}
        {ativas.length} apólices, <span className="tabular font-medium text-verdete-900">{recibos}</span> de{" "}
        {ativas.length} recibos.
      </p>

      <FormularioAccao accao={guardarSegurosDoAno}>
        <input type="hidden" name="ano" value={ano} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-pergaminho-200 text-left">
                <th className="px-3 py-2.5 font-medium text-verdete-800">Fração</th>
                <th className="px-3 py-2.5 font-medium text-pergaminho-600">Condómino</th>
                <th className="px-3 py-2.5 text-center font-medium text-pergaminho-600">Apólice</th>
                <th className="px-3 py-2.5 text-center font-medium text-pergaminho-600">Recibo</th>
              </tr>
            </thead>
            <tbody>
              {ativas.map((f) => {
                const s = seguros.get(f.id);
                return (
                  <tr key={f.id} className="border-b border-pergaminho-100 last:border-0">
                    <th scope="row" className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-verdete-900">
                      <input type="hidden" name="fracao" value={f.id} />
                      {f.letra}
                      <span className="font-normal text-pergaminho-500"> · {f.andar}</span>
                    </th>
                    <td className="px-3 py-2.5 text-pergaminho-700">{f.condomino_nome ?? "—"}</td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        name={`apolice-${f.id}`}
                        defaultChecked={s?.apolice ?? false}
                        aria-label={`Fração ${f.letra} entregou a apólice`}
                        className={CAIXA}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        name={`recibo-${f.id}`}
                        defaultChecked={s?.recibo ?? false}
                        aria-label={`Fração ${f.letra} entregou o recibo`}
                        className={CAIXA}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FormularioAccao>
    </Painel>
  );
}
