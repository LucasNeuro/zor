import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";

export type HumanHandoffFromDeviceParams = {
  telefone: string;
  mensagem: string;
  messageId?: string | null;
  timestamp?: string;
  /** Slug do operador (ex.: wendel, celular). */
  humanoSlug?: string;
};

export function slugHumanoPadraoCelular(): string {
  const fromEnv = process.env.WHATSAPP_DEVICE_HUMAN_SLUG?.trim();
  return fromEnv || "celular";
}

/** Cancela jobs de IA pendentes para o telefone — evita resposta da IA após o humano assumir. */
export async function cancelarJobsIaPendentesTelefone(
  supabase: SupabaseClient,
  telefone: string
): Promise<number> {
  const tel = telefoneConversaId(telefone);
  if (!tel) return 0;

  const { data, error } = await supabase
    .from("hub_msg_jobs")
    .update({
      status: "done",
      last_error: "human_takeover_from_device",
      locked_at: null,
      locked_by: null,
    })
    .eq("canal", "whatsapp")
    .eq("telefone", tel)
    .in("status", ["pending", "retry", "processing"])
    .select("id");

  if (error) {
    console.warn("[WHATSAPP][HANDOFF] cancelar jobs:", error.message);
    return 0;
  }
  return Array.isArray(data) ? data.length : 0;
}

/**
 * Mensagem enviada pelo celular conectado (fromMe): interrompe IA e passa atendimento ao humano.
 */
export async function ativarAtendimentoHumanoPorMensagemDoCelular(
  supabase: SupabaseClient,
  params: HumanHandoffFromDeviceParams
): Promise<{
  ok: boolean;
  leadId?: string;
  humanoSlug: string;
  jobsCancelados: number;
  motivo?: string;
}> {
  const tel = telefoneConversaId(params.telefone);
  if (tel.length < 10) {
    return { ok: false, humanoSlug: slugHumanoPadraoCelular(), jobsCancelados: 0, motivo: "telefone_invalido" };
  }

  const humanoSlug = (params.humanoSlug?.trim() || slugHumanoPadraoCelular()).slice(0, 80);
  const mensagem = params.mensagem.trim();
  const agora = params.timestamp?.trim() || new Date().toISOString();

  const { data: lead } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, humano_responsavel, metadata, pessoa_id")
    .eq("telefone", tel)
    .maybeSingle();

  if (!lead?.id) {
    return {
      ok: false,
      humanoSlug,
      jobsCancelados: 0,
      motivo: "lead_nao_encontrado",
    };
  }

  const leadId = String(lead.id);
  const jaHumano =
    typeof lead.humano_responsavel === "string" && lead.humano_responsavel.trim().length > 0;
  const humanoAnterior = jaHumano ? String(lead.humano_responsavel).trim() : null;

  const metaBase =
    typeof lead.metadata === "object" && lead.metadata !== null
      ? (lead.metadata as Record<string, unknown>)
      : {};

  const leadPatch = {
    humano_responsavel: humanoSlug,
    atualizado_em: agora,
    ultimo_contato: agora,
    metadata: {
      ...metaBase,
      fase_atendimento: "atendimento_humano",
      humano_assumiu_em: agora,
      humano_assumiu_via: "whatsapp_from_me",
      ...(humanoAnterior && humanoAnterior !== humanoSlug
        ? { humano_anterior: humanoAnterior }
        : {}),
    },
  };

  let upd = await supabase.from("hub_leads_crm").update(leadPatch).eq("id", leadId);
  if (upd.error && isMissingPgColumn(upd.error, "ultimo_contato")) {
    const { ultimo_contato: _u, ...semUltimo } = leadPatch;
    upd = await supabase.from("hub_leads_crm").update(semUltimo).eq("id", leadId);
  }

  const jobsCancelados = await cancelarJobsIaPendentesTelefone(supabase, tel);

  try {
    const { data: conv } = await supabase
      .from("hub_conversas")
      .select("id")
      .eq("lead_id", leadId)
      .eq("canal", "whatsapp")
      .is("encerrada_em", null)
      .maybeSingle();

    if (conv?.id) {
      await supabase
        .from("hub_conversas")
        .update({
          ia_ativa: false,
          status: "em_atendimento_humano",
          ultima_mensagem_em: agora,
          ultima_mensagem_preview: mensagem.slice(0, 100) || "[mensagem do celular]",
        })
        .eq("id", conv.id);

      if (mensagem) {
        await supabase.from("hub_mensagens").insert({
          conversa_id: conv.id,
          lead_id: leadId,
          remetente: "humano",
          tipo_conteudo: "texto",
          conteudo: mensagem,
          whatsapp_message_id: params.messageId ?? null,
          enviada_em: agora,
        });
      }
    }
  } catch (e) {
    console.error("[WHATSAPP][HANDOFF] hub_conversas/mensagens:", e);
  }

  try {
    const filaRow = {
      lead_id: leadId,
      agente_id: humanoSlug,
      canal: "whatsapp",
      direcao: "saida",
      conteudo: mensagem || "[mensagem enviada pelo celular]",
      status: "enviada_celular",
      tenant_id: defaultTenantId(),
      metadata: {
        feito_por: humanoSlug,
        feito_por_tipo: "humano",
        from_me: true,
        human_takeover: !jaHumano,
        message_id: params.messageId ?? null,
      },
    };
    let filaIns = await supabase.from("hub_fila_mensagens").insert(filaRow);
    if (filaIns.error && isMissingPgColumn(filaIns.error, "tenant_id")) {
      const { tenant_id: _t, ...semTenant } = filaRow;
      filaIns = await supabase.from("hub_fila_mensagens").insert(semTenant);
    }
  } catch (e) {
    console.error("[WHATSAPP][HANDOFF] hub_fila_mensagens:", e);
  }

  if (!jaHumano || humanoAnterior !== humanoSlug) {
    try {
      await supabase.from("hub_atividades").insert({
        lead_id: leadId,
        tipo: "ia_acao",
        descricao: `Atendimento assumido automaticamente (${humanoSlug}) — mensagem enviada pelo celular da linha WhatsApp.`,
        feito_por: humanoSlug,
        feito_por_tipo: "humano",
        metadata: {
          telefone: tel,
          via: "whatsapp_from_me",
          message_id: params.messageId ?? null,
          jobs_cancelados: jobsCancelados,
        },
      });
    } catch (e) {
      console.error("[WHATSAPP][HANDOFF] hub_atividades:", e);
    }
  }

  return { ok: true, leadId, humanoSlug, jobsCancelados };
}
