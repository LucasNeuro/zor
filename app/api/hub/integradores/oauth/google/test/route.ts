import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmApiAccess } from "@/lib/crm/crm-api-auth";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import { fetchGmailProfile } from "@/lib/email/gmail-inbox";
import { getValidGoogleAccessToken, readStoredGoogleOAuthCredentials } from "@/lib/email/oauth-google";
import type { HubIntegracaoCredenciaisRow } from "@/lib/hub/ferramentas-externas-db";
import { resumirListaEventosGoogleCalendar } from "@/lib/hub/google-calendar-api";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function tokenGoogle(
  supabase: ReturnType<typeof db>,
  tenantId: string,
  integracaoRowId: string,
  cred: HubIntegracaoCredenciaisRow | null
): Promise<string | null> {
  let token =
    cred?.credenciais &&
    typeof cred.credenciais === "object" &&
    !Array.isArray(cred.credenciais) &&
    typeof (cred.credenciais as Record<string, unknown>).bearer_token === "string"
      ? String((cred.credenciais as Record<string, unknown>).bearer_token).trim()
      : "";

  if (readStoredGoogleOAuthCredentials(cred)) {
    const refreshed = await getValidGoogleAccessToken(supabase, tenantId, cred, integracaoRowId);
    if (refreshed) token = refreshed;
  }
  return token || null;
}

/**
 * POST — testa Gmail + Calendar com tokens OAuth do tenant (wizard / painel integrações).
 */
export async function POST(request: NextRequest) {
  const accessErr = await requireCrmApiAccess(request);
  if (accessErr) return accessErr;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();

  const { data: integracao, error: intErr } = await supabase
    .from("hub_integracoes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("integracao_id", "gmail")
    .maybeSingle();

  if (intErr) {
    return NextResponse.json({ ok: false, error: intErr.message }, { status: 500 });
  }
  if (!integracao?.id) {
    return NextResponse.json(
      { ok: false, error: "gmail_nao_ligado", detalhe: "Ligue a conta Google antes de testar." },
      { status: 400 }
    );
  }

  const integracaoId = String(integracao.id);

  const { data: credRow, error: credErr } = await supabase
    .from("hub_integracao_credenciais")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("integracao_id", integracaoId)
    .maybeSingle();

  if (credErr) {
    return NextResponse.json({ ok: false, error: credErr.message }, { status: 500 });
  }

  const cred = (credRow as HubIntegracaoCredenciaisRow | null) ?? null;
  const token = await tokenGoogle(supabase, tenantId, integracaoId, cred);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "google_sem_token", detalhe: "Token OAuth ausente ou expirado. Ligue novamente." },
      { status: 400 }
    );
  }

  const gmail = await fetchGmailProfile(token);
  if (!gmail.ok) {
    return NextResponse.json(
      { ok: false, error: gmail.error, detalhe: "Falha ao ler perfil Gmail." },
      { status: 502 }
    );
  }

  const min = new Date().toISOString();
  const max = new Date(Date.now() + 7 * 86400000).toISOString();
  const calUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(min)}&timeMax=${encodeURIComponent(max)}&singleEvents=true&orderBy=startTime&maxResults=5`;

  const calRes = await fetch(calUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const calText = await calRes.text();
  let calBody: unknown = calText;
  try {
    calBody = JSON.parse(calText);
  } catch {
    /* texto */
  }

  if (!calRes.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "google_calendar_api",
        gmail_email: gmail.emailAddress,
        status: calRes.status,
        detalhe: calBody,
      },
      { status: 502 }
    );
  }

  const resumo = resumirListaEventosGoogleCalendar(calBody);

  return NextResponse.json({
    ok: true,
    gmail_email: gmail.emailAddress,
    calendar: resumo,
    mensagem: "Gmail e Google Calendar respondem com sucesso.",
  });
}
