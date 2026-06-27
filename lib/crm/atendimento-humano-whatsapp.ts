import type { SupabaseClient } from "@supabase/supabase-js";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";
import { resolverDestinoWhatsappLead, resolverTelefoneWhatsappLead } from "@/lib/crm/resolver-telefone-whatsapp-lead";
import { ensureConversaAtiva, gravarMensagemSaidaConversa } from "@/lib/crm/conversa-canal";
import { formatarMensagemConsultorWhatsapp } from "@/lib/crm/mensagem-consultor-whatsapp";
import { resolverTokenInstanciaWhatsapp } from "@/lib/crm/resolver-token-whatsapp";
import { formatHumanoDisplayName } from "@/lib/crm/resolve-crm-actor";
import { extrairMensagemErroUazapi } from "@/lib/whatsapp/uazapi-http";
import { defaultTenantId } from "@/lib/tenant-default";
import { insertFilaMensagemCompat } from "@/lib/crm/insert-fila-mensagem-compat";
import { extrairWhatsappMessageIdDeRespostaUazapi } from "@/lib/whatsapp/uazapi-response";
import { cancelarJobsIaPendentesTelefone } from "@/lib/whatsapp/human-handoff-from-device";
import { whatsappConfigured, whatsappSendMedia, whatsappSendText } from "@/lib/whatsapp/whatsapp-send";
import {
  base64ParaUazapiFile,
  placeholderMidiaEnviada,
  tipoMidiaChatDeMime,
  uazapiTipoDeMime,
  type MidiaAnexoEnviar,
} from "@/lib/crm/atendimento-midia-envio";

function maskTelefone(tel: string): string {
  const d = tel.replace(/\D/g, "");
  if (d.length < 6) return "***";
  return `***${d.slice(-4)}`;
}

function logAtendimentoSend(fields: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: "crm_atendimento",
      service: "escritorio-virtual",
      ...fields,
    })
  );
}

function allowWhatsappDryRun(): boolean {
  return process.env.NODE_ENV === "development" || process.env.WHATSAPP_DRY_RUN === "1";
}

function erroEnvioWhatsapp(status: number | undefined, error: string, body?: unknown): string {
  if (status === 401) {
    return "WhatsApp recusou o token (401). Reconecte a instância em Agentes → Canais → WhatsApp.";
  }
  if (status === 403) {
    return "WhatsApp recusou o envio (403). Verifique se a instância está ligada e autorizada.";
  }
  if (body && typeof body === "object" && body !== null) {
    const o = body as Record<string, unknown>;
    if (o.error_key === "WHATSAPP_REACHOUT_TIMELOCK") {
      return extrairMensagemErroUazapi(body, status ?? 500);
    }
  }
  if (error && error !== `HTTP ${status}` && !/^HTTP \d+$/.test(error.trim())) {
    return error;
  }
  if (body) {
    const parsed = extrairMensagemErroUazapi(body, status ?? 500);
    if (parsed && parsed !== `HTTP ${status}`) return parsed;
  }
  return error || "WhatsApp recusou o envio. Verifique a instância e se o cliente pode receber mensagens.";
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
  texto?: string;
  midia?: MidiaAnexoEnviar;
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
      aviso?: string;
    }
  | { ok: false; error: string; status?: number };

