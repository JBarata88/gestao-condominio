import type { Metadata } from "next";
import { Painel } from "@/components/ui";
import FormularioAccao, { Campo } from "@/components/formulario-accao";
import {
  carregarCondominio,
  carregarSaldosIniciais,
  definicao,
} from "@/lib/dados";
import {
  guardarCondominio,
  guardarDefinicoes,
  guardarSaldosIniciais,
} from "../accoes";

export const metadata: Metadata = { title: "Condomínio · Definições" };

export default async function PaginaDefinicoesCondominio() {
  const ano = await definicao<number>("ano_exercicio", new Date().getFullYear());

  const [condominio, saldos] = await Promise.all([
    carregarCondominio(),
    carregarSaldosIniciais(ano),
  ]);

  const diaLimite = await definicao<number>("dia_limite_quota", 8);
  const localidade = await definicao<string>(
    "localidade_recibos",
    "Póvoa de Santa Iria",
  );
  const valorPresenca = await definicao<number>("valor_presenca_assembleia", 5);

  return (
    <div className="flex flex-col gap-6">
      <Painel
        titulo="Identificação do condomínio"
        descricao="Aparece no cabeçalho dos relatórios e dos recibos."
      >
        <FormularioAccao accao={guardarCondominio}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Campo
              nome="nome"
              etiqueta="Nome"
              valor={condominio?.nome}
              obrigatorio
            />
            <Campo
              nome="nif"
              etiqueta="Contribuinte"
              valor={condominio?.nif}
              obrigatorio
            />
            <Campo
              nome="morada"
              etiqueta="Morada"
              valor={condominio?.morada}
              obrigatorio
              className="sm:col-span-2"
            />
            <Campo
              nome="codigo_postal"
              etiqueta="Código postal"
              valor={condominio?.codigo_postal}
            />
            <Campo
              nome="localidade"
              etiqueta="Localidade"
              valor={condominio?.localidade}
            />
            <Campo nome="nib" etiqueta="NIB" valor={condominio?.nib} />
            <Campo nome="iban" etiqueta="IBAN" valor={condominio?.iban} />
          </div>
        </FormularioAccao>
      </Painel>

      <Painel
        titulo="Prazos e exercício"
        descricao="O dia limite determina a partir de quando uma quota conta como atraso."
      >
        <FormularioAccao accao={guardarDefinicoes}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Campo
              nome="dia_limite_quota"
              etiqueta="Dia limite de pagamento das quotas"
              tipo="number"
              min={1}
              max={31}
              valor={diaLimite}
              obrigatorio
              dica="As quotas devem estar pagas até este dia de cada mês."
            />
            <Campo
              nome="ano_exercicio"
              etiqueta="Ano do exercício"
              tipo="number"
              valor={ano}
              obrigatorio
            />
            <Campo
              nome="localidade_recibos"
              etiqueta="Localidade nos recibos"
              valor={localidade}
            />
            <Campo
              nome="valor_presenca_assembleia"
              etiqueta="Valor por presença em assembleia"
              valor={valorPresenca}
              dica="Em euros. Usado nos recibos de presença."
            />
          </div>
        </FormularioAccao>
      </Painel>

      <Painel
        titulo="Saldos de abertura"
        descricao={`Correspondem à secção "Administração anterior" do mapa, para ${ano}.`}
      >
        <FormularioAccao accao={guardarSaldosIniciais}>
          <input type="hidden" name="ano" value={ano} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Campo nome="caixa" etiqueta="Caixa" valor={saldos.caixa} />
            <Campo
              nome="deposito_ordem"
              etiqueta="Depósitos à ordem"
              valor={saldos.depositoOrdem}
            />
            <Campo
              nome="deposito_prazo"
              etiqueta="Depósitos a prazo"
              valor={saldos.depositoPrazo}
            />
            <Campo
              nome="conta_poupanca"
              etiqueta="Conta poupança"
              valor={saldos.contaPoupanca}
            />
          </div>
        </FormularioAccao>
      </Painel>
    </div>
  );
}
