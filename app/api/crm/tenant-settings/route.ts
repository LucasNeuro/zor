import { NextRequest, NextResponse } from "next/server";
import { crmDb, crmConfigError } from "@/lib/crm/supabase-server";
import { defaultTenantId, isMissingPgColumn, tenantIdFromRequest } from "@/lib/tenant-default";
import { requireCrmAdmin, requireInternalApiKey } from "@/lib/crm/crm-api-auth";

export type TenantSettings = {
  horario_inicio?: string;
  horario_fim?: string;
  timezone?: string;
};

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const { data, error } = await crmDb()
    .from("hub_tenants")
    .select("id, slug, nome_exibicao, settings")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) {
    if (isMissingPgColumn(error, "settings")) {
      return NextResponse.json({ settings: {} as TenantSettings });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const settings = (data?.settings as TenantSettings) ?? {};
  return NextResponse.json({ tenantId, settings });
}

export async function PATCH(request: NextRequest) {
  const adminErr = await requireCrmAdmin(request);
  if (adminErr) return adminErr;

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const body = (await request.json().catch(() => ({}))) as TenantSettings;

  const settings: TenantSettings = {
    horario_inicio: body.horario_inicio?.trim() || "08:00",
    horario_fim: body.horario_fim?.trim() || "18:00",
    timezone: body.timezone?.trim() || "America/Sao_Paulo",
  };

  const { data, error } = await crmDb()
    .from("hub_tenants")
    .update({ settings })
    .eq("id", tenantId)
    .select("settings")
    .maybeSingle();

  if (error) {
    if (isMissingPgColumn(error, "settings")) {
      return NextResponse.json(
        {
          error:
            "Coluna settings em hub_tenants ausente. Aplique a migração 20260522180000_hub_tenants_settings.sql",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data?.settings ?? settings });
}
