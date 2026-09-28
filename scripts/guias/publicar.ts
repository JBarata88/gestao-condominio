/**
 * Publica os guias em PDF no bucket privado do Supabase Storage, de onde a
 * página "Guias de utilização" os serve.
 *
 *   npx tsx scripts/guias/publicar.ts
 *
 * Cria o bucket na primeira vez, sempre privado: sem políticas de acesso, só a
 * chave de serviço lá chega, e é a rota /api/guias/[guia] que decide quem pode
 * ler cada guia. Os ficheiros existentes são substituídos.
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BUCKET_GUIAS, GUIAS } from "../../src/lib/guias";

const PASTA = "Guias";

function carregarAmbiente() {
  const caminho = join(process.cwd(), ".env.local");
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(linha);
    if (m && m[2].trim() && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  carregarAmbiente();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !servico) throw new Error("Faltam as variáveis do Supabase.");

  const supa = createClient(url, servico, { auth: { persistSession: false } });

  const { data: existente } = await supa.storage.getBucket(BUCKET_GUIAS);
  if (!existente) {
    const { error } = await supa.storage.createBucket(BUCKET_GUIAS, {
      public: false,
      allowedMimeTypes: ["application/pdf"],
    });
    if (error) throw new Error(`criar bucket: ${error.message}`);
    console.log(`Bucket privado "${BUCKET_GUIAS}" criado.`);
  } else if (existente.public) {
    throw new Error(`O bucket "${BUCKET_GUIAS}" é público. Torna-o privado no Supabase antes de publicar.`);
  }

  for (const guia of GUIAS) {
    const local = join(PASTA, guia.nomeDescarga);
    if (!existsSync(local)) {
      console.log(`  ! ${local} não existe; gera-o primeiro com gerar-pdf.ts`);
      continue;
    }
    const { error } = await supa.storage
      .from(BUCKET_GUIAS)
      .upload(guia.ficheiro, readFileSync(local), { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`${guia.ficheiro}: ${error.message}`);
    console.log(`  ok ${guia.ficheiro}`);
  }
}

main().catch((e) => {
  console.error("\nErro:", e.message);
  process.exit(1);
});
