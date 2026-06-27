import type { SupabaseClient } from "@supabase/supabase-js";
import { buildHubLeadsCrmPatch } from "@/lib/hub/hub-leads-crm-atualizar";
import { extrairNomeClienteDaMensagem } from "@/lib/crm/extrair-nome-cliente";
import {
  nomeLeadEhPlaceholder,
  pushNameParaNomeExibicao,
  resolverNomeExibicaoLead,
} from "@/lib/crm/lead-nome-validacao";

export { nomeLeadEhPlaceholder, pushNameParaNomeExibicao, resolverNomeExibicaoLead };

export function normalizarTelefoneWhatsapp(telefone: string): string {
  return telefone.replace(/\D/g, "").slice(0, 15);
}

export type DadosContatoWhatsapp = {
  telefone: string;
  pushName?: string | null;
  messageId?: string | null;
  tipoMidia?: string | null;
  timestamp?: string | null;
  mercado?: string | null;
  instanceKey?: string | null;
  /** JID UAZAPI (ex. 5511...@s.whatsapp.net ou ...@lid) — preferido no envio outbound. */
  chatid?: string | null;
};

export function mergeMetadataWhatsapp(
  metaBase: Record<string, unknown>,
  dados: DadosContatoWhatsapp
): Record<string, unknown> {
  const tel = normalizarTelefoneWhatsapp(dados.telefone);
  const push = pushNameParaNomeExibicao(dados.pushName);
  const chatid = typeof dados.chatid === "string" ? dados.chatid.trim() : "";
  const out: Record<string, unknown> = {
    ...metaBase,
    wa_telefone: tel,
    wa_ultimo_contacto_em: dados.timestamp || new Date().toISOString(),
  };
  if (chatid && (chatid.includes("@") || chatid.length >= 10)) {
    out.wa_chatid = chatid;
  }
  if (push) out.wa_push_name = push;
  if (dados.messageId?.trim()) out.wa_ultima_message_id = dados.messageId.trim();
  if (dados.tipoMidia?.trim()) out.wa_ultimo_tipo_midia = dados.tipoMidia.trim();
  if (dados.mercado?.trim()) out.wa_mercado_detectado = dados.mercado.trim();
  if (dados.instanceKey?.trim()) out.wa_instance = dados.instanceKey.trim();
  return out;
}

/** Monta patch CRM (telefone, nome se placeholder, metadata WA) sem sobrescrever nome real já confirmado. */
export function montarPatchContatoWhatsapp(
  leadAtual: Record<string, unknown> | null,
  dados: DadosContatoWhatsapp
): Record<string, unknown> {
  const tel = normalizarTelefoneWhatsapp(dados.telefone);
  const patch: Record<string, unknown> = {
    telefone: tel,
    ultimo_contato: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  };

  const metaBase =
    leadAtual?.metadata && typeof leadAtual.metadata === "object" && !Array.isArray(leadAtual.metadata)
      ? (leadAtual.metadata as Record<string, unknown>)
      : {};
  patch.metadata = mergeMetadataWhatsapp(metaBase, dados);

  const nomeAtual = typeof leadAtual?.nome === "string" ? leadAtual.nome : "";
  if (nomeLeadEhPlaceholder(nomeAtual)) {
    patch.nome = resolverNomeExibicaoLead({
      nomeAtual,
      pushName: dados.pushName,
      telefone: tel,
    });
  }

  return patch;
}

/**
 * Garante telefone, perfil WhatsApp (pushName) e metadata no lead + pessoa ligada.
 * Chamar em todo inbound WhatsApp antes da IA.
 */
export async function sincronizarContatoWhatsappNoCrm(
  supabase: SupabaseClient,
  params: {
    leadId: string;
    pessoaId?: string | null;
    dados: DadosContatoWhatsapp;
  }
): Promise<{ ok: boolean; campos?: string[] }> {
  const { leadId, pessoaId, dados } = params;
  const tel = normalizarTelefoneWhatsapp(dados.telefone);
  if (tel.length < 10) return { ok: false };

  const { data: leadAtual } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, metadata, pessoa_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!leadAtual) return { ok: false };

  const patch = montarPatchContatoWhatsapp(leadAtual as Record<string, unknown>, dados);
  const { error } = await supabase.from("hub_leads_crm").update(patch).eq("id", leadId);
  if (error) return { ok: false };

  const nomeWa = pushNameParaNomeExibicao(dados.pushName);
  const pid =
    pessoaId?.trim() ||
    (typeof leadAtual.pessoa_id === "string" ? leadAtual.pessoa_id.trim() : "");
  const nomeAtualLead = typeof leadAtual.nome === "string" ? leadAtual.nome : "";
  const nomeCorrigido =
    typeof patch.nome === "string"
      ? patch.nome
      : nomeWa && nomeLeadEhPlaceholder(nomeAtualLead)
        ? nomeWa
        : undefined;
  if (pid) {
    const pessoaPatch: Record<string, unknown> = {
      telefone: tel,
      whatsapp_id: tel,
      atualizado_em: new Date().toISOString(),
    };
    if (nomeCorrigido) pessoaPatch.nome = nomeCorrigido;
    await supabase.from("hub_pessoas").update(pessoaPatch).eq("id", pid);
  }

  if (nomeCorrigido && nomeLeadEhPlaceholder(nomeAtualLead)) {
    await supabase
      .from("hub_memorias_lead")
      .delete()
      .eq("lead_id", leadId)
      .eq("chave", "nome");
  }

  return { ok: true, campos: Object.keys(patch).filter((k) => k !== "atualizado_em") };
}

