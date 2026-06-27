import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { mem0Ping, resolverMem0ApiKey } from "@/lib/hub/mem0-api";
import { mem0PlataformaConfigurada } from "@/lib/hub/mem0-env";

/** POST — testa MEM0_API_KEY do ambiente. */
export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  if (!mem0PlataformaConfigurada()) {
    return NextResponse.json(
      { ok: false, error: "Defina MEM0_API_KEY no ambiente (Render ou .env local)." },
      { status: 400 }
    );
  }

  const apiKey = await resolverMem0ApiKey();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "MEM0_API_KEY vazia." }, { status: 400 });
  }

  const ping = await mem0Ping(apiKey);
  if (!ping.ok) {
    return NextResponse.json({ ok: false, error: ping.erro ?? "Falha no teste Mem0." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    message: "Conexão Mem0 OK — MEM0_API_KEY válida.",
  });
}
