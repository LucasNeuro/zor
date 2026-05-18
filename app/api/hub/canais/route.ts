import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sanitizarAgenteHubParaCliente } from "@/lib/hub/sanitize-agente-hub-public";

const CANAIS_SELECT_BASE =
  "agente_slug, nome, modo_operacao, ativo, arquivado_em, uazapi_instance_id, uazapi_instance_name, uazapi_connection_status, uazapi_instance_token";

const CANAIS_SELECT = `${CANAIS_SELECT_BASE}, uazapi_snapshot_at`;

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
  let { data, error } = await supabase.from("hub_agente_identidade").select(CANAIS_SELECT);
  if (error?.message?.includes("uazapi_snapshot_at")) {
    ({ data, error } = await supabase.from("hub_agente_identidade").select(CANAIS_SELECT_BASE));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  return NextResponse.json(rows.map(sanitizarAgenteHubParaCliente));
}
