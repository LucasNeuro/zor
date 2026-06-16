import type { SupabaseClient } from "@supabase/supabase-js";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";
import { ensureConversaAtiva, gravarMensagemSaidaConversa } from "@/lib/crm/conversa-canal";
import { formatarMensagemConsultorWhatsapp } from "@/lib/crm/mensagem-consultor-whatsapp";
import { resolverTokenInstanciaWhatsapp } from "@/lib/crm/resolver-token-whatsapp";
import { formatHumanoDisplayName } from "@/lib/crm/resolve-crm-actor";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { cancelarJobsIaPendentesTelefone } from "@/lib/whatsapp/human-handoff-from-device";
import { whatsappConfigured, whatsappSendText } from "@/lib/whatsapp/whatsapp-send";

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

function allowWhatsappDryRun(): boolean {
  return process.env.NODE_ENV === "development" || process.env.WHATSAPP_DRY_RUN === "1";
}

function erroEnvioWhatsapp(status: number | undefined, error: string): string {
  if (status === 401) {
    return "WhatsApp recusou o token (401). Reconecte a instância em Agentes → Canais → WhatsApp.";
  }
  if (status === 403) {
    return "WhatsApp recusou o envio (403). Verifique se a instância está ligada e autorizada.";
  }
  return error;
}

/** Nome do negócio/empresa para a tag — negócio do lead, tenant ou agente. */
async function resolverNomeNegocioParaTag(
  supabase: SupabaseClient,
  leadId: string,
  tenantId: string,
  agenteSlug: string | null
): Promise<string> {
  try {
    const { data: negocio } = await supabase
      .from("hub_negocios")
      .select("titulo")
      .eq("lead_id", leadId)
      .neq("status", "perdido")
      .order("atualizado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    const titulo = typeof negocio?.titulo === "string" ? negocio.titulo.trim() : "";
    if (titulo) return titulo;
  } catch {
    /* tabela pode não existir em ambientes antigos */
  }

  const { data: tenant } = await supabase
    .from("hub_tenants")
    .select("nome_exibicao")
    .eq("id", tenantId)
    .maybeSingle();
  const nomeTenant =
    typeof tenant?.nome_exibicao === "string" ? tenant.nome_exibicao.trim() : "";
  if (nomeTenant) return nomeTenant;

  if (agenteSlug) {
    const { data: agente } = await supabase
      .from("hub_agente_identidade")
      .select("nome")
      .eq("agente_slug", agenteSlug)
      .maybeSingle();
    const nomeAgente = typeof agente?.nome === "string" ? agente.nome.trim() : "";
    if (nomeAgente) return nomeAgente;
  }

  return "";
}

export type AssumirAtendimentoHumanoOpts = {
  leadId: string;
  humanoSlug: string;
  feitoPor: string;
  actorId?: string | null;
  actorEmail?: string | null;
};

export async function assumirAtendimentoHumanoLead(
  supabase: SupabaseClient,
  opts: AssumirAtendimentoHumanoOpts
): Promise<{ ok: true } | { ok: false; error: string }> {
  const agora = new Date().toISOString();

  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, telefone, humano_responsavel, metadata")
    .eq("id", opts.leadId)
    .maybeSingle();

  if (leadErr) return { ok: false, error: leadErr.message };
  if (!lead) return { ok: false, error: "Lead não encontrado" };

  const metaBase =
    lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, unknown>)
      : {};

  const { error: updErr } = await supabase
    .from("hub_leads_crm")
    .update({
      humano_responsavel: opts.humanoSlug,
      atualizado_em: agora,
      metadata: {
        ...metaBase,
        fase_atendimento: "atendimento_humano",
        humano_assumiu_em: agora,
        humano_assumiu_via: "crm_assumir",
      },
    })
    .eq("id", opts.leadId);

  if (updErr) return { ok: false, error: updErr.message };

  const tel = telefoneConversaId(String(lead.telefone ?? ""));
  if (tel.length >= 10) {
    await cancelarJobsIaPendentesTelefone(supabase, tel);
  }

  try {
    const { data: conv } = await supabase
      .from("hub_conversas")
      .select("id")
      .eq("lead_id", opts.leadId)
      .eq("canal", "whatsapp")
      .is("encerrada_em", null)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conv?.id) {
      await supabase
        .from("hub_conversas")
        .update({
          ia_ativa: false,
          status: "pausada",
          atualizado_em: agora,
        })
        .eq("id", conv.id);
    }
  } catch (e) {
    console.error("[CRM][ASSUMIR] hub_conversas:", e);
  }

  await supabase.from("hub_atividades").insert({
    lead_id: opts.leadId,
    tipo: "ia_acao",
    descricao: `Atendimento assumido por ${opts.humanoSlug}`,
    feito_por: opts.feitoPor,
    feito_por_tipo: "humano",
    tenant_id: defaultTenantId(),
    metadata: {
      acao: "assumir_atendimento",
      humano_anterior: lead.humano_responsavel ?? null,
      actor_id: opts.actorId ?? null,
      actor_email: opts.actorEmail ?? null,
    },
  });

  return { ok: true };
}

