import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { mem0IntegracaoDisponivel, mem0IntegracaoLigada } from "@/lib/hub/mem0-tenant";

/** GET — plataforma (MEM0_API_KEY no env). */
export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const plataforma = mem0IntegracaoDisponivel();
  const ligado = await mem0IntegracaoLigada();

  return NextResponse.json({
    plataforma,
    ligado,
    configurado: ligado,
    origem: "plataforma",
  });
}
