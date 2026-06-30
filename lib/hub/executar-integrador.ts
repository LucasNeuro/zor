import type { SupabaseClient } from "@supabase/supabase-js";
import {
  consultarSupabaseExterno,
  credenciaisSupabaseExternoDeRow,
} from "@/lib/hub/supabase-externo-query";
import { HUB_INT_SUPABASE_EXTERNO_CONSULTAR } from "@/lib/hub/supabase-externo-constants";
import {
  CRM_INTEGRADOR_BUILTIN_MAP,
  parseCrmEntidadeToolKey,
  WAJE_CRM_INTEGRADOR_ID,
} from "@/lib/hub/crm-integrador-constants";
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
import { sendGmailEmail } from "@/lib/email/gmail-send";
import {
  montarPayloadEventoGoogleCalendar,
  resumirEventoGoogleCalendar,
  resumirListaEventosParaDisponibilidade,
  linkEventoParaWhatsapp,
} from "@/lib/hub/google-calendar-api";
import {
  GCAL_LEAD_PROP,
  montarExtendedPropertiesLead,
  normalizarFimParaGoogleCalendar,
  normalizarInicioParaGoogleCalendar,
} from "@/lib/hub/google-calendar-datetime";
import {
  gravarReservaGcalNoLead,
  removerReservaGcalDoLead,
  reservasLeadParaRespostaCliente,
  type LeadGcalReserva,
} from "@/lib/hub/google-calendar-lead";
import { lerTenantAgendaConfig } from "@/lib/hub/tenant-agenda-config";