/** Texto injectado no system prompt — dados já fiáveis do canal. */
export function blocoDadosCanalWhatsappCrm(dados: {
  telefone?: string;
  pushName?: string | null;
  leadId?: string;
}): string {
  const tel = dados.telefone ? normalizarTelefoneWhatsapp(dados.telefone) : "";
  const push = pushNameParaNomeExibicao(dados.pushName);
  const linhas = [
    "═══ DADOS DO CANAL (WhatsApp → CRM) ═══",
    "O telefone do cliente já está gravado no CRM — não peça o número de novo.",
  ];
  if (tel) linhas.push(`- Telefone da sessão: ${tel}`);
  if (push) {
    linhas.push(
      `- Nome no perfil WhatsApp (pista, pode estar errado): ${push}. Só use o primeiro nome na saudação se for claramente o contacto desta conversa. Se a mensagem for só «Olá»/«Oi», não assuma nome — pergunte conforme o playbook.`
    );
  }
  linhas.push(
    "- Sempre que o cliente revelar nome, e-mail, interesse, cidade, orçamento ou escolher fluxo/menu: chame **hub_atualizar_lead** na mesma volta (antes ou junto da resposta), sem anunciar «vou salvar no CRM».",
    "- Para saber o que já está gravado **deste contacto**: **hub_lead_resumo** (não invente dados nem use memória de outro número).",
    "- Atendimento fluido: responda em 1–3 linhas e grave em paralelo — não encerre o turno só para «registar» depois.",
    "- Nunca consulte outro telefone com hub_lead_lookup_por_telefone — só o desta sessão."
  );
  return linhas.join("\n");
}

/** Após turno IA: reforça CRM se o modelo não chamou hub_atualizar_lead mas há dados na mensagem. */
export async function reforcarCrmAposTurnoWhatsapp(
  supabase: SupabaseClient,
  params: {
    leadId: string;
    mensagemUsuario: string;
    pushName?: string | null;
    telefone?: string;
    toolCallsExecutadas?: Array<{ nome: string; ok: boolean }>;
  }
): Promise<void> {
  const usouAtualizar = (params.toolCallsExecutadas ?? []).some(
    (t) => t.nome === "hub_atualizar_lead" && t.ok
  );

  const args: Record<string, unknown> = {};
  const nomeMsg = extrairNomeClienteDaMensagem(params.mensagemUsuario, {
    respostaCurtaPermitida: false,
  });
  if (nomeMsg) args.nome = nomeMsg;
  else if (params.pushName) {
    const n = pushNameParaNomeExibicao(params.pushName);
    const { data: leadAtualNome } = await supabase
      .from("hub_leads_crm")
      .select("nome")
      .eq("id", params.leadId)
      .maybeSingle();
    const atual = typeof leadAtualNome?.nome === "string" ? leadAtualNome.nome : "";
    if (n && nomeLeadEhPlaceholder(atual)) args.nome = n;
  }

  const interesse = extrairInteresseHeuristico(params.mensagemUsuario);
  if (interesse) args.interesse_principal = interesse;

  if (params.telefone) {
    const meta: Record<string, unknown> = { wa_telefone: normalizarTelefoneWhatsapp(params.telefone) };
    if (params.pushName) {
      const p = pushNameParaNomeExibicao(params.pushName);
      if (p) meta.wa_push_name = p;
    }
    args.metadata = meta;
  }

  if (Object.keys(args).length === 0) return;
  if (usouAtualizar && !nomeMsg && !interesse) return;

  const { data: leadAtual } = await supabase
    .from("hub_leads_crm")
    .select("nome, estagio, metadata")
    .eq("id", params.leadId)
    .maybeSingle();
  if (!leadAtual) return;

  const built = buildHubLeadsCrmPatch(args, leadAtual as Record<string, unknown>);
  if (!built.ok) return;
  await supabase.from("hub_leads_crm").update(built.patch).eq("id", params.leadId);
}

function extrairInteresseHeuristico(mensagem: string): string | undefined {
  const t = mensagem.trim();
  if (t.length < 12 || t.length > 400) return undefined;
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem)\s*!?\.?$/i.test(t)) return undefined;
  return t.slice(0, 500);
}
