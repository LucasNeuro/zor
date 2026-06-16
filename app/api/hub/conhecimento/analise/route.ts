import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  analiseNegocioEstaDesatualizada,
  gerarAnaliseNegocioTenantConhecimento,
  isTenantConhecimentoMigrationMissing,
  lerAnaliseNegocioTenant,
  limparAnaliseNegocioTenant,
} from "@/lib/hub/tenant-conhecimento-rag";
import { propagarCatalogoAposConhecimento } from "@/lib/crm/servicos-catalogo";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function documentosProntos(supabase: ReturnType<typeof db>, tenantId: string) {
  const { data, error } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id, indexado_em")
    .eq("tenant_id", tenantId)
    .eq("status", "pronto");

  if (error) {
    if (isTenantConhecimentoMigrationMissing(error.message)) {
      return { docs: [] as Array<{ id: string; indexado_em: string | null }>, migrationMissing: true };
    }
    throw new Error(error.message);
  }

  return { docs: data ?? [], migrationMissing: false };
}

export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();

  try {
    const { docs, migrationMissing } = await documentosProntos(supabase, tenantId);
    if (migrationMissing) {
      return NextResponse.json({
        analise: null,
        gerado_em: null,
        documentos_indexados: 0,
        desatualizada: true,
        aviso: "Migração de conhecimento ainda não aplicada.",
      });
    }

    if (docs.length === 0) {
      const cache = await lerAnaliseNegocioTenant(supabase, tenantId);
      if (cache) await limparAnaliseNegocioTenant(supabase, tenantId);
      return NextResponse.json({
        analise: null,
        gerado_em: null,
        documentos_usados: 0,
        documentos_indexados: 0,
        desatualizada: true,
      });
    }

    const cache = await lerAnaliseNegocioTenant(supabase, tenantId);
    const desatualizada = analiseNegocioEstaDesatualizada(cache, docs);

    return NextResponse.json({
      analise: cache?.analise ?? null,
      gerado_em: cache?.gerado_em ?? null,
      documentos_usados: cache?.documentos_usados ?? 0,
      documentos_indexados: docs.length,
      desatualizada,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao ler análise." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();

  const out = await gerarAnaliseNegocioTenantConhecimento({ supabase, tenantId });
  if (!out.ok) {
    const status = out.code === "sem_documentos" ? 409 : 502;
    return NextResponse.json({ error: out.error }, { status });
  }

  const catalogoSync = await propagarCatalogoAposConhecimento(supabase, tenantId);

  return NextResponse.json({
    analise: out.cache.analise,
    gerado_em: out.cache.gerado_em,
    documentos_usados: out.cache.documentos_usados,
    documentos_indexados: out.cache.documentos_usados,
    desatualizada: false,
    catalogo_sync: catalogoSync,
  });
}
