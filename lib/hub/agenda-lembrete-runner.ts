import type { SupabaseClient } from "@supabase/supabase-js";
import { insertFilaMensagemCompat } from "@/lib/crm/insert-fila-mensagem-compat";
import { resolverTokenInstanciaWhatsapp } from "@/lib/crm/resolver-token-whatsapp";
import {
  agendaLembreteJaEnviado,
  registrarAgendaLembreteEnvio,
} from "@/lib/hub/agenda-lembrete-db";
import {
  formatarDataAgenda,
  formatarHoraAgenda,
  interpolarTemplateAgendaLembrete,
  reservaNaJanelaLembrete,
  reservasAgendaDoLead,
  timezoneAgendaLembrete,
  type HubAgenteAgendaLembreteConfig,
} from "@/lib/hub/agenda-lembrete-types";
import { criarContextoTemplateFollowup } from "@/lib/hub/followup-template-vars";
import { defaultTenantId } from "@/lib/tenant-default";
import { whatsappConfigured, whatsappSendText } from "@/lib/whatsapp/whatsapp-send";

type LeadAgendaRow = {
  id: string;
  nome: string;
  telefone: string | null;
  tenant_id: string | null;
  metadata: Record<string, unknown> | null;
};

export type AgendaLembreteRunResult = {
  agente_slug: string;
  enviados: number;
  reservas_elegiveis: number;
  erros: string[];
  acoes: string[];
};

export type AgendaLembreteRunOptions = {
  simular?: boolean;
};

export async function executarAgendaLembreteParaAgente(
  supabase: SupabaseClient,
  config: HubAgenteAgendaLembreteConfig,
  options?: AgendaLembreteRunOptions
): Promise<AgendaLembreteRunResult> {
  const slug = config.agente_slug;
  const result: AgendaLembreteRunResult = {
    agente_slug: slug,
    enviados: 0,
    reservas_elegiveis: 0,
    erros: [],
    acoes: [],
  };

  if (!config.ativo) return result;

  const { token: instanceToken } = await resolverTokenInstanciaWhatsapp(supabase, slug);
  if (!whatsappConfigured({ instanceToken })) {
    result.erros.push(
      instanceToken
        ? `${slug}: WhatsApp não configurado para este agente.`
        : `${slug}: sem token UAZAPI para lembretes de agenda.`
    );
    return result;
  }

  const tz = timezoneAgendaLembrete(config);
  const minutosAntes = Math.max(1, config.minutos_antes ?? 10);
  const tenantDefault = config.tenant_id?.trim() || defaultTenantId() || null;
  const ctxTemplate = await criarContextoTemplateFollowup(supabase, slug, tenantDefault);

  const { data: leads, error } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, tenant_id, metadata")
    .eq("agente_responsavel", slug)
    .is("humano_responsavel", null)
    .not("estagio", "in", '("ganho","perdido","arquivado")')
    .not("telefone", "is", null);

  if (error) {
    result.erros.push(error.message);
    return result;
  }

  const agoraMs = Date.now();
  const template = (config.texto_template || "").trim();

  for (const lead of (leads || []) as LeadAgendaRow[]) {
    const tel = (lead.telefone || "").trim();
    if (!tel) continue;

    const reservas = reservasAgendaDoLead(lead.metadata);
    if (reservas.length === 0) continue;

    for (const reserva of reservas) {
      if (!reserva.inicio?.trim()) continue;
      if (!reservaNaJanelaLembrete(reserva.inicio, agoraMs, minutosAntes)) continue;

      result.reservas_elegiveis += 1;

      const check = await agendaLembreteJaEnviado(supabase, lead.id, reserva.event_id);
      if (!check.ledgerOk) {
        result.erros.push(`${lead.nome}: ledger indisponível — envio bloqueado`);
        continue;
      }
      if (check.jaEnviado) continue;

      const mercado =
        (lead.metadata && typeof lead.metadata.mercado === "string"
          ? lead.metadata.mercado
          : "geral") || "geral";
      const empresa = await ctxTemplate.empresaParaTenant(lead.tenant_id);
      const linkMeet = (reserva.link_meet || reserva.link_calendario || "").trim();
      const hora = formatarHoraAgenda(reserva.inicio, tz);
      const data = formatarDataAgenda(reserva.inicio, tz);

      const texto = interpolarTemplateAgendaLembrete(template, {
        nome: lead.nome || "tudo bem",
        mercado,
        empresa,
        agente: ctxTemplate.agente,
        hora,
        data,
        link_meet: linkMeet,
        link: linkMeet,
      });

      if (!texto.trim()) {
        result.erros.push(`${lead.nome}: template vazio`);
        continue;
      }

      if (options?.simular) {
        result.enviados += 1;
        result.acoes.push(`[simulado] Lembrete ${hora} → ${lead.nome}`);
        continue;
      }

      const envio = await whatsappSendText(tel, texto, { instanceToken });
      if (!envio.ok) {
        result.erros.push(`${lead.nome}: ${envio.error || "falha envio"}`);
        continue;
      }

      const agoraIso = new Date().toISOString();
      const ledger = await registrarAgendaLembreteEnvio(supabase, {
        lead_id: lead.id,
        event_id: reserva.event_id,
        agente_slug: slug,
        tenant_id: lead.tenant_id ?? config.tenant_id,
        enviado_em: agoraIso,
      });

      if (!ledger.ok) {
        result.erros.push(`${lead.nome}: enviado mas ledger falhou (${ledger.erro})`);
        continue;
      }

      const tenantId = lead.tenant_id?.trim() || config.tenant_id?.trim() || defaultTenantId();
      const { error: filaErr } = await insertFilaMensagemCompat(supabase, {
        lead_id: lead.id,
        tenant_id: tenantId,
        agente_id: slug,
        canal: "whatsapp",
        direcao: "saida",
        conteudo: texto,
        status: "enviado",
        metadata: {
          tipo: "agenda_lembrete",
          feito_por_tipo: "ia",
          feito_por: slug,
          event_id: reserva.event_id,
          inicio: reserva.inicio,
          agente_slug: slug,
        },
      });

      if (filaErr) {
        result.erros.push(`${lead.nome}: lembrete enviado; falha fila CRM (${filaErr.message})`);
      }

      result.enviados += 1;
      result.acoes.push(`Lembrete ${hora} → ${lead.nome}`);
    }
  }

  return result;
}

export async function executarAgendaLembreteTodosAgentesAtivos(
  supabase: SupabaseClient,
  options?: AgendaLembreteRunOptions
): Promise<{ resultados: AgendaLembreteRunResult[]; erros: string[] }> {
  const { data: configs, error } = await supabase
    .from("hub_agente_agenda_lembrete_config")
    .select("*")
    .eq("ativo", true);

  if (error) return { resultados: [], erros: [error.message] };

  const resultados: AgendaLembreteRunResult[] = [];
  for (const cfg of (configs || []) as HubAgenteAgendaLembreteConfig[]) {
    const r = await executarAgendaLembreteParaAgente(supabase, cfg, options);
    resultados.push(r);
  }

  const erros = resultados.flatMap((r) => r.erros);
  return { resultados, erros };
}