export type EnviarMensagemHumanoOpts = {
  leadId: string;
  texto: string;
  feitoPor: string;
  operadorSlug: string;
  actorId?: string | null;
};

export type EnviarMensagemHumanoResult =
  | {
      ok: true;
      whatsappSkipped: boolean;
      whatsapp: { skipped?: boolean; status?: number; body?: unknown; provider?: string };
      tokenOrigem?: string;
    }
  | { ok: false; error: string; status?: number };

export async function enviarMensagemAtendimentoHumano(
  supabase: SupabaseClient,
  opts: EnviarMensagemHumanoOpts
): Promise<EnviarMensagemHumanoResult> {
  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, telefone, humano_responsavel, agente_responsavel, pessoa_id, tenant_id")
    .eq("id", opts.leadId)
    .maybeSingle();

  if (leadErr) return { ok: false, error: leadErr.message };
  if (!lead) return { ok: false, error: "Lead não encontrado" };

  const humano = typeof lead.humano_responsavel === "string" ? lead.humano_responsavel.trim() : "";
  if (!humano) {
    return {
      ok: false,
      error: "Atendimento humano não assumido para este lead. Clique em «Assumir» antes de enviar.",
      status: 403,
    };
  }

  const telefone = onlyDigits(String(lead.telefone ?? ""));
  if (telefone.length < 10) {
    return { ok: false, error: "Lead sem telefone válido para WhatsApp.", status: 400 };
  }

  const tenantId =
    (typeof lead.tenant_id === "string" && lead.tenant_id.trim()) || defaultTenantId();
  const agenteSlug =
    typeof lead.agente_responsavel === "string" ? lead.agente_responsavel.trim() : null;

  const consultorNome = formatHumanoDisplayName(humano || opts.feitoPor || opts.operadorSlug);
  const negocioNome = await resolverNomeNegocioParaTag(supabase, opts.leadId, tenantId, agenteSlug);
  const textoOriginal = opts.texto.trim();
  const textoWhatsapp = formatarMensagemConsultorWhatsapp({
    texto: textoOriginal,
    consultorNome,
    negocioNome,
  });

  let { token: instanceToken, origem: tokenOrigem } = await resolverTokenInstanciaWhatsapp(
    supabase,
    agenteSlug
  );

  let sendSkipped = false;
  let sendInfo: { skipped?: boolean; status?: number; body?: unknown; provider?: string } = {};

  async function tentarEnvio(token: string | null | undefined) {
    return whatsappSendText(telefone, textoWhatsapp, { instanceToken: token });
  }

  if (!whatsappConfigured({ instanceToken })) {
    if (!allowWhatsappDryRun()) {
      return {
        ok: false,
        error:
          "WhatsApp não configurado: conecte um agente em Canais ou defina UAZAPI_BASE_URL + token da instância.",
        status: 502,
      };
    }
    sendSkipped = true;
    sendInfo = { skipped: true };
  } else {
    let envio = await tentarEnvio(instanceToken);
    if (!envio.ok && envio.status === 401) {
      const fallback = await resolverTokenInstanciaWhatsapp(supabase, null);
      if (fallback.token && fallback.token !== instanceToken) {
        envio = await tentarEnvio(fallback.token);
        if (envio.ok) {
          instanceToken = fallback.token;
          tokenOrigem = `${tokenOrigem}|fallback:${fallback.origem}`;
        }
      }
    }
    if (!envio.ok) {
      return {
        ok: false,
        error: erroEnvioWhatsapp(envio.status, envio.error),
        status: envio.status ?? 502,
      };
    }
    sendInfo = { status: envio.status, body: envio.body, provider: envio.provider };
  }

  const agora = new Date().toISOString();

  const conversaId = await ensureConversaAtiva(supabase, {
    leadId: opts.leadId,
    canal: "whatsapp",
    tenantId,
    pessoaId: typeof lead.pessoa_id === "string" ? lead.pessoa_id : null,
    preview: textoOriginal,
  });

  if (conversaId) {
    await gravarMensagemSaidaConversa(supabase, {
      conversaId,
      leadId: opts.leadId,
      tenantId,
      canal: "whatsapp",
      conteudo: textoWhatsapp,
      feitoPor: opts.feitoPor,
      metadata: {
        texto_original: textoOriginal,
        tag_consultor: consultorNome,
        tag_negocio: negocioNome || null,
      },
    });

    await supabase
      .from("hub_conversas")
      .update({
        ia_ativa: false,
        status: "pausada",
        atualizado_em: agora,
      })
      .eq("id", conversaId);
  }

  const filaMetadata = sendSkipped
    ? {
        origem: "crm_atendimento",
        whatsapp_skipped: true,
        motivo: "provedor_whatsapp_ausente_ou_dry_run",
        token_origem: tokenOrigem,
      }
    : {
        origem: "crm_atendimento",
        token_origem: tokenOrigem,
        ...(sendInfo.provider ? { whatsapp_provider: sendInfo.provider } : {}),
      };

  const filaRow: Record<string, unknown> = {
    lead_id: opts.leadId,
    conversa_id: conversaId,
    agente_id: humano || opts.operadorSlug,
    canal: "whatsapp",
    direcao: "saida",
    conteudo: textoWhatsapp,
    status: sendSkipped ? "pendente" : "enviado",
    tenant_id: tenantId,
    resposta_enviada: !sendSkipped,
    enviada_em: sendSkipped ? null : agora,
    metadata: {
      ...filaMetadata,
      feito_por_tipo: "humano",
      feito_por: opts.feitoPor,
      texto_original: textoOriginal,
      tag_consultor: consultorNome,
      tag_negocio: negocioNome || null,
    },
  };

  let filaIns = await supabase.from("hub_fila_mensagens").insert(filaRow);
  if (filaIns.error && isMissingPgColumn(filaIns.error, "conversa_id")) {
    const { conversa_id: _c, ...semConversa } = filaRow;
    filaIns = await supabase.from("hub_fila_mensagens").insert(semConversa);
  }
  if (filaIns.error && isMissingPgColumn(filaIns.error, "tenant_id")) {
    const { tenant_id: _t, ...semTenant } = filaRow;
    filaIns = await supabase.from("hub_fila_mensagens").insert(semTenant);
  }

  if (filaIns.error) {
    return {
      ok: false,
      error: sendSkipped
        ? `Não foi possível gravar a mensagem na fila: ${filaIns.error.message}`
        : `Mensagem enviada ao WhatsApp, mas falha ao gravar fila: ${filaIns.error.message}`,
      status: 500,
    };
  }

  await supabase.from("hub_atividades").insert({
    lead_id: opts.leadId,
    tipo: "mensagem",
    descricao: textoOriginal.slice(0, 500),
    feito_por: opts.feitoPor,
    feito_por_tipo: "humano",
    tenant_id: tenantId,
    metadata: {
      origem: "crm_atendimento",
      actor_id: opts.actorId ?? null,
      tag_consultor: consultorNome,
      tag_negocio: negocioNome || null,
    },
  });

  await supabase
    .from("hub_leads_crm")
    .update({
      ultimo_contato: agora,
      ultima_mensagem: textoOriginal.slice(0, 200),
      atualizado_em: agora,
    })
    .eq("id", opts.leadId);

  return {
    ok: true,
    whatsappSkipped: sendSkipped,
    whatsapp: sendInfo,
    tokenOrigem,
  };
}

