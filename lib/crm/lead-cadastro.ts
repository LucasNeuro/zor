import type { SupabaseClient } from "@supabase/supabase-js";
import { mercadosLeadComPadrao } from "@/lib/crm/cadastro-flexivel";
import { gerarCodigoSequencial, HUB_PREFIXO_CODIGO } from "@/lib/crm/codigos-rastreio";
import { MERCADOS_PREFIXO, type PrefixoMercado } from "@/lib/crm/negocio-cadastro";

export const LEAD_ESTAGIOS = [
  "novo",
  "qualificando",
  "qualificado",
  "proposta",
  "negociando",
  "fechamento",
  "ganho",
  "perdido",
] as const;

export type LeadEstagio = (typeof LEAD_ESTAGIOS)[number];

export const LEAD_ORIGENS = [
  "whatsapp",
  "instagram",
  "meta_ads",
  "google_ads",
  "linkedin",
  "site",
  "indicacao",
  "interno",
  "outro",
] as const;

export type LeadOrigem = (typeof LEAD_ORIGENS)[number];

export type LeadCadastroPayload = {
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: LeadOrigem;
  estagio: LeadEstagio;
  valor_estimado: number;
  mercados: PrefixoMercado[];
  mercado_principal: PrefixoMercado;
};

/** Metadata de lead alinhada ao super cadastro (mercados + rastreio). */
export function montarMetadataLeadMercados(opts: {
  mercados: string[];
  origem_cadastro?: string;
  indicado_por?: string | null;
}): Record<string, unknown> {
  const mercados = mercadosLeadComPadrao(opts.mercados);
  return {
    origem_cadastro: opts.origem_cadastro ?? "crm_manual",
    mercados,
    mercado_principal: mercados[0],
    ...(opts.indicado_por ? { indicado_por: opts.indicado_por } : {}),
  };
}

function parseMercadosBody(body: unknown): string[] {
  if (!Array.isArray(body)) return [];
  return body
    .map((x) => String(x).trim().toUpperCase())
    .filter((s): s is PrefixoMercado => (MERCADOS_PREFIXO as readonly string[]).includes(s));
}

export function normalizarTelefoneLead(t: string): string {
  return t.replace(/\D/g, "");
}

export function validarLeadCadastro(
  body: Partial<{
    nome?: string;
    telefone?: string | null;
    email?: string | null;
    origem?: string;
    estagio?: string;
    valor_estimado?: number | string;
    mercados?: unknown;
  }>
): { ok: true; data: LeadCadastroPayload } | { ok: false; erro: string } {
  const nome = (body.nome || "").trim();
  if (!nome || nome.length < 2) {
    return { ok: false, erro: "Nome é obrigatório (mín. 2 caracteres)." };
  }

  const telefoneRaw = (body.telefone || "").trim();
  const telefone = telefoneRaw ? normalizarTelefoneLead(telefoneRaw) : null;
  if (telefone && (telefone.length < 10 || telefone.length > 13)) {
    return { ok: false, erro: "Telefone inválido (informe DDD + número)." };
  }

  const email = (body.email || "").trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, erro: "E-mail inválido." };
  }

  const origem = (body.origem || "whatsapp").trim() as LeadOrigem;
  if (!LEAD_ORIGENS.includes(origem)) {
    return { ok: false, erro: "Origem inválida." };
  }

  const estagio = (body.estagio || "novo").trim() as LeadEstagio;
  if (!LEAD_ESTAGIOS.includes(estagio)) {
    return { ok: false, erro: "Estágio inválido." };
  }

  let valor_estimado = 0;
  if (body.valor_estimado !== undefined && body.valor_estimado !== null && body.valor_estimado !== "") {
    const v =
      typeof body.valor_estimado === "number"
        ? body.valor_estimado
        : parseFloat(String(body.valor_estimado).replace(",", "."));
    if (!Number.isFinite(v) || v < 0) {
      return { ok: false, erro: "Valor estimado inválido." };
    }
    valor_estimado = v;
  }

  const mercados = mercadosLeadComPadrao(parseMercadosBody(body.mercados));

  return {
    ok: true,
    data: {
      nome: nome.slice(0, 200),
      telefone,
      email,
      origem,
      estagio,
      valor_estimado,
      mercados,
      mercado_principal: mercados[0],
    },
  };
}

/** Código do lead no funil (ex.: LED-2026-0017) — distinto do PES da pessoa. */
export async function gerarCodigoLead(supabase: SupabaseClient): Promise<string> {
  return gerarCodigoSequencial(supabase, "hub_leads_crm", HUB_PREFIXO_CODIGO.lead);
}

export function enriquecerMetadataLeadRastreio(
  metadata: Record<string, unknown> | undefined,
  codigoLead: string,
  extras?: { pessoa_codigo?: string | null }
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata } : {};
  return {
    ...base,
    lead_codigo: codigoLead,
    ...(extras?.pessoa_codigo ? { pessoa_codigo: extras.pessoa_codigo } : {}),
  };
}

/** Prepara insert em hub_leads_crm com codigo LED e metadata de rastreio. */
export async function prepararRowHubLeadInsert(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  extras?: { pessoa_codigo?: string | null }
): Promise<Record<string, unknown>> {
  const codigo = await gerarCodigoLead(supabase);
  const meta =
    typeof row.metadata === "object" && row.metadata !== null && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : undefined;
  return {
    ...row,
    codigo,
    metadata: enriquecerMetadataLeadRastreio(meta, codigo, extras),
  };
}

/** Atribui LED a lead antigo que ainda não tem codigo (ex.: conversa WhatsApp pré-migração). */
export async function garantirCodigoLead(
  supabase: SupabaseClient,
  lead: { id: string; codigo?: string | null }
): Promise<string | null> {
  const atual = lead.codigo != null ? String(lead.codigo).trim() : "";
  if (atual) return atual;

  const codigo = await gerarCodigoLead(supabase);
  const { error } = await supabase.from("hub_leads_crm").update({ codigo }).eq("id", lead.id);
  if (error) {
    console.error("[lead] garantir codigo:", error);
    return null;
  }
  return codigo;
}
