import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ferramentaIntegradorPorKey,
  type HubIntegradorId,
} from "@/lib/hub/integradores-catalogo";
import {
  fetchIntegracaoComCredenciais,
  type HubIntegracaoCredenciaisRow,
  type HubIntegracaoRow,
} from "@/lib/hub/ferramentas-externas-db";
import { getValidGoogleAccessToken, readStoredGoogleOAuthCredentials } from "@/lib/email/oauth-google";
import {
  montarPayloadEventoGoogleCalendar,
  resumirEventoGoogleCalendar,
  resumirListaEventosGoogleCalendar,
} from "@/lib/hub/google-calendar-api";

const HTTP_TIMEOUT_MS = 30_000;

function credenciaisObj(cred: HubIntegracaoCredenciaisRow | null): Record<string, unknown> {
  if (!cred?.credenciais || typeof cred.credenciais !== "object" || Array.isArray(cred.credenciais)) {
    return {};
  }
  return cred.credenciais as Record<string, unknown>;
}

function bearerToken(cred: HubIntegracaoCredenciaisRow | null): string {
  const o = credenciaisObj(cred);
  return typeof o.bearer_token === "string" ? o.bearer_token.trim() : "";
}

function apiKey(cred: HubIntegracaoCredenciaisRow | null): string {
  const o = credenciaisObj(cred);
  return typeof o.api_key === "string" ? o.api_key.trim() : "";
}

function configObj(integracao: HubIntegracaoRow): Record<string, unknown> {
  if (!integracao.config || typeof integracao.config !== "object" || Array.isArray(integracao.config)) {
    return {};
  }
  return integracao.config as Record<string, unknown>;
}

