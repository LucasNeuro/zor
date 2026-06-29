import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveValidatedTenantId } from "@/lib/crm/resolve-tenant-from-caller";
import { sanitizarAgenteHubParaCliente } from "@/lib/hub/sanitize-agente-hub-public";
import { selectHubAgenteWithColumnFallback } from "@/lib/hub/hub-agente-column-compat";

const CANAIS_SELECT =
  "agente_slug, nome, ativo, arquivado_em, modo_operacao, uazapi_instance_id, uazapi_instance_name, uazapi_connection_status, uazapi_instance_token, uazapi_proxy_country, uazapi_proxy_state, uazapi_proxy_city, uazapi_snapshot_at, email_from, email_from_name, email_inbound, email_ativo, email_configured_at";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Lista canais (WhatsApp UAZAPI + e-mail Gmail OAuth) — só leitura do banco, sem chamadas externas. */
export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const tenantResolved = await resolveValidatedTenantId(request);
  if (!tenantResolved.ok) {
    return NextResponse.json([]);
  }

  const supabase = db();

  const { data, error } = await selectHubAgenteWithColumnFallback(
    async (cols) => {
      let q = supabase.from("hub_agente_identidade").select(cols).order("nome");
      const { data: withTenant, error: tenantErr } = await q.eq("tenant_id", tenantResolved.tenantId);
      if (!tenantErr) return { data: withTenant, error: null as null };
      if (/tenant_id/i.test(tenantErr.message) && /column|schema cache|could not find/i.test(tenantErr.message)) {
        return await supabase.from("hub_agente_identidade").select(cols).order("nome");
      }
      return { data: withTenant, error: tenantErr };
    },
    CANAIS_SELECT
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (Array.isArray(data) ? data : []) as unknown as Record<string, unknown>[];
  return NextResponse.json(rows.map(sanitizarAgenteHubParaCliente));
}