export type GcalFerramentaContexto = {
  leadId?: string;
  telefone?: string | null;
  agenteSlug?: string;
  agenteInterno?: boolean;
  usuarioCrmId?: string | null;
  tenantId?: string;
};

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
  integracaoRowId: string,
  gcalCtx?: GcalFerramentaContexto
): Promise<string> {
  const agendaCfg = await lerTenantAgendaConfig(supabase, tenantId);
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
    const dataFoco = typeof args.data === "string" ? args.data.trim() : "";
    const min = new Date().toISOString();
    const max = new Date(Date.now() + dias * 86400000).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(min)}&timeMax=${encodeURIComponent(max)}&singleEvents=true&orderBy=startTime&maxResults=50`;
    const res = await fetchJson(url, { method: "GET", headers });
    if (!res.ok) {
      return JSON.stringify({ erro: "google_calendar_api", status: res.status, detalhe: res.body });
    }
    return JSON.stringify(
      resumirListaEventosParaDisponibilidade(res.body, {
        dias,
        dataFoco: dataFoco || undefined,
        cfg: agendaCfg,
      })
    );
  }

  if (toolName === "hub_int_gcal_criar_evento") {
    const titulo = String(args.titulo ?? "").trim();
    const inicioRaw = String(args.inicio ?? "").trim();
    const horaCliente = typeof args.hora_cliente === "string" ? args.hora_cliente.trim() : "";
    if (!titulo || !inicioRaw) {
      return JSON.stringify({ erro: "parametros_invalidos", campos: ["titulo", "inicio"] });
    }

    const norm = normalizarInicioParaGoogleCalendar(inicioRaw, agendaCfg, {
      horaCliente: horaCliente || undefined,
    });
    const inicio = norm.inicio;
    const fim = normalizarFimParaGoogleCalendar(inicio, String(args.fim ?? "").trim(), agendaCfg);

    const leadId = gcalCtx?.leadId?.trim() || "";
    const descricaoBase = String(args.descricao ?? "").trim();
    const descricao = leadId
      ? [descricaoBase, `waje_lead_id:${leadId}`].filter(Boolean).join("\n")
      : descricaoBase;

    const participantes = Array.isArray(args.participantes)
      ? (args.participantes as unknown[]).map((e) => String(e).trim()).filter(Boolean)
      : [];
    const comGoogleMeet =
      args.com_google_meet === true
        ? true
        : args.com_google_meet === false
          ? false
          : agendaCfg.comMeetPadrao;

    const { evento, conferenceDataVersion } = montarPayloadEventoGoogleCalendar(
      {
        titulo,
        inicio,
        fim,
        descricao,
        participantes,
        comGoogleMeet,
        extendedProperties: leadId
          ? montarExtendedPropertiesLead(leadId, gcalCtx?.telefone)
          : undefined,
      },
      agendaCfg
    );

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
    let resumo = resumirEventoGoogleCalendar(res.body);
    let linkWhatsapp = linkEventoParaWhatsapp(resumo);
    const eventId = resumo?.id != null ? String(resumo.id) : "";

    if (comGoogleMeet && eventId && !linkWhatsapp) {
      const getRes = await fetchJson(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
        { method: "GET", headers }
      );
      if (getRes.ok) {
        resumo = resumirEventoGoogleCalendar(getRes.body);
        linkWhatsapp = linkEventoParaWhatsapp(resumo);
      }
    }

    if (leadId && eventId) {
      await gravarReservaGcalNoLead(supabase, leadId, {
        event_id: eventId,
        inicio: typeof resumo?.inicio === "string" ? resumo.inicio : inicio,
        fim: typeof resumo?.fim === "string" ? resumo.fim : fim,
        link_calendario: typeof resumo?.link_calendario === "string" ? resumo.link_calendario : null,
        link_meet: typeof resumo?.link_meet === "string" ? resumo.link_meet : null,
      });
    }

    return JSON.stringify({
      ok: true,
      mensagem: linkWhatsapp
        ? "Evento criado. Cole o link na mensagem WhatsApp para o cliente."
        : "Evento criado no Google Calendar.",
      evento: resumo,
      inicio_normalizado: inicio,
      horario_corrigido: norm.corrigido,
      aviso_horario: norm.aviso,
      link_para_whatsapp: linkWhatsapp,
      instrucao_agente: linkWhatsapp
        ? `Obrigatório enviar ao cliente EXATAMENTE este link (sem markdown, URL nua): ${linkWhatsapp}`
        : "Confirme data/hora ao cliente.",
    });
  }

  if (toolName === "hub_int_gcal_listar_reservas_lead") {
    const leadId = gcalCtx?.leadId?.trim() || "";
    if (!leadId) {
      return JSON.stringify({ erro: "lead_id_ausente", nota: "Só disponível com cliente na sessão WhatsApp." });
    }

    const min = new Date().toISOString();
    const prop = encodeURIComponent(`${GCAL_LEAD_PROP}=${leadId}`);
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=${prop}&timeMin=${encodeURIComponent(min)}&singleEvents=true&orderBy=startTime&maxResults=20`;
    const res = await fetchJson(url, { method: "GET", headers });
    if (!res.ok) {
      return JSON.stringify({ erro: "google_calendar_api", status: res.status, detalhe: res.body });
    }

    const body = res.body as { items?: unknown[] };
    const items = Array.isArray(body?.items) ? body.items : [];
    const reservas = items
      .map((ev) => resumirEventoGoogleCalendar(ev))
      .filter((x): x is Record<string, unknown> => x != null)
      .map(
        (r): LeadGcalReserva => ({
          event_id: String(r.id ?? ""),
          inicio: typeof r.inicio === "string" ? r.inicio : null,
          fim: typeof r.fim === "string" ? r.fim : null,
          link_calendario: typeof r.link_calendario === "string" ? r.link_calendario : null,
          link_meet: typeof r.link_meet === "string" ? r.link_meet : null,
          criado_em: new Date().toISOString(),
        })
      )
      .filter((r) => r.event_id);

    return JSON.stringify({
      ok: true,
      lead_id: leadId,
      ...reservasLeadParaRespostaCliente(reservas),
      instrucao_agente: "Mostre só as reservas deste cliente. Se vazio, diga que não há reservas activas.",
    });
  }

  if (toolName === "hub_int_gcal_cancelar_evento") {
    const leadId = gcalCtx?.leadId?.trim() || "";
    let eventoId = String(args.evento_id ?? "").trim();

    if (!eventoId && leadId) {
      const prop = encodeURIComponent(`${GCAL_LEAD_PROP}=${leadId}`);
      const min = new Date(Date.now() - 7 * 86400000).toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?privateExtendedProperty=${prop}&timeMin=${encodeURIComponent(min)}&singleEvents=true&orderBy=startTime&maxResults=10`;
      const listRes = await fetchJson(url, { method: "GET", headers });
      if (!listRes.ok) {
        return JSON.stringify({ erro: "google_calendar_api", status: listRes.status, detalhe: listRes.body });
      }
      const items = (listRes.body as { items?: { id?: string; start?: { dateTime?: string } }[] })?.items ?? [];
      const inicioFiltro = String(args.inicio ?? "").trim();
      const agora = Date.now();
      const futuros = items
        .filter((ev) => ev?.id)
        .map((ev) => ({
          id: String(ev.id),
          start: String(ev.start?.dateTime ?? ""),
          t: new Date(String(ev.start?.dateTime ?? "")).getTime(),
        }))
        .filter((ev) => !Number.isNaN(ev.t) && ev.t >= agora - 3_600_000)
        .sort((a, b) => a.t - b.t);

      if (inicioFiltro) {
        const match = futuros.find((ev) => ev.start.startsWith(inicioFiltro.slice(0, 16)));
        eventoId = match?.id ?? "";
      } else {
        eventoId = futuros[0]?.id ?? "";
      }
    }

    if (!eventoId) {
      return JSON.stringify({
        erro: "evento_nao_encontrado",
        nota: "Nenhuma reserva deste lead para cancelar. Confirme com hub_int_gcal_listar_reservas_lead.",
      });
    }

    const delRes = await fetchJson(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventoId)}`,
      { method: "DELETE", headers }
    );
    if (!delRes.ok && delRes.status !== 404 && delRes.status !== 410) {
      return JSON.stringify({ erro: "google_calendar_api", status: delRes.status, detalhe: delRes.body });
    }

    if (leadId) {
      await removerReservaGcalDoLead(supabase, leadId, eventoId);
    }

    return JSON.stringify({
      ok: true,
      cancelado: true,
      evento_id: eventoId,
      mensagem: "Reserva cancelada no Google Calendar.",
      instrucao_agente: "Confirme ao cliente que a reserva foi cancelada.",
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
  integracaoRowId: string,
  integracao?: HubIntegracaoRow,
  gcalCtx?: GcalFerramentaContexto
): Promise<string> {
  let token = bearerToken(cred);
  const storedOAuth = readStoredGoogleOAuthCredentials(cred);
  if (storedOAuth) {
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

    const cfg = integracao ? configObj(integracao) : {};
    const from =
      (typeof cfg.oauth_email === "string" ? cfg.oauth_email.trim() : "") ||
      storedOAuth?.email?.trim() ||
      "";

    if (!from) {
      return JSON.stringify({
        erro: "gmail_sem_remetente",
        detalhe: "Conta Google OAuth sem e-mail guardado. Volte a ligar Gmail em Integrações.",
      });
    }

    let text = corpo;
    let html: string | null = null;
    let fromName: string | null = null;
    const agenteSlug = gcalCtx?.agenteSlug?.trim();
    if (agenteSlug) {
      const { prepararEmailAgente } = await import("@/lib/email/preparar-email-agente");
      const prep = await prepararEmailAgente(supabase, tenantId, agenteSlug, corpo);
      text = prep.text;
      html = prep.html;
      fromName = prep.fromName;
    }

    const enviado = await sendGmailEmail({
      bearerToken: token,
      to: para,
      subject: assunto,
      text,
      html,
      from,
      fromName,
    });

    if (!enviado.ok) {
      return JSON.stringify({ erro: "gmail_api", status: enviado.status, detalhe: enviado.error });
    }

    return JSON.stringify({
      ok: true,
      message_id: enviado.id,
      de: from,
      para,
      assunto,
      corpo_resumo: corpo.length > 200 ? `${corpo.slice(0, 199)}…` : corpo,
      instrucao_agente:
        "Confirme ao utilizador que o e-mail foi enviado pelo Gmail. A entrega no destino pode demorar; se o endereço estiver errado (ex.: hotmail.com vs hotmail.com.br), peça para confirmar o e-mail correto.",
    });
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

async function executarMem0(
  toolName: string,
  args: Record<string, unknown>,
  cred: HubIntegracaoCredenciaisRow | null,
  supabase: SupabaseClient,
  tenantId: string,
  gcalCtx?: GcalFerramentaContexto
): Promise<string> {
  let token = apiKey(cred);
  if (!token) {
    const { resolverMem0ApiKey } = await import("@/lib/hub/mem0-api");
    token = (await resolverMem0ApiKey(supabase, tenantId)) ?? "";
  }
  if (!token) {
    return JSON.stringify({
      erro: "mem0_sem_api_key",
      detalhe: "Active Super Memória em Integrações ou contacte o suporte da plataforma.",
    });
  }

  if (toolName === "hub_int_mem0_buscar") {
    const query = String(args.query ?? "").trim();
    if (!query) {
      return JSON.stringify({ erro: "parametros_invalidos", campos: ["query"] });
    }
    const limite = typeof args.limite === "number" ? args.limite : 6;
    const { mem0SearchMemories } = await import("@/lib/hub/mem0-api");

    let userId = gcalCtx?.leadId?.trim();
    if (!userId && gcalCtx?.agenteInterno && gcalCtx.agenteSlug && gcalCtx.tenantId) {
      const { mem0UserIdSuperagenteInterno } = await import("@/lib/hub/superagente/memoria-superagente");
      userId = mem0UserIdSuperagenteInterno({
        tenantId: gcalCtx.tenantId,
        agenteSlug: gcalCtx.agenteSlug,
        telefoneSessao: gcalCtx.telefone,
        usuarioCrmId: gcalCtx.usuarioCrmId,
      });
    }
    if (!userId) {
      return JSON.stringify({
        erro: "mem0_sem_contexto",
        detalhe: "Superagente interno ou lead na sessão necessário para buscar memórias.",
      });
    }

    const res = await mem0SearchMemories({
      apiKey: token,
      query,
      userId,
      agentId: gcalCtx?.agenteSlug,
      limit: limite,
    });
    if (!res.ok) {
      return JSON.stringify({ erro: "mem0_api", detalhe: res.erro, status: res.status });
    }
    return JSON.stringify({
      ok: true,
      total: res.hits.length,
      memorias: res.hits.map((h) => ({
        id: h.id,
        texto: h.memory ?? h.text,
        score: h.score,
      })),
    });
  }

  return JSON.stringify({ erro: "ferramenta_integrador_desconhecida", tool: toolName });
}

async function executarCrmIntegrador(
  toolName: string,
  args: Record<string, unknown>,
  gcalCtx?: GcalFerramentaContexto
): Promise<string> {
  const entSlug = parseCrmEntidadeToolKey(toolName);
  let builtin: import("@/lib/hub/agente-ferramentas-registry").HubAgenteFerramentaId | undefined;
  if (entSlug) {
    builtin = "hub_operacao_empresa";
  } else if (toolName in CRM_INTEGRADOR_BUILTIN_MAP) {
    builtin = CRM_INTEGRADOR_BUILTIN_MAP[toolName as keyof typeof CRM_INTEGRADOR_BUILTIN_MAP];
  }
  if (!builtin) {
    return JSON.stringify({ erro: "ferramenta_crm_desconhecida", chave: toolName });
  }

  const payload = entSlug ? { ...args, entidade: entSlug } : args;

  const { executarFerramentaHub } = await import("@/lib/hub/executar-ferramenta-ia");
  const modoOperacao =
    gcalCtx?.agenteInterno === true
      ? "jobs_internos"
      : gcalCtx?.leadId
        ? "canal_whatsapp"
        : gcalCtx?.agenteInterno
          ? "jobs_internos"
          : null;

  return executarFerramentaHub(builtin, JSON.stringify(payload), {
    leadId: gcalCtx?.leadId,
    agenteSlug: gcalCtx?.agenteSlug ?? "",
    tenantId: gcalCtx?.tenantId,
    telefoneSessao: gcalCtx?.telefone,
    modoOperacao,
    agenteInterno: gcalCtx?.agenteInterno === true,
    usuarioCrmId: gcalCtx?.usuarioCrmId,
  });
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
  args: Record<string, unknown>,
  gcalCtx?: GcalFerramentaContexto
): Promise<string> {
  const ref = ferramentaIntegradorPorKey(toolName);
  if (!ref) {
    return JSON.stringify({ erro: "integrador_ferramenta_desconhecida", chave: toolName });
  }

  if (ref.integrador.id === "mem0") {
    const { mem0PlataformaConfigurada } = await import("@/lib/hub/mem0-env");
    if (!mem0PlataformaConfigurada()) {
      return JSON.stringify({
        erro: "mem0_sem_api_key",
        detalhe: "Super Memória não está disponível neste ambiente. Contacte o suporte da plataforma.",
      });
    }
    return executarMem0(toolName, args, null, supabase, tenantId, gcalCtx);
  }

  if (ref.integrador.id === WAJE_CRM_INTEGRADOR_ID) {
    return executarCrmIntegrador(toolName, args, gcalCtx);
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
      return executarGoogleCalendar(toolName, args, credenciais, supabase, tenantId, String(integracao.id), gcalCtx);
    case "gmail":
      return executarGmail(
        toolName,
        args,
        credenciais,
        supabase,
        tenantId,
        String(integracao.id),
        integracao,
        gcalCtx
      );
    case "zendesk":
      return executarZendesk(toolName, args, integracao, credenciais);
    case "supabase_externo": {
      const credObj =
        credenciais?.credenciais && typeof credenciais.credenciais === "object"
          ? (credenciais.credenciais as Record<string, unknown>)
          : {};
      const extCred = credenciaisSupabaseExternoDeRow(credObj);
      if (!extCred) {
        return JSON.stringify({
          erro: "supabase_externo_sem_credenciais",
          detalhe: "Configure URL e chave API em Integrações → Supabase.",
        });
      }
      if (toolName === HUB_INT_SUPABASE_EXTERNO_CONSULTAR) {
        return await consultarSupabaseExterno(extCred, {
          tabela: String(args.tabela ?? ""),
          colunas: Array.isArray(args.colunas) ? (args.colunas as string[]) : undefined,
          limite: typeof args.limite === "number" ? args.limite : undefined,
          filtro_coluna: typeof args.filtro_coluna === "string" ? args.filtro_coluna : undefined,
          filtro_texto: typeof args.filtro_texto === "string" ? args.filtro_texto : undefined,
        });
      }
      return JSON.stringify({ erro: "ferramenta_supabase_externo_desconhecida", tool: toolName });
    }
    default:
      return JSON.stringify({ erro: "integrador_nao_implementado", id: ref.integrador.id });
  }
}
