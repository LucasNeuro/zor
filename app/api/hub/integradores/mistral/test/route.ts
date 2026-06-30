import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import {
  mistralIntegracaoDisponivel,
  mistralIntegracaoFingerprint,
  validarMistralPlataforma,
} from "@/lib/hub/mistral-integracao";

/** POST — testa MISTRAL_API_KEY do ambiente. */
export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  if (!mistralIntegracaoDisponivel()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Mistral não está configurado neste ambiente (MISTRAL_API_KEY). Contacte o suporte da plataforma.",
      },
      { status: 400 }
    );
  }

  const ping = await validarMistralPlataforma();
  if (!ping.ok) {
    return NextResponse.json({ ok: false, error: ping.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    fingerprint: mistralIntegracaoFingerprint(),
    message: "Ligação com Mistral confirmada (API de modelos).",
  });
}
