import type { Metadata } from "next";
import Link from "next/link";
import { Botao, Etiqueta, Painel, Vazio } from "@/components/ui";
import { carregarActas } from "@/lib/dados";
import { dataCurta } from "@/lib/formatos";
import { exigirAdminOuRedirecionar } from "../exigir-admin";
import FormularioNovaActa from "./formulario-nova-acta";

export const metadata: Metadata = { title: "Assembleia de Condóminos · Definições" };

export default async function PaginaDefinicoesActas() {
  await exigirAdminOuRedirecionar();
  const actas = await carregarActas();

  const numeroSugerido = (actas[0]?.numero ?? 0) + 1;
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <Painel
        titulo="Nova Assembleia"
        descricao="Cria a assembleia em rascunho. Define a ordem de trabalhos para gerar as convocatórias e, depois da reunião, as decisões e os presentes para a ata. Os condóminos só veem a ata depois de a publicares."
      >
        <FormularioNovaActa numeroSugerido={numeroSugerido} hoje={hoje} />
      </Painel>

      <Painel
        titulo="Folha de presenças"
        descricao="Documento Word com todas as frações, a permilagem e espaço para a assinatura de cada condómino, para levar para a assembleia."
      >
        <form action="/api/actas/folha-presencas" method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="folha-data" className="text-xs font-medium text-verdete-800">
              Data da assembleia
            </label>
            <input
              id="folha-data"
              name="data"
              type="date"
              required
              defaultValue={hoje}
              className="rounded-lg border border-pergaminho-300 bg-white px-3 py-2 text-sm text-verdete-950 transition-[border-color] duration-150 hover:border-pergaminho-400 focus:border-verdete-500 focus:outline-none"
            />
          </div>
          <Botao type="submit" variante="secundario">
            Gerar folha de presenças
          </Botao>
        </form>
      </Painel>

      <Painel titulo="Atas">
        {actas.length === 0 ? (
          <Vazio>Ainda não há atas.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-pergaminho-200 text-left">
                  <th className="px-3 py-2.5 font-medium text-verdete-800">Ata</th>
                  <th className="px-3 py-2.5 font-medium text-pergaminho-600">Data</th>
                  <th className="px-3 py-2.5 font-medium text-pergaminho-600">Estado</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {actas.map((a) => (
                  <tr key={a.id} className="border-b border-pergaminho-100 last:border-0">
                    <th scope="row" className="px-3 py-2.5 text-left font-medium text-verdete-900">
                      Ata n.º {a.numero}
                    </th>
                    <td className="tabular px-3 py-2.5 text-pergaminho-600">{dataCurta(a.data)}</td>
                    <td className="px-3 py-2.5">
                      {a.estado === "publicada" ? (
                        <Etiqueta tom="positivo">Publicada</Etiqueta>
                      ) : (
                        <Etiqueta tom="aviso">Rascunho</Etiqueta>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={`/definicoes/actas/${a.id}`}
                        className="rounded-md px-3 py-2 text-sm font-medium text-verdete-700 underline-offset-4 transition-colors duration-150 hover:text-verdete-900 hover:underline focus-visible:outline-2 focus-visible:outline-verdete-500 active:text-verdete-950"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </div>
  );
}
