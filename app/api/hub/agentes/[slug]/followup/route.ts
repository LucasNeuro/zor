import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import { obterOuCriarFollowupConfig } from "@/lib/hub/followup-db";
import { reativarFollowupLeadsAgente } from "@/lib/hub/followup-lead-state";
import { normalizarHorariosDisparoInput, normalizarHoraInput, normalizarJanelaModoInput } from "@/lib/hub/followup-janela";
import { validarAtrasoPasso, validarHoraDia } from "@/lib/hub/followup-types";
import { mensagemErroFollowupDb } from "@/lib/hub/followup-db-errors";
import { WA_LIVE_STATUSES } from "@/lib/whatsapp/resolver-linha-whatsapp";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  const { data: agente } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, tenant_id, modo_operacao, uazapi_instance_id, uazapi_instance_name, uazapi_connection_status, uazapi_instance_token"
    )
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!agente) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });

  const tenantId =
    (typeof agente.tenant_id === "string" && agente.tenant_id.trim()) ||
    tenantResolved.tenantId;

  const pack = await obterOuCriarFollowupConfig(supabase, slug, tenantId);
  if (!pack) {
    return NextResponse.json({ error: "Falha ao carregar follow-up." }, { status: 500 });
  }

  const modoOperacao =
    typeof agente.modo_operacao === "string" ? agente.modo_operacao.trim() : "";
  const instanceId =
    typeof agente.uazapi_instance_id === "string" ? agente.uazapi_instance_id.trim() : "";
  const instanceName =
    typeof agente.uazapi_instance_name === "string" ? agente.uazapi_instance_name.trim() : "";
  const connectionStatus =
    typeof agente.uazapi_connection_status === "string"
      ? agente.uazapi_connection_status.trim().toLowerCase()
      : "";
  const hasToken =
    typeof agente.uazapi_instance_token === "string" &&
    agente.uazapi_instance_token.trim().length > 0;
  const whatsappConectado = connectionStatus ? WA_LIVE_STATUSES.has(connectionStatus) : false;

  return NextResponse.json({
    config: pack.config,
    passos: pack.passos,
    modo_operacao: modoOperacao || null,
    canal_whatsapp: {
      modo_whatsapp: modoOperacao === "canal_whatsapp",
      instance_id: instanceId || null,
      instance_name: instanceName || null,
      connection_status: connectionStatus || null,
      has_instance_token: hasToken,
      pronto_para_envio: modoOperacao === "canal_whatsapp" && hasToken && whatsappConectado,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: {
    ativo?: boolean;
    arquivar_apos_dias?: number;
    gatilho_tipo?: string;
    gatilho_dias?: number;
    gatilho_horas?: number;
    gatilho_minutos?: number;
    gatilho_hora_dia?: string | null;
    execucao_modo?: string;
    horarios_disparo?: string[];
    janela_modo?: string;
    timezone?: string;
    horario_inicio?: string;
    horario_fim?: string;
    max_envios_por_dia?: number;
    max_envios_total_lead?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const supabase = db();
  const pack = await obterOuCriarFollowupConfig(supabase, slug, tenantResolved.tenantId);
  if (!pack) {
    return NextResponse.json({ error: "Config não encontrada" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;
  if (body.arquivar_apos_dias != null) {
    const d = Number.parseInt(String(body.arquivar_apos_dias), 10);
    if (!Number.isFinite(d) || d < 1 || d > 365) {
      return NextResponse.json({ error: "arquivar_apos_dias inválido (1–365)." }, { status: 400 });
    }
    patch.arquivar_apos_dias = d;
  }
  if (body.gatilho_tipo != null) {
    const t = String(body.gatilho_tipo);
    if (t !== "silencio" && t !== "horario") {
      return NextResponse.json({ error: "gatilho_tipo inválido." }, { status: 400 });
    }
    patch.gatilho_tipo = t;
  }
  if (body.gatilho_dias != null) {
    const d = Number.parseInt(String(body.gatilho_dias), 10);
    if (!Number.isFinite(d) || d < 0 || d > 365) {
      return NextResponse.json({ error: "gatilho_dias inválido (0–365)." }, { status: 400 });
    }
    patch.gatilho_dias = d;
  }
  if (body.gatilho_horas != null) {
    const h = Number.parseInt(String(body.gatilho_horas), 10);
    if (!Number.isFinite(h) || h < 0 || h > 8760) {
      return NextResponse.json({ error: "gatilho_horas inválido (0–8760)." }, { status: 400 });
    }
    patch.gatilho_horas = h;
  }
  if (body.gatilho_minutos != null) {
    const m = Number.parseInt(String(body.gatilho_minutos), 10);
    if (!Number.isFinite(m) || m < 0 || m > 59) {
      return NextResponse.json({ error: "gatilho_minutos inválido (0–59)." }, { status: 400 });
    }
    patch.gatilho_minutos = m;
  }
  if (body.gatilho_hora_dia !== undefined) {
    const hora = body.gatilho_hora_dia != null ? String(body.gatilho_hora_dia).trim() : "";
    if (hora) {
      const err = validarHoraDia(hora);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      patch.gatilho_hora_dia = hora;
    } else {
      patch.gatilho_hora_dia = null;
    }
  }
  if (body.execucao_modo != null) {
    const m = String(body.execucao_modo);
    if (m !== "continuo" && m !== "janela_horaria") {
      return NextResponse.json({ error: "execucao_modo inválido." }, { status: 400 });
    }
    patch.execucao_modo = m;
    if (m === "continuo") patch.janela_modo = "continuo";
    else if (!body.janela_modo) patch.janela_modo = "slots";
  }
  if (body.janela_modo != null) {
    const jm = normalizarJanelaModoInput(body.janela_modo);
    if (!jm) {
      return NextResponse.json({ error: "janela_modo inválido (faixa, slots, continuo)." }, { status: 400 });
    }
    patch.janela_modo = jm;
    patch.execucao_modo = jm === "continuo" ? "continuo" : "janela_horaria";
  }
  if (body.timezone != null) {
    const tz = String(body.timezone).trim();
    if (tz.length < 3 || tz.length > 64) {
      return NextResponse.json({ error: "timezone inválido." }, { status: 400 });
    }
    patch.timezone = tz;
  }
  if (body.horario_inicio != null) {
    const h = normalizarHoraInput(body.horario_inicio);
    if (!h) {
      return NextResponse.json({ error: "horario_inicio inválido (HH:MM)." }, { status: 400 });
    }
    patch.horario_inicio = h;
  }
  if (body.horario_fim != null) {
    const h = normalizarHoraInput(body.horario_fim);
    if (!h) {
      return NextResponse.json({ error: "horario_fim inválido (HH:MM)." }, { status: 400 });
    }
    patch.horario_fim = h;
  }
  if (body.max_envios_por_dia != null) {
    const n = Number.parseInt(String(body.max_envios_por_dia), 10);
    if (!Number.isFinite(n) || n < 1 || n > 10) {
      return NextResponse.json({ error: "max_envios_por_dia inválido (1–10)." }, { status: 400 });
    }
    patch.max_envios_por_dia = n;
  }
  if (body.max_envios_total_lead != null) {
    const n = Number.parseInt(String(body.max_envios_total_lead), 10);
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      return NextResponse.json({ error: "max_envios_total_lead inválido (1–100)." }, { status: 400 });
    }
    patch.max_envios_total_lead = n;
  }
  if (body.horarios_disparo !== undefined) {
    const horarios = normalizarHorariosDisparoInput(body.horarios_disparo);
    if (!horarios) {
      return NextResponse.json(
        { error: "horarios_disparo inválido — use lista HH:MM (ex. 09:00, 14:00)." },
        { status: 400 }
      );
    }
    patch.horarios_disparo = horarios;
  }

  if (
    body.gatilho_dias != null ||
    body.gatilho_horas != null ||
    body.gatilho_minutos != null
  ) {
    const dias = Number(patch.gatilho_dias ?? pack.config.gatilho_dias ?? 0);
    const horas = Number(patch.gatilho_horas ?? pack.config.gatilho_horas ?? 0);
    const minutos = Number(patch.gatilho_minutos ?? pack.config.gatilho_minutos ?? 0);
    const atrasoErr = validarAtrasoPasso(horas, minutos, dias);
    if (atrasoErr && dias + horas + minutos > 0) {
      return NextResponse.json({ error: `Gatilho: ${atrasoErr}` }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("hub_agente_followup_config")
    .update(patch)
    .eq("id", pack.config.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: mensagemErroFollowupDb(error) }, { status: 500 });
  }

  let leadsReativados = 0;
  if (patch.ativo === true) {
    leadsReativados = await reativarFollowupLeadsAgente(supabase, slug);
  }

  const { data: passos } = await supabase
    .from("hub_agente_followup_passo")
    .select("*")
    .eq("config_id", pack.config.id)
    .order("ordem");

  return NextResponse.json({
    config: data,
    passos: passos || [],
    leads_reativados: leadsReativados,
  });
}
