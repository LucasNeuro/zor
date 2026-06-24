import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmApiAccess } from "@/lib/crm/crm-api-auth";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import { disconnectGoogleWorkspaceOAuthIntegracoes } from "@/lib/email/oauth-google";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** DELETE — desliga Gmail + Google Calendar (OAuth) do tenant. */
export async function DELETE(request: NextRequest) {
  const accessErr = await requireCrmApiAccess(request);
  if (accessErr) return accessErr;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();

  try {
    const result = await disconnectGoogleWorkspaceOAuthIntegracoes(supabase, tenantId);
    return NextResponse.json({
      ok: true,
      desconectado: result.desconectado,
      email: result.email ?? null,
      message: result.desconectado
        ? "Conta Google desligada. Pode autorizar outra conta quando quiser."
        : "Nenhuma conta Google estava ligada.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao desligar Google.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
