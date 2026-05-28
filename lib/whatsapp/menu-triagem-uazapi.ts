import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";

/** Triagem inicial — Playbook Unificado Maria (5 opções, tipo list). */
export const MENU_PLAYBOOK_TRIAGEM_INICIAL = [
  "[O que você precisa hoje?]",
  "Projeto arquitetura / design|triagem_arq|Projeto, interiores ou reforma",
  "Comprar, vender ou alugar imóvel|triagem_imob|Mercado imobiliário",
  "Arquiteto/corretor homologação|triagem_homolog|Cadastro profissional ou parceria",
  "Proprietário anunciar imóvel|triagem_prop_anunciar|Quero anunciar meu imóvel",
  "Outro|triagem_outro|Outro assunto",
] as const;

/** Opções legadas (compatibilidade IA / docs antigos). */
export const MENU_TRIAGEM_CHOICES_LISTA = [
  "[O que você precisa]",
  "Buscar imóvel|fluxo1|Compra ou locação",
  "Anunciar imóvel|fluxo2|Venda ou locação do meu imóvel",
  "Corretor / imobiliária|fluxo3|Parceria ou cadastro profissional",
  "Arquitetura e projetos|fluxo_arquitetura|Projeto, interiores ou reforma com projeto",
] as const;

/** Até 3 botões — WhatsApp limita respostas rápidas. */
export const MENU_TRIAGEM_CHOICES_BOTOES = [
  "Imóveis (comprar ou anunciar)|fluxo_imobiliario",
  "Arquitetura / projeto|fluxo_arquitetura",
  "Sou corretor ou parceiro|fluxo_parceiro",
] as const;

/** Triagem principal em 2 botões (legado). */
export const MENU_TRIAGEM_BOTOES_IMOB_ARQ = [
  "Imóveis|fluxo_imobiliario",
  "Arquitetura|fluxo_arquitetura",
] as const;

export const MENU_TRIAGEM_TEXTO_PADRAO =
  "Olá! Sou a Mari do HUB Obra 10+.\n\nPara te orientar, o que você precisa hoje?";

export const MENU_PLAYBOOK_TRIAGEM_TEXTO =
  "Para te orientar melhor, escolha uma opção abaixo:";

export type MenuTriagemVariante = "list" | "button" | "button_imob_arq" | "playbook_triagem";

function choicesParaVariante(variante: MenuTriagemVariante): string[] {
  if (variante === "playbook_triagem") return [...MENU_PLAYBOOK_TRIAGEM_INICIAL];
  if (variante === "list") return [...MENU_TRIAGEM_CHOICES_LISTA];
  if (variante === "button_imob_arq") return [...MENU_TRIAGEM_BOTOES_IMOB_ARQ];
  return [...MENU_TRIAGEM_CHOICES_BOTOES];
}

export type EnviarMenuTriagemResult =
  | { ok: true; endpoint: string }
  | { ok: false; erro: string; detalhe?: string };

export type EnviarMenuUazapiParams = {
  telefone: string;
  instanceToken: string;
  texto: string;
  tipo: "list" | "button";
  choices: string[];
  listButton?: string;
  footerText?: string;
};

export async function enviarMenuUazapi(params: EnviarMenuUazapiParams): Promise<EnviarMenuTriagemResult> {
  const number = params.telefone.replace(/\D/g, "");
  const token = params.instanceToken.trim();
  if (!number || number.length < 10) {
    return { ok: false, erro: "telefone_invalido" };
  }
  if (!token) {
    return { ok: false, erro: "uazapi_token_instancia_ausente" };
  }
  if (!params.choices.length) {
    return { ok: false, erro: "opcoes_vazias" };
  }

  const body: Record<string, unknown> = {
    number,
    type: params.tipo,
    text: params.texto.slice(0, 4000),
    choices: params.choices,
    footerText: (params.footerText || "HUB Obra 10+").slice(0, 500),
  };
  if (params.tipo === "list") {
    body.listButton = (params.listButton || "Ver opções").slice(0, 120);
  }

  const res = await uazapiFetchJson<unknown>("/send/menu", {
    method: "POST",
    instanceToken: token,
    body,
  });

  if (!res.ok) {
    return { ok: false, erro: "uazapi_menu_falhou", detalhe: res.error };
  }
  return { ok: true, endpoint: "/send/menu" };
}

export function mensagemEhSaudacaoSimples(mensagem: string): boolean {
  const t = mensagem.trim().toLowerCase().replace(/[!?.…]+$/g, "");
  if (!t || t.length > 40) return false;
  return /^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|e aí|eai|opa|salve)(\s|$)/i.test(t);
}

/** Lead pede menu / opções em texto livre (a IA não deve listar 1️⃣2️⃣ no chat). */
export function mensagemPedeMenuOuOpcoes(mensagem: string): boolean {
  const t = mensagem.trim().toLowerCase();
  if (!t || t.length > 160) return false;
  return (
    /\b(opções|opcoes|menu)\b/.test(t) ||
    /quais?\s+(s[aã]o\s+)?(as\s+)?(opções|opcoes)/.test(t) ||
    /\bo\s+que\s+(você\s+)?pode\s+fazer\b/.test(t) ||
    /\b(me\s+)?(mostra|manda|envia|mandar)\s+(o\s+)?(menu|opções|opcoes)\b/.test(t) ||
    /\bquero\s+ver\s+(as\s+)?(opções|opcoes)\b/.test(t) ||
    /\bescolher\s+uma\s+opção\b/.test(t)
  );
}

export async function marcarMenuTriagemEnviado(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  leadId: string
): Promise<void> {
  const { data: row } = await supabase
    .from("hub_leads_crm")
    .select("metadata")
    .eq("id", leadId)
    .maybeSingle();
  const meta =
    row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? { ...(row.metadata as Record<string, unknown>) }
      : {};
  meta.wa_menu_triagem_enviado = true;
  meta.wa_menu_triagem_enviado_at = new Date().toISOString();
  await supabase.from("hub_leads_crm").update({ metadata: meta }).eq("id", leadId);
}

export async function enviarMenuTriagemInicialUazapi(params: {
  telefone: string;
  instanceToken: string;
  texto?: string;
  /** list = 4 opções legado; playbook_triagem = 5 opções POP Maria; button = 3 botões; button_imob_arq = 2 botões */
  variante?: MenuTriagemVariante;
}): Promise<EnviarMenuTriagemResult> {
  const variante = params.variante ?? "playbook_triagem";
  const tipo = variante === "list" || variante === "playbook_triagem" ? "list" : "button";
  const choices = choicesParaVariante(variante);
  const texto =
    params.texto?.trim() ||
    (variante === "playbook_triagem" ? MENU_PLAYBOOK_TRIAGEM_TEXTO : MENU_TRIAGEM_TEXTO_PADRAO);

  return enviarMenuUazapi({
    telefone: params.telefone,
    instanceToken: params.instanceToken,
    texto,
    tipo,
    choices: [...choices],
  });
}

export function leadJaRecebeuMenuTriagem(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const m = metadata as Record<string, unknown>;
  return m.wa_menu_triagem_enviado === true || Boolean(m.wa_menu_triagem_enviado_at);
}
