import type { SupabaseClient } from "@supabase/supabase-js";
import { buildHubLeadsCrmPatch } from "@/lib/hub/hub-leads-crm-atualizar";

/** Nome genérico de lead — deve ser substituído por pushName ou nome dito pelo cliente. */
export function nomeLeadEhPlaceholder(nome: string | null | undefined): boolean {
  const n = String(nome ?? "").trim().toLowerCase();
  if (!n || n.length < 2) return true;
  if (n.startsWith("lead ")) return true;
  if (n === "lead whatsapp") return true;
  if (/^lead\s*\d{3,4}$/.test(n)) return true;
  return false;
}

export function normalizarTelefoneWhatsapp(telefone: string): string {
  return telefone.replace(/\D/g, "").slice(0, 15);
}

export function pushNameParaNomeExibicao(pushName: string | null | undefined): string | undefined {
  const raw = String(pushName ?? "").trim();
  if (!raw || raw.length < 2) return undefined;
  const lower = raw.toLowerCase();
  if (lower === "whatsapp" || lower === "unknown") return undefined;
  const parts = raw.split(/\s+/).filter(Boolean).slice(0, 4);
  const nome = parts.join(" ").slice(0, 240);
  return nomeLeadEhPlaceholder(nome) ? undefined : nome;
}

export type DadosContatoWhatsapp = {
  telefone: string;
  pushName?: string | null;
  messageId?: string | null;
  tipoMidia?: string | null;
  timestamp?: string | null;
  mercado?: string | null;
  instanceKey?: string | null;
};

export function mergeMetadataWhatsapp(
  metaBase: Record<string, unknown>,
  dados: DadosContatoWhatsapp
): Record<string, unknown> {
  const tel = normalizarTelefoneWhatsapp(dados.telefone);
  const push = pushNameParaNomeExibicao(dados.pushName);
  const out: Record<string, unknown> = {
    ...metaBase,
    wa_telefone: tel,
    wa_ultimo_contacto_em: dados.timestamp || new Date().toISOString(),
  };
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
  const nomeWa = pushNameParaNomeExibicao(dados.pushName);
  if (nomeWa && nomeLeadEhPlaceholder(nomeAtual)) {
    patch.nome = nomeWa;
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
  if (pid) {
    const pessoaPatch: Record<string, unknown> = {
      telefone: tel,
      whatsapp_id: tel,
      atualizado_em: new Date().toISOString(),
    };
    if (nomeWa) pessoaPatch.nome = nomeWa;
    await supabase.from("hub_pessoas").update(pessoaPatch).eq("id", pid);
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
  const nomeMsg = extrairNomeDaMensagemCliente(params.mensagemUsuario);
  if (nomeMsg) args.nome = nomeMsg;
  else if (params.pushName) {
    const n = pushNameParaNomeExibicao(params.pushName);
    if (n) args.nome = n;
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

function extrairNomeDaMensagemCliente(mensagem: string): string | undefined {
  const m = mensagem.match(
    /(?:me chamo|meu nome é|meu nome e|sou o|sou a|aqui é|pode me chamar de)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{1,48})/i
  );
  if (!m?.[1]) return undefined;
  const nome = m[1].trim().split(/\s+/).slice(0, 4).join(" ");
  return nomeLeadEhPlaceholder(nome) ? undefined : nome.slice(0, 240);
}

function extrairInteresseHeuristico(mensagem: string): string | undefined {
  const t = mensagem.trim();
  if (t.length < 12 || t.length > 400) return undefined;
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem)\s*!?\.?$/i.test(t)) return undefined;
  return t.slice(0, 500);
}
