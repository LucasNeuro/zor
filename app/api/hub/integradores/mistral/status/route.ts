import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import {
  mistralIntegracaoDisponivel,
  mistralIntegracaoFingerprint,
  mistralIntegracaoLigada,
} from "@/lib/hub/mistral-integracao";

/** GET — plataforma (MISTRAL_API_KEY no env). */
export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const plataforma = mistralIntegracaoDisponivel();
  const ligado = await mistralIntegracaoLigada();

  return NextResponse.json({
    plataforma,
    ligado,
    configurado: ligado,
    origem: "plataforma",
    fingerprint: mistralIntegracaoFingerprint(),
  });
}
