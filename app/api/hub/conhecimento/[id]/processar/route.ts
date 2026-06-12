import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  analiseNegocioEstaDesatualizada,
  gerarAnaliseNegocioTenantConhecimento,
  isTenantConhecimentoMigrationMissing,
  lerAnaliseNegocioTenant,
  reindexarDocumentoTenantConhecimentoFromStorage,
} from "@/lib/hub/tenant-conhecimento-rag";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { id } = await params;
  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();

  const { data: doc, error: docErr } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id, tenant_id, bucket_id, object_path, nome_arquivo, mime_type, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (docErr) {
    if (isTenantConhecimentoMigrationMissing(docErr.message)) {
      return NextResponse.json({ error: "Migração de conhecimento ainda não aplicada." }, { status: 503 });
    }
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const indexed = await reindexarDocumentoTenantConhecimentoFromStorage({
    supabase,
    documento: doc as {
      id: string;
      tenant_id: string;
      bucket_id: string;
      object_path: string;
      nome_arquivo: string;
      mime_type?: string | null;
    },
  });

  if (!indexed.ok) {
    return NextResponse.json({ error: indexed.error }, { status: 422 });
  }

  const { data: atualizado } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id, nome_arquivo, titulo, status, chunks_count, erro, resumo_ia, indexado_em")
    .eq("id", id)
    .maybeSingle();

  // Após reindex: sinalizar análise desatualizada; opcionalmente regenerar (propaga a agentes via RAG).
  const { data: docsProntos } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id, indexado_em")
    .eq("tenant_id", tenantId)
    .eq("status", "pronto");

  const cache = await lerAnaliseNegocioTenant(supabase, tenantId);
  const analiseDesatualizada = analiseNegocioEstaDesatualizada(cache, docsProntos ?? []);

  let analiseRegenerada = false;
  const autoRegen = String(process.env.HUB_CONHECIMENTO_AUTO_REGEN_ANALISE ?? "").trim().toLowerCase();
  if (analiseDesatualizada && (autoRegen === "1" || autoRegen === "true")) {
    const regen = await gerarAnaliseNegocioTenantConhecimento({ supabase, tenantId });
    analiseRegenerada = regen.ok;
  }

  return NextResponse.json({
    documento: atualizado ?? {
      id: doc.id,
      status: "pronto",
      chunks_count: indexed.chunks,
      erro: null,
      indexado_em: new Date().toISOString(),
    },
    analise_desatualizada: analiseRegenerada ? false : analiseDesatualizada,
    analise_regenerada: analiseRegenerada,
  });
}
