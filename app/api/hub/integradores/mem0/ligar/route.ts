import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { validarMem0Plataforma } from "@/lib/hub/mem0-tenant";

/** POST — valida MEM0_API_KEY (ligar integração = chave OK no ambiente). */
export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const res = await validarMem0Plataforma();
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    ligado: true,
    message: "Mem0 disponível. Active as ferramentas na secção Integrações ligadas deste agente.",
  });
}