export async function devolverAtendimentoParaIa(
  supabase: SupabaseClient,
  opts: { leadId: string; feitoPor: string; humanoAnterior?: string | null; metadata?: unknown }
): Promise<{ metadata: Record<string, unknown> }> {
  const meta =
    opts.metadata && typeof opts.metadata === "object" && !Array.isArray(opts.metadata)
      ? (opts.metadata as Record<string, unknown>)
      : {};
  const agora = new Date().toISOString();

  const novoMeta = {
    ...meta,
    canal_ativo: "direct",
    fase_atendimento: "conversa_ia",
    devolvido_ia_em: agora,
  };

  await supabase
    .from("hub_leads_crm")
    .update({
      humano_responsavel: null,
      metadata: novoMeta,
      atualizado_em: agora,
    })
    .eq("id", opts.leadId);

  try {
    const { data: conv } = await supabase
      .from("hub_conversas")
      .select("id")
      .eq("lead_id", opts.leadId)
      .eq("canal", "whatsapp")
      .is("encerrada_em", null)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conv?.id) {
      await supabase
        .from("hub_conversas")
        .update({
          ia_ativa: true,
          status: "ativa",
          atualizado_em: agora,
        })
        .eq("id", conv.id);
    }
  } catch (e) {
    console.error("[CRM][DEVOLVER-IA] hub_conversas:", e);
  }

  return { metadata: novoMeta };
}
