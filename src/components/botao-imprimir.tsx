"use client";

import { Botao } from "@/components/ui";

/** Abre a caixa de impressão do browser, já com a página formatada para A4. */
export default function BotaoImprimir() {
  return (
    <Botao
      type="button"
      variante="secundario"
      className="print:hidden"
      onClick={() => window.print()}
    >
      Imprimir
    </Botao>
  );
}
