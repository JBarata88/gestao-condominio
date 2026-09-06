import type { Metadata } from "next";
import { Painel } from "@/components/ui";
import { perfilAtual } from "@/lib/dados";
import { clienteAdministrativo } from "@/lib/supabase/servidor";
import type { Fracao, Perfil } from "@/lib/tipos-bd";
import GestorContas, {
  type ContaVista,
  type FracaoOpcao,
} from "./gestor-contas";

export const metadata: Metadata = { title: "Contas · Definições" };

export default async function PaginaDefinicoesContas() {
  const perfil = await perfilAtual();

  let dados:
    | { ok: true; contas: ContaVista[]; fracoes: FracaoOpcao[] }
    | { ok: false; mensagem: string };

  try {
    const supabase = clienteAdministrativo();

    const [utilizadores, perfis, fracoes] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from("profiles").select("*"),
      supabase.from("fracoes").select("*").order("ordem", { ascending: true }),
    ]);

    if (utilizadores.error) throw utilizadores.error;
    if (perfis.error) throw perfis.error;
    if (fracoes.error) throw fracoes.error;

    const emailPorId = new Map(
      utilizadores.data.users.map((u) => [u.id, u.email ?? "(sem email)"]),
    );

    const opcoes: FracaoOpcao[] = ((fracoes.data ?? []) as Fracao[]).map((f) => ({
      id: f.id,
      letra: f.letra,
      andar: f.andar,
      administracao: f.administracao,
    }));

    const contas: ContaVista[] = ((perfis.data ?? []) as Perfil[])
      .map((p) => ({
        id: p.id,
        email: emailPorId.get(p.id) ?? "(conta sem login)",
        nome: p.nome,
        papel: p.papel,
        fracaoId: p.fracao_id,
        euProprio: p.id === perfil?.id,
      }))
      // Contas por atribuir primeiro, depois a própria, depois por nome.
      .sort((a, b) => {
        const porAtribuir = (c: ContaVista) =>
          !c.fracaoId && c.papel !== "admin" ? 0 : 1;
        if (porAtribuir(a) !== porAtribuir(b))
          return porAtribuir(a) - porAtribuir(b);
        return (a.nome ?? a.email).localeCompare(b.nome ?? b.email, "pt");
      });

    dados = { ok: true, contas, fracoes: opcoes };
  } catch (e) {
    dados = { ok: false, mensagem: (e as Error).message };
  }

  if (!dados.ok) {
    return (
      <Painel titulo="Gestão de contas indisponível">
        <p className="leading-relaxed text-pergaminho-600">
          Para criar e gerir contas a partir daqui é preciso a chave de serviço
          do Supabase na variável <code>SUPABASE_SERVICE_ROLE_KEY</code> do{" "}
          <code>.env.local</code> (Definições &gt; API &gt; service_role).
        </p>
        <p className="mt-3 text-sm text-pergaminho-500">Detalhe: {dados.mensagem}</p>
      </Painel>
    );
  }

  return <GestorContas contas={dados.contas} fracoes={dados.fracoes} />;
}