async function fetchJson(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* texto */
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function executarGoogleCalendar(
  toolName: string,
  args: Record<string, unknown>,
  cred: HubIntegracaoCredenciaisRow | null,
  supabase: SupabaseClient,
  tenantId: string,
  integracaoRowId: string
): Promise<string> {
  let token = bearerToken(cred);
  if (readStoredGoogleOAuthCredentials(cred)) {
    const refreshed = await getValidGoogleAccessToken(supabase, tenantId, cred, integracaoRowId);
    if (refreshed) token = refreshed;
  }
  if (!token) {
    return JSON.stringify({
      erro: "google_calendar_sem_token",
      detalhe: "Ligue a conta Google em Ferramentas → Integrações → Google Calendar (OAuth).",
    });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (toolName === "hub_int_gcal_listar_eventos") {
    const dias = typeof args.dias === "number" && args.dias > 0 ? args.dias : 7;
    const min = new Date().toISOString();
    const max = new Date(Date.now() + dias * 86400000).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(min)}&timeMax=${encodeURIComponent(max)}&singleEvents=true&orderBy=startTime&maxResults=25`;
    const res = await fetchJson(url, { method: "GET", headers });
    if (!res.ok) {
      return JSON.stringify({ erro: "google_calendar_api", status: res.status, detalhe: res.body });
    }
    return JSON.stringify(resumirListaEventosGoogleCalendar(res.body));
  }

  if (toolName === "hub_int_gcal_criar_evento") {
    const titulo = String(args.titulo ?? "").trim();
    const inicio = String(args.inicio ?? "").trim();
    if (!titulo || !inicio) {
      return JSON.stringify({ erro: "parametros_invalidos", campos: ["titulo", "inicio"] });
    }
    const fim = String(args.fim ?? "").trim() || inicio;
    const descricao = String(args.descricao ?? "").trim();
    const participantes = Array.isArray(args.participantes)
      ? (args.participantes as unknown[]).map((e) => String(e).trim()).filter(Boolean)
      : [];
    const comGoogleMeet = args.com_google_meet !== false;

    const { evento, conferenceDataVersion } = montarPayloadEventoGoogleCalendar({
      titulo,
      inicio,
      fim,
      descricao,
      participantes,
      comGoogleMeet,
    });

    const qs = conferenceDataVersion ? "?conferenceDataVersion=1" : "";
    const res = await fetchJson(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events${qs}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(evento),
      }
    );
    if (!res.ok) {
      return JSON.stringify({ erro: "google_calendar_api", status: res.status, detalhe: res.body });
    }
    const resumo = resumirEventoGoogleCalendar(res.body);
    return JSON.stringify({
      ok: true,
      mensagem: resumo?.link_meet
        ? "Evento criado com link Google Meet."
        : "Evento criado no Google Calendar.",
      evento: resumo,
    });
  }

  return JSON.stringify({ erro: "ferramenta_integrador_desconhecida", tool: toolName });
}

async function executarGmail(
  toolName: string,
  args: Record<string, unknown>,
  cred: HubIntegracaoCredenciaisRow | null,
  supabase: SupabaseClient,
  tenantId: string,
  integracaoRowId: string
): Promise<string> {
  let token = bearerToken(cred);
  if (readStoredGoogleOAuthCredentials(cred)) {
    const refreshed = await getValidGoogleAccessToken(supabase, tenantId, cred, integracaoRowId);
    if (refreshed) token = refreshed;
  }
  if (!token) {
    return JSON.stringify({ erro: "gmail_sem_token", detalhe: "Configure OAuth Gmail ou token na integração." });
  }

  if (toolName === "hub_int_gmail_enviar") {
    const para = String(args.para ?? "").trim();
    const assunto = String(args.assunto ?? "").trim();
    const corpo = String(args.corpo ?? "").trim();
    if (!para || !assunto || !corpo) {
      return JSON.stringify({ erro: "parametros_invalidos", campos: ["para", "assunto", "corpo"] });
    }

    const raw = [
      `To: ${para}`,
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
      `Subject: ${assunto}`,
      "",
      corpo,
    ].join("\r\n");
    const encoded = Buffer.from(raw, "utf-8").toString("base64url");

    const res = await fetchJson("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encoded }),
    });
    if (!res.ok) {
      return JSON.stringify({ erro: "gmail_api", status: res.status, detalhe: res.body });
    }
    return JSON.stringify(res.body);
  }

  return JSON.stringify({ erro: "ferramenta_integrador_desconhecida", tool: toolName });
}

async function executarZendesk(
  toolName: string,
  args: Record<string, unknown>,
  integracao: HubIntegracaoRow,
  cred: HubIntegracaoCredenciaisRow | null
): Promise<string> {
  const token = apiKey(cred);
  const cfg = configObj(integracao);
  const subdomain = typeof cfg.subdomain === "string" ? cfg.subdomain.trim().toLowerCase() : "";
  const email = typeof cfg.email === "string" ? cfg.email.trim() : "";

  if (!token || !subdomain) {
    return JSON.stringify({
      erro: "zendesk_incompleto",
      detalhe: "Configure subdomínio e API token na integração Zendesk.",
    });
  }

  const authUser = email || "token";
  const basic = Buffer.from(`${authUser}/token:${token}`, "utf-8").toString("base64");
  const base = `https://${subdomain}.zendesk.com/api/v2`;
  const headers = {
    Authorization: `Basic ${basic}`,
    "Content-Type": "application/json",
  };

  if (toolName === "hub_int_zendesk_criar_ticket") {
    const assunto = String(args.assunto ?? "").trim();
    const descricao = String(args.descricao ?? "").trim();
    if (!assunto || !descricao) {
      return JSON.stringify({ erro: "parametros_invalidos", campos: ["assunto", "descricao"] });
    }
    const solicitante = String(args.email_solicitante ?? "").trim();
    const prioridade = String(args.prioridade ?? "normal").toLowerCase();
    const ticket: Record<string, unknown> = {
      ticket: {
        subject: assunto,
        comment: { body: descricao },
        priority: ["low", "normal", "high", "urgent"].includes(prioridade) ? prioridade : "normal",
      },
    };
    if (solicitante) {
      (ticket.ticket as Record<string, unknown>).requester = { email: solicitante };
    }

    const res = await fetchJson(`${base}/tickets.json`, {
      method: "POST",
      headers,
      body: JSON.stringify(ticket),
    });
    if (!res.ok) {
      return JSON.stringify({ erro: "zendesk_api", status: res.status, detalhe: res.body });
    }
    return JSON.stringify(res.body);
  }

  if (toolName === "hub_int_zendesk_consultar_ticket") {
    const ticketId = String(args.ticket_id ?? "").trim();
    if (!ticketId) {
      return JSON.stringify({ erro: "parametros_invalidos", campos: ["ticket_id"] });
    }
    const res = await fetchJson(`${base}/tickets/${encodeURIComponent(ticketId)}.json`, {
      method: "GET",
      headers,
    });
    if (!res.ok) {
      return JSON.stringify({ erro: "zendesk_api", status: res.status, detalhe: res.body });
    }
    return JSON.stringify(res.body);
  }

  return JSON.stringify({ erro: "ferramenta_integrador_desconhecida", tool: toolName });
}

export async function fetchIntegracaoTenantPorTipo(
  supabase: SupabaseClient,
  tenantId: string,
  tipo: HubIntegradorId
): Promise<{ integracao: HubIntegracaoRow; credenciais: HubIntegracaoCredenciaisRow | null } | null> {
  const { data: integracao } = await supabase
    .from("hub_integracoes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("integracao_id", tipo)
    .eq("ativo", true)
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!integracao?.id) return null;
  return fetchIntegracaoComCredenciais(supabase, tenantId, String(integracao.id));
}

export async function executarFerramentaIntegrador(
  supabase: SupabaseClient,
  tenantId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  const ref = ferramentaIntegradorPorKey(toolName);
  if (!ref) {
    return JSON.stringify({ erro: "integrador_ferramenta_desconhecida", chave: toolName });
  }

  const pack = await fetchIntegracaoTenantPorTipo(supabase, tenantId, ref.integrador.id);
  if (!pack) {
    return JSON.stringify({
      erro: "integracao_nao_configurada",
      integrador: ref.integrador.id,
      detalhe: "Ligue a integração em Ferramentas → Integrações e guarde as credenciais.",
    });
  }

  const { integracao, credenciais } = pack;

  switch (ref.integrador.id) {
    case "google_calendar":
      return executarGoogleCalendar(toolName, args, credenciais, supabase, tenantId, String(integracao.id));
    case "gmail":
      return executarGmail(toolName, args, credenciais, supabase, tenantId, String(integracao.id));
    case "zendesk":
      return executarZendesk(toolName, args, integracao, credenciais);
    default:
      return JSON.stringify({ erro: "integrador_nao_implementado", id: ref.integrador.id });
  }
}
