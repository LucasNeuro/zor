import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";

export type CanalConversa = "whatsapp" | "email";

export async function ensureConversaAtiva(
  supabase: SupabaseClient,
  opts: {
    leadId: string;
    canal: CanalConversa;
    tenantId?: string;
    pessoaId?: string | null;
    iaModelo?: string | null;
    preview?: string | null;
  }
): Promise<string | null> {
  const tenantId = opts.tenantId?.trim() || defaultTenantId();
  const agora = new Date().toISOString();

  const { data: existente } = await supabase
    .from("hub_conversas")
    .select("id")
    .eq("lead_id", opts.leadId)
    .eq("canal", opts.canal)
    .is("encerrada_em", null)
    .maybeSingle();

  if (existente?.id) {
    const patch: Record<string, unknown> = {
      ultima_mensagem_em: agora,
      atualizado_em: agora,
    };
    if (opts.preview?.trim()) {
      patch.ultima_mensagem_preview = opts.preview.trim().slice(0, 100);
    }
    await supabase.from("hub_conversas").update(patch).eq("id", existente.id);
    return existente.id as string;
  }

  const { data: nova, error } = await supabase
    .from("hub_conversas")
    .insert({
      lead_id: opts.leadId,
      pessoa_id: opts.pessoaId ?? null,
      canal: opts.canal,
      status: "ativa",
      ia_ativa: true,
      ia_modelo: opts.iaModelo ?? "mistral-small-latest",
      total_mensagens: 0,
      ultima_mensagem_em: agora,
      ultima_mensagem_preview: opts.preview?.trim().slice(0, 100) ?? null,
      aberta_em: agora,
      tenant_id: tenantId,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[conversa-canal] ensureConversaAtiva ${opts.canal}:`, error.message);
    return null;
  }
  return nova?.id ? String(nova.id) : null;
}

export async function gravarParMensagensConversa(
  supabase: SupabaseClient,
  opts: {
    conversaId: string;
    leadId: string;
    tenantId?: string;
    canal: CanalConversa;
    entrada: {
      conteudo: string;
      enviadaEm?: string;
      emailSubject?: string | null;
      emailMessageId?: string | null;
      metadados?: Record<string, unknown>;
    };
    saida: {
      conteudo: string;
      remetente: "ia" | "humano";
      agenteId?: string | null;
      iaModelo?: string | null;
      enviadaEm?: string;
      emailSubject?: string | null;
      emailMessageId?: string | null;
      emailInReplyTo?: string | null;
      emailStatus?: string | null;
      metadados?: Record<string, unknown>;
    };
  }
): Promise<void> {
  const tenantId = opts.tenantId?.trim() || defaultTenantId();
  const agora = new Date().toISOString();

  const rows: Record<string, unknown>[] = [
    {
      conversa_id: opts.conversaId,
      lead_id: opts.leadId,
      remetente: "lead",
      tipo_conteudo: "texto",
      conteudo: opts.entrada.conteudo,
      email_subject: opts.entrada.emailSubject ?? null,
      email_message_id: opts.entrada.emailMessageId ?? null,
      enviada_em: opts.entrada.enviadaEm ?? agora,
      tenant_id: tenantId,
      metadados: { canal: opts.canal, ...(opts.entrada.metadados ?? {}) },
    },
    {
      conversa_id: opts.conversaId,
      lead_id: opts.leadId,
      remetente: opts.saida.remetente,
      agente_id: opts.saida.agenteId ?? null,
      ia_modelo: opts.saida.iaModelo ?? null,
      tipo_conteudo: "texto",
      conteudo: opts.saida.conteudo,
      email_subject: opts.saida.emailSubject ?? null,
      email_message_id: opts.saida.emailMessageId ?? null,
      email_in_reply_to: opts.saida.emailInReplyTo ?? null,
      email_status: opts.saida.emailStatus ?? "enviado",
      enviada_em: opts.saida.enviadaEm ?? agora,
      tenant_id: tenantId,
      metadados: { canal: opts.canal, ...(opts.saida.metadados ?? {}) },
    },
  ];

  const { error } = await supabase.from("hub_mensagens").insert(rows);
  if (error) {
    console.error(`[conversa-canal] gravarParMensagens ${opts.canal}:`, error.message);
    return;
  }

  await supabase
    .from("hub_conversas")
    .update({
      ultima_mensagem_em: agora,
      ultima_mensagem_preview: opts.saida.conteudo.slice(0, 100),
      atualizado_em: agora,
    })
    .eq("id", opts.conversaId);
}

export async function gravarMensagemSaidaConversa(
  supabase: SupabaseClient,
  opts: {
    conversaId: string;
    leadId: string;
    tenantId?: string;
    canal: CanalConversa;
    conteudo: string;
    feitoPor: string;
    tipoConteudo?: string;
    urlMidia?: string | null;
    nomeArquivo?: string | null;
    emailSubject?: string | null;
    emailMessageId?: string | null;
    emailInReplyTo?: string | null;
    emailStatus?: string | null;
    whatsappMessageId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<boolean> {
  const tenantId = opts.tenantId?.trim() || defaultTenantId();
  const agora = new Date().toISOString();

  const row: Record<string, unknown> = {
    conversa_id: opts.conversaId,
    lead_id: opts.leadId,
    remetente: "humano",
    tipo_conteudo: opts.tipoConteudo ?? "texto",
    conteudo: opts.conteudo,
    url_midia: opts.urlMidia ?? null,
    nome_arquivo: opts.nomeArquivo ?? null,
    email_subject: opts.emailSubject ?? null,
    email_message_id: opts.emailMessageId ?? null,
    email_in_reply_to: opts.emailInReplyTo ?? null,
    email_status: opts.emailStatus ?? "enviado",
    enviada_em: agora,
    tenant_id: tenantId,
    metadados: {
      canal: opts.canal,
      feito_por: opts.feitoPor,
      feito_por_tipo: "humano",
      ...(opts.whatsappMessageId
        ? { whatsapp_message_id: opts.whatsappMessageId, message_id: opts.whatsappMessageId }
        : {}),
      ...(opts.metadata ?? {}),
    },
  };

  if (opts.whatsappMessageId?.trim()) {
    row.whatsapp_message_id = opts.whatsappMessageId.trim();
  }

  let current: Record<string, unknown> = { ...row };
  const optionalCols = ["whatsapp_message_id", "url_midia", "nome_arquivo", "tenant_id"] as const;

  let error: { message: string } | null = null;
  for (let attempt = 0; attempt <= optionalCols.length; attempt++) {
    const res = await supabase.from("hub_mensagens").insert(current);
    error = res.error;
    if (!error) break;

    if (!isMissingPgColumn(error)) break;

    const msg = (error.message ?? "").toLowerCase();
    let stripped = false;
    for (const col of optionalCols) {
      if (col in current && msg.includes(col.toLowerCase())) {
        const next = { ...current };
        delete next[col];
        current = next;
        stripped = true;
        break;
      }
    }
    if (!stripped) break;
  }

  if (error) {
    console.error(`[conversa-canal] gravarMensagemSaida ${opts.canal}:`, error.message);
    return false;
  }

  await supabase
    .from("hub_conversas")
    .update({
      ultima_mensagem_em: agora,
      ultima_mensagem_preview: opts.conteudo.slice(0, 100),
      atualizado_em: agora,
    })
    .eq("id", opts.conversaId);

  return true;
}
