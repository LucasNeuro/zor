import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { validarMistralPlataforma } from "@/lib/hub/mistral-integracao";

/** POST — valida MISTRAL_API_KEY (ligar integração = chave OK no ambiente). */
export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const res = await validarMistralPlataforma();
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    ligado: true,
    fingerprint: res.fingerprint,
    message:
      "Mistral Document AI disponível. Active «Percepção multimodal» abaixo neste agente para OCR, áudio e visão.",
  });
}
