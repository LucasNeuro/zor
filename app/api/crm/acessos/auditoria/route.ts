import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireCrmAdmin } from "@/lib/crm/crm-api-auth";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

const LOG_SELECT =
  "id, tenant_id, actor_user_id, actor_auth_id, actor_nome, actor_email, acao, entidade, entidade_id, resumo, metadata, criado_em";

async function resolveTenantIdFromCaller(request: NextRequest): Promise<string> {
  const fallbackTenant = tenantIdFromRequest(request.headers) || defaultTenantId();
  const callerAuthId = request.headers.get("x-caller-auth-id")?.trim();
  if (!callerAuthId) return fallbackTenant;

  const { data } = await crmDb()
    .from("users")
    .select("tenant_id")
    .eq("auth_id", callerAuthId)
    .maybeSingle();

  return String(data?.tenant_id ?? fallbackTenant);
}

export async function GET(request: NextRequest) {
  const adminErr = await requireCrmAdmin(request);
  if (adminErr) return adminErr;

  const tenantId = await resolveTenantIdFromCaller(request);
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "100");
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 500);

  const { data, error } = await crmDb()
    .from("hub_auditoria_sistema")
    .select(LOG_SELECT)
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return NextResponse.json({
        data: [],
        warning: "Tabela hub_auditoria_sistema ainda não existe. Aplique a migration no Supabase.",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
