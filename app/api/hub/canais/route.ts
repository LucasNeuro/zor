import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sanitizarAgenteHubParaCliente } from "@/lib/hub/sanitize-agente-hub-public";
import { selectHubAgenteWithColumnFallback } from "@/lib/hub/hub-agente-column-compat";

const CANAIS_SELECT =
  "agente_slug, nome, ativo, arquivado_em, uazapi_instance_id, uazapi_instance_name, uazapi_connection_status, uazapi_instance_token, modo_operacao, uazapi_snapshot_at";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Lista canais WhatsApp — só leitura do banco, sem chamadas UAZAPI. */
export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const supabase = db();

  const { data, error } = await selectHubAgenteWithColumnFallback(
    async (cols) => await supabase.from("hub_agente_identidade").select(cols),
    CANAIS_SELECT
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (Array.isArray(data) ? data : []) as unknown as Record<string, unknown>[];
  return NextResponse.json(rows.map(sanitizarAgenteHubParaCliente));
}
