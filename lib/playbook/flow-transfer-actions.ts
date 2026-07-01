import type { SupabaseClient } from "@supabase/supabase-js";
import { buildHubLeadsCrmPatch } from "@/lib/hub/hub-leads-crm-atualizar";
import { ensureConversaAtiva } from "@/lib/crm/conversa-canal";
import { defaultTenantId } from "@/lib/tenant-default";
import type {
  PlaybookFlowCrmPatch,
  PlaybookFlowHandoffTarget,
  PlaybookFlowTransferKind,
} from "@/lib/playbook/flow-definition-types";
import { whatsappConfigured, whatsappSendText } from "@/lib/whatsapp/whatsapp-send";

export type FlowCompleteTransfer = {
  kind: PlaybookFlowTransferKind;
  notify_phone?: string;
  notify_email?: string;
  agent_slug?: string;
  handoff_to?: PlaybookFlowHandoffTarget;
  summary?: string;
  crm_patch?: PlaybookFlowCrmPatch;
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function montarCardResumoLeadTransferencia(args: {
  leadNome?: string | null;
  leadTelefone: string;
  agenteSlug: string;
  stepId: string;
  summary?: string;
  answers?: Record<string, string>;
}): string {
  const linhas: string[] = [
    "📋 *Novo lead — transferência do fluxo*",
    "",
    `🤖 Agente: ${args.agenteSlug}`,
    `📍 Passo: ${args.stepId}`,
  ];
  if (args.leadNome?.trim()) linhas.push(`👤 Nome: ${args.leadNome.trim()}`);
  linhas.push(`📱 WhatsApp lead: ${args.leadTelefone}`);
  if (args.summary?.trim()) {
    linhas.push("", `📝 ${args.summary.trim()}`);
  }
  const respostas = Object.entries(args.answers ?? {}).filter(([, v]) => v?.trim());
  if (respostas.length > 0) {
    linhas.push("", "*Dados coletados:*");
    for (const [chave, valor] of respostas.slice(0, 12)) {
      linhas.push(`• ${chave}: ${valor}`);
    }
  }
  linhas.push("", "_A conversa com o lead continua registrada no CRM via UAZAPI._");
  return linhas.join("\n");
}

export async function executarAcaoTransferenciaFluxo(
  supabase: SupabaseClient,
  opts: {
    leadId: string;
    leadTelefone: string;
    leadNome?: string | null;
    agenteSlug: string;
    instanceToken: string;
    stepId: string;
    transfer: FlowCompleteTransfer;
    answers: Record<string, string>;
  }
): Promise<void> {
  const agora = new Date().toISOString();
  const card = montarCardResumoLeadTransferencia({
    leadNome: opts.leadNome,
    leadTelefone: opts.leadTelefone,
    agenteSlug: opts.agenteSlug,
    stepId: opts.stepId,
    summary: opts.transfer.summary,
    answers: opts.answers,
  });

  const { data: leadAtual } = await supabase
    .from("hub_leads_crm")
    .select("id, estagio, score, valor_estimado, tags, metadata, preferencias, nome, telefone, interesse_principal")
    .eq("id", opts.leadId)
    .maybeSingle();

  const metaBase =
    leadAtual?.metadata && typeof leadAtual.metadata === "object" && !Array.isArray(leadAtual.metadata)
      ? (leadAtual.metadata as Record<string, unknown>)
      : {};

  const patchArgs: Record<string, unknown> = {
    metadata: {
      ...metaBase,
      fluxo_transferencia_em: agora,
      fluxo_transferencia_tipo: opts.transfer.kind,
      fluxo_transferencia_passo: opts.stepId,
      ...(opts.transfer.handoff_to ? { handoff_to: opts.transfer.handoff_to } : {}),
      ...(opts.transfer.agent_slug ? { transfer_agente_destino: opts.transfer.agent_slug } : {}),
      ...(opts.transfer.notify_phone ? { transfer_notify_phone: opts.transfer.notify_phone } : {}),
    },
  };

  if (opts.transfer.crm_patch) {
    Object.assign(patchArgs, opts.transfer.crm_patch);
  }

  if (opts.transfer.kind === "humano" || opts.transfer.handoff_to) {
    Object.assign(patchArgs.metadata as Record<string, unknown>, {
      fase_atendimento: "atendimento_humano",
      fluxo_ativo: "handoff",
    });
  }

  if (opts.transfer.kind === "agente" && opts.transfer.agent_slug?.trim()) {
    patchArgs.agente_responsavel = opts.transfer.agent_slug.trim();
  }

  if (leadAtual) {
    const built = buildHubLeadsCrmPatch(patchArgs, leadAtual as Record<string, unknown>);
    if (built.ok) {
      await supabase.from("hub_leads_crm").update(built.patch).eq("id", opts.leadId);
    }
  }

  await ensureConversaAtiva(supabase, {
    leadId: opts.leadId,
    canal: "whatsapp",
    preview: opts.transfer.summary?.slice(0, 100) ?? "Transferência do fluxo",
  });

  if (opts.transfer.kind === "whatsapp_card" && opts.transfer.notify_phone?.trim()) {
    const destino = onlyDigits(opts.transfer.notify_phone);
    if (destino.length >= 10 && whatsappConfigured({ instanceToken: opts.instanceToken })) {
      const envio = await whatsappSendText(destino, card, { instanceToken: opts.instanceToken });
      await supabase.from("hub_atividades").insert({
        lead_id: opts.leadId,
        tipo: "ia_acao",
        descricao: envio.ok
          ? `Card de resumo enviado para equipe (${destino})`
          : `Falha ao enviar card para equipe (${destino})`,
        feito_por: opts.agenteSlug,
        feito_por_tipo: "ia",
        tenant_id: defaultTenantId(),
        metadata: {
          acao: "flow_transfer_whatsapp_card",
          notify_phone: destino,
          step_id: opts.stepId,
          envio_ok: envio.ok,
          erro: envio.ok ? null : envio.error,
        },
      });
    }
  }

  if (opts.transfer.kind === "email" && opts.transfer.notify_email?.trim()) {
    await supabase.from("hub_atividades").insert({
      lead_id: opts.leadId,
      tipo: "ia_acao",
      descricao: `Transferência por e-mail registrada (${opts.transfer.notify_email.trim()})`,
      feito_por: opts.agenteSlug,
      feito_por_tipo: "ia",
      tenant_id: defaultTenantId(),
      metadata: {
        acao: "flow_transfer_email",
        notify_email: opts.transfer.notify_email.trim(),
        step_id: opts.stepId,
        resumo: card.slice(0, 2000),
      },
    });
  }

  if (opts.transfer.kind === "agente" && opts.transfer.agent_slug?.trim()) {
    await supabase.from("hub_atividades").insert({
      lead_id: opts.leadId,
      tipo: "ia_acao",
      descricao: `Lead encaminhado para agente ${opts.transfer.agent_slug.trim()}`,
      feito_por: opts.agenteSlug,
      feito_por_tipo: "ia",
      tenant_id: defaultTenantId(),
      metadata: {
        acao: "flow_transfer_agente",
        agent_slug: opts.transfer.agent_slug.trim(),
        step_id: opts.stepId,
      },
    });
  }

  if (opts.transfer.kind === "humano") {
    await supabase.from("hub_atividades").insert({
      lead_id: opts.leadId,
      tipo: "ia_acao",
      descricao: "Lead transferido para atendimento humano (fluxo)",
      feito_por: opts.agenteSlug,
      feito_por_tipo: "ia",
      tenant_id: defaultTenantId(),
      metadata: {
        acao: "flow_transfer_humano",
        handoff_to: opts.transfer.handoff_to ?? "time_humano",
        step_id: opts.stepId,
      },
    });
  }

  await supabase.from("hub_acoes_ia").insert({
    agente_slug: opts.agenteSlug,
    tipo: "memoria_salva",
    descricao: "Transferência executada pelo fluxo do playbook",
    lead_id: opts.leadId,
    sucesso: true,
    metadata: {
      origem: "playbook_flow_transfer",
      transfer_kind: opts.transfer.kind,
      step_id: opts.stepId,
    },
  });
}

export function extrairTransferDoPassoComplete(step: {
  complete: {
    summary?: string;
    handoff_to?: PlaybookFlowHandoffTarget;
    crm_patch?: PlaybookFlowCrmPatch;
  };
}): FlowCompleteTransfer | undefined {
  const meta = step.complete.crm_patch?.metadata;
  const notifyPhone =
    meta && typeof meta === "object" && typeof (meta as Record<string, unknown>).notify_phone === "string"
      ? String((meta as Record<string, unknown>).notify_phone).trim()
      : "";
  const transferKind =
    meta && typeof meta === "object" && typeof (meta as Record<string, unknown>).transfer_kind === "string"
      ? ((meta as Record<string, unknown>).transfer_kind as PlaybookFlowTransferKind)
      : undefined;

  if (notifyPhone) {
    return {
      kind: "whatsapp_card",
      notify_phone: notifyPhone,
      notify_email:
        typeof (meta as Record<string, unknown> | undefined)?.notify_email === "string"
          ? String((meta as Record<string, unknown>).notify_email)
          : undefined,
      agent_slug:
        typeof (meta as Record<string, unknown> | undefined)?.agent_slug === "string"
          ? String((meta as Record<string, unknown>).agent_slug)
          : undefined,
      handoff_to: step.complete.handoff_to,
      summary: step.complete.summary,
      crm_patch: step.complete.crm_patch,
    };
  }

  if (transferKind) {
    return {
      kind: transferKind,
      notify_phone:
        typeof (meta as Record<string, unknown> | undefined)?.notify_phone === "string"
          ? String((meta as Record<string, unknown>).notify_phone)
          : undefined,
      notify_email:
        typeof (meta as Record<string, unknown> | undefined)?.notify_email === "string"
          ? String((meta as Record<string, unknown>).notify_email)
          : undefined,
      agent_slug:
        typeof (meta as Record<string, unknown> | undefined)?.agent_slug === "string"
          ? String((meta as Record<string, unknown>).agent_slug)
          : undefined,
      handoff_to: step.complete.handoff_to,
      summary: step.complete.summary,
      crm_patch: step.complete.crm_patch,
    };
  }

  if (step.complete.handoff_to) {
    return {
      kind: "humano",
      handoff_to: step.complete.handoff_to,
      summary: step.complete.summary,
      crm_patch: step.complete.crm_patch,
    };
  }

  return undefined;
}