export async function enviarMensagemAtendimentoHumano(
  supabase: SupabaseClient,
  opts: EnviarMensagemHumanoOpts
): Promise<EnviarMensagemHumanoResult> {
  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, telefone, humano_responsavel, agente_responsavel, pessoa_id, tenant_id, metadata")
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

  const telefone = resolverTelefoneWhatsappLead(lead);
  const destinoWhatsapp = resolverDestinoWhatsappLead(lead);
  if (telefone.length < 10) {
    return { ok: false, error: "Lead sem telefone válido para WhatsApp.", status: 400 };
  }

  const tenantId =
    (typeof lead.tenant_id === "string" && lead.tenant_id.trim()) || defaultTenantId();
  const agenteSlug =
    typeof lead.agente_responsavel === "string" ? lead.agente_responsavel.trim() : null;

  const consultorNome = formatHumanoDisplayName(humano || opts.feitoPor || opts.operadorSlug);
  const textoOriginal = (opts.texto ?? "").trim();
  const midia = opts.midia;

  if (!textoOriginal && !midia) {
    return { ok: false, error: "Informe texto ou anexe um arquivo.", status: 400 };
  }

  const legendaOriginal = midia?.legenda?.trim() || textoOriginal;
  const textoWhatsapp = legendaOriginal
    ? formatarMensagemConsultorWhatsapp({ texto: legendaOriginal, consultorNome })
    : formatarMensagemConsultorWhatsapp({ texto: "", consultorNome }).trim();

  const tipoMidiaChat = midia ? tipoMidiaChatDeMime(midia.mimeType) : null;
  const uazapiTipo = midia ? uazapiTipoDeMime(midia.mimeType) : null;
  const conteudoGravacao = midia
    ? legendaOriginal || placeholderMidiaEnviada(tipoMidiaChat!)
    : textoWhatsapp;
  const previewConversa = midia
    ? legendaOriginal.slice(0, 100) || placeholderMidiaEnviada(tipoMidiaChat!)
    : textoOriginal;

  let { token: instanceToken, origem: tokenOrigem } = await resolverTokenInstanciaWhatsapp(
    supabase,
    agenteSlug
  );

  let sendSkipped = false;
  let sendInfo: { skipped?: boolean; status?: number; body?: unknown; provider?: string } = {};

  async function tentarEnvioTexto(token: string | null | undefined) {
    return whatsappSendText(destinoWhatsapp, textoWhatsapp, { instanceToken: token });
  }

  async function tentarEnvioMidia(token: string | null | undefined) {
    if (!midia || !uazapiTipo) {
      return { ok: false as const, error: "Tipo de mídia inválido." };
    }
    return whatsappSendMedia(destinoWhatsapp, {
      type: uazapiTipo,
      file: base64ParaUazapiFile(midia.base64, midia.mimeType),
      caption: textoWhatsapp || undefined,
      docName: midia.nomeArquivo,
      mimetype: midia.mimeType,
      instanceToken: token,
    });
  }

  if (!whatsappConfigured({ instanceToken })) {
    const detalheToken =
      tokenOrigem.includes("desconectado") || !instanceToken
        ? "WhatsApp do agente não está conectado. Reconecte em Agentes → Canais → WhatsApp."
        : "WhatsApp não configurado. Reconecte o canal em Agentes → Canais.";
    if (!allowWhatsappDryRun()) {
      logAtendimentoSend({
        event: "send_skip",
        lead_id: opts.leadId,
        telefone: maskTelefone(telefone),
        agente_slug: agenteSlug,
        token_origem: tokenOrigem,
        motivo: detalheToken,
      });
      return {
        ok: false,
        error: detalheToken,
        status: 502,
      };
    }
    sendSkipped = true;
    sendInfo = { skipped: true };
  } else {
    let envio = midia ? await tentarEnvioMidia(instanceToken) : await tentarEnvioTexto(instanceToken);
    if (!envio.ok && envio.status === 401) {
      const fallback = await resolverTokenInstanciaWhatsapp(supabase, null);
      if (fallback.token && fallback.token !== instanceToken) {
        envio = midia
          ? await tentarEnvioMidia(fallback.token)
          : await tentarEnvioTexto(fallback.token);
        if (envio.ok) {
          instanceToken = fallback.token;
          tokenOrigem = `${tokenOrigem}|fallback:${fallback.origem}`;
        }
      }
    }
    if (!envio.ok) {
      const erroUsuario = erroEnvioWhatsapp(envio.status, envio.error, envio.body);
      logAtendimentoSend({
        event: "send_fail",
        lead_id: opts.leadId,
        telefone: maskTelefone(telefone),
        destino_whatsapp: destinoWhatsapp.includes("@") ? destinoWhatsapp.split("@")[0] + "@…" : maskTelefone(destinoWhatsapp),
        agente_slug: agenteSlug,
        token_origem: tokenOrigem,
        status: envio.status,
        error: envio.error,
        error_user: erroUsuario,
        uazapi_body: envio.body,
      });
      return {
        ok: false,
        error: erroUsuario,
        status: envio.status ?? 502,
      };
    }
    sendInfo = { status: envio.status, body: envio.body, provider: envio.provider };
    logAtendimentoSend({
      event: "send_ok",
      lead_id: opts.leadId,
      telefone: maskTelefone(telefone),
      agente_slug: agenteSlug,
      token_origem: tokenOrigem,
      status: envio.status,
      whatsapp_message_id: extrairWhatsappMessageIdDeRespostaUazapi(envio.body),
    });
  }

  const whatsappMessageId = extrairWhatsappMessageIdDeRespostaUazapi(sendInfo.body);
  let avisoEntrega: string | undefined;
  if (!sendSkipped && !whatsappMessageId) {
    avisoEntrega =
      "WhatsApp aceitou o pedido mas não devolveu ID da mensagem — confira no telefone do cliente se chegou.";
    console.warn("[CRM][ATENDIMENTO] UAZAPI sem message id:", sendInfo.body);
  }
  const urlMidiaPreview =
    midia && midia.mimeType.startsWith("image/")
      ? base64ParaUazapiFile(midia.base64, midia.mimeType)
      : null;

  const agora = new Date().toISOString();

  const conversaId = await ensureConversaAtiva(supabase, {
    leadId: opts.leadId,
    canal: "whatsapp",
    tenantId,
    pessoaId: typeof lead.pessoa_id === "string" ? lead.pessoa_id : null,
    preview: previewConversa,
  });

  const metadataComum = {
    texto_original: legendaOriginal || textoOriginal || null,
    tag_consultor: consultorNome,
    ...(whatsappMessageId ? { whatsapp_message_id: whatsappMessageId, message_id: whatsappMessageId } : {}),
    ...(midia
      ? {
          tipo_midia: tipoMidiaChat,
          nome_arquivo: midia.nomeArquivo,
          mime_type: midia.mimeType,
          ...(urlMidiaPreview ? { url_midia: urlMidiaPreview } : {}),
        }
      : {}),
  };

  let hubMensagensGravada = false;
  if (conversaId) {
    hubMensagensGravada = await gravarMensagemSaidaConversa(supabase, {
      conversaId,
      leadId: opts.leadId,
      tenantId,
      canal: "whatsapp",
      conteudo: conteudoGravacao,
      feitoPor: opts.feitoPor,
      tipoConteudo: tipoMidiaChat ?? "texto",
      nomeArquivo: midia?.nomeArquivo ?? null,
      urlMidia: urlMidiaPreview,
      whatsappMessageId,
      metadata: metadataComum,
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
    conteudo: conteudoGravacao,
    status: sendSkipped ? "pendente" : "enviado",
    tenant_id: tenantId,
    resposta_enviada: !sendSkipped,
    enviada_em: sendSkipped ? null : agora,
    ...(whatsappMessageId ? { whatsapp_message_id: whatsappMessageId } : {}),
    ...(urlMidiaPreview ? { url_midia: urlMidiaPreview } : {}),
    metadata: {
      ...filaMetadata,
      feito_por_tipo: "humano",
      feito_por: opts.feitoPor,
      ...metadataComum,
    },
  };

  if (midia && tipoMidiaChat) {
    filaRow.tipo_conteudo = tipoMidiaChat;
    filaRow.tipo_midia = tipoMidiaChat;
    filaRow.nome_arquivo = midia.nomeArquivo;
  }

  const filaIns = await insertFilaMensagemCompat(supabase, filaRow);

  if (filaIns.error) {
    if (hubMensagensGravada || sendSkipped) {
      console.warn("[CRM][ATENDIMENTO] hub_fila_mensagens:", filaIns.error.message);
    } else {
      return {
        ok: false,
        error: sendSkipped
          ? `Não foi possível gravar a mensagem na fila: ${filaIns.error.message}`
          : `Mensagem enviada ao WhatsApp, mas falha ao gravar fila: ${filaIns.error.message}`,
        status: 500,
      };
    }
  }

  await supabase.from("hub_atividades").insert({
    lead_id: opts.leadId,
    tipo: "mensagem",
    descricao: (legendaOriginal || previewConversa).slice(0, 500),
    feito_por: opts.feitoPor,
    feito_por_tipo: "humano",
    tenant_id: tenantId,
    metadata: {
      origem: "crm_atendimento",
      actor_id: opts.actorId ?? null,
      tag_consultor: consultorNome,
      ...(midia ? { tipo_midia: tipoMidiaChat, nome_arquivo: midia.nomeArquivo } : {}),
    },
  });

  await supabase
    .from("hub_leads_crm")
    .update({
      ultimo_contato: agora,
      ultima_mensagem: previewConversa.slice(0, 200),
      atualizado_em: agora,
    })
    .eq("id", opts.leadId);

  return {
    ok: true,
    whatsappSkipped: sendSkipped,
    whatsapp: sendInfo,
    tokenOrigem,
    ...(filaIns.error
      ? { aviso: "Mensagem registada no histórico; fila auxiliar não gravada (migração pendente)." }
      : {}),
    ...(avisoEntrega ? { aviso: avisoEntrega } : {}),
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
