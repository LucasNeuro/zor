import type { SupabaseClient } from "@supabase/supabase-js";
import { AREAS_ATUACAO } from "@/lib/crm/areas-atuacao";
import { gerarCodigoSequencial, HUB_PREFIXO_CODIGO } from "@/lib/crm/codigos-rastreio";

/** Siglas gravadas em `hub_negocios.prefixo_mercado` — Waje usa GRL por defeito. */
export const MERCADOS_PREFIXO = ["GRL", "IMB", "ARQ", "RFM", "MRC", "ENG", "SRV", "PRO", "FOR"] as const;

export type PrefixoMercado = (typeof MERCADOS_PREFIXO)[number];

export const MERCADO_PREFIXO_PADRAO: PrefixoMercado = "GRL";

const LABEL_POR_SIGLA = new Map(
  AREAS_ATUACAO.filter((a) => a.mercadoSigla).map((a) => [a.mercadoSigla!, a.label])
);

/** UI Waje: apenas mercado geral — catálogo de serviços substitui verticais fixas. */
export const MERCADOS_PREFIXO_OPTIONS = [
  { value: MERCADO_PREFIXO_PADRAO, label: LABEL_POR_SIGLA.get(MERCADO_PREFIXO_PADRAO) ?? "Geral" },
] as const;

/** Agentes Waje não escolhem mercado vertical na UI. */
export const MERCADOS_PREFIXO_OPTIONS_AGENTE: { value: PrefixoMercado; label: string }[] = [];

export function labelMercadoPrefixo(sigla: string | null | undefined): string {
  if (!sigla) return "—";
  const key = sigla.trim().toUpperCase() as PrefixoMercado;
  return LABEL_POR_SIGLA.get(key) ?? sigla;
}

/** Alinhado ao funil de leads (hub_pipeline_estagios). */
export const NEGOCIO_ETAPAS = [
  "novo",
  "qualificando",
  "qualificado",
  "proposta",
  "negociando",
  "fechamento",
  "ganho",
  "perdido",
] as const;

export type NegocioEtapa = (typeof NEGOCIO_ETAPAS)[number];

export const NEGOCIO_STATUS = [
  "aberto",
  "em_negociacao",
  "fechado_ganho",
  "fechado_perdido",
  "cancelado",
] as const;

export type NegocioStatus = (typeof NEGOCIO_STATUS)[number];

export type NegocioCadastroPayload = {
  titulo: string;
  prefixo_mercado: PrefixoMercado;
  servico_catalogo_id: string | null;
  etapa: NegocioEtapa;
  status: NegocioStatus;
  valor_estimado: number | null;
  data_previsao_fechamento: string | null;
  data_entrada: string | null;
  data_entrega: string | null;
  lead_id: string | null;
  pessoa_id: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuidValido(id: string | null | undefined): boolean {
  return !!id && UUID_RE.test(id);
}

export function validarNegocioCadastro(
  body: Partial<{
    titulo?: string;
    prefixo_mercado?: string;
    servico_catalogo_id?: string | null;
    etapa?: string;
    status?: string;
    valor_estimado?: number | string | null;
    data_previsao_fechamento?: string | null;
    data_entrada?: string | null;
    data_entrega?: string | null;
    lead_id?: string | null;
    pessoa_id?: string | null;
  }>
): { ok: true; data: NegocioCadastroPayload } | { ok: false; erro: string } {
  const titulo = (body.titulo || "").trim();
  if (!titulo || titulo.length < 2) {
    return { ok: false, erro: "Título é obrigatório (mín. 2 caracteres)." };
  }

  const servico_catalogo_id = body.servico_catalogo_id?.trim() || null;
  if (servico_catalogo_id && !uuidValido(servico_catalogo_id)) {
    return { ok: false, erro: "Serviço selecionado inválido." };
  }

  const prefixoRaw = (body.prefixo_mercado || "").trim().toUpperCase();
  const prefixo = (prefixoRaw || MERCADO_PREFIXO_PADRAO) as PrefixoMercado;
  if (!MERCADOS_PREFIXO.includes(prefixo)) {
    return { ok: false, erro: "Mercado inválido." };
  }

  const etapa = (body.etapa || "novo").trim() as NegocioEtapa;
  if (!NEGOCIO_ETAPAS.includes(etapa)) {
    return { ok: false, erro: "Etapa inválida." };
  }

  const status = (body.status || "aberto").trim() as NegocioStatus;
  if (!NEGOCIO_STATUS.includes(status)) {
    return { ok: false, erro: "Status inválido." };
  }

  let valor_estimado: number | null = null;
  if (
    body.valor_estimado !== undefined &&
    body.valor_estimado !== null &&
    body.valor_estimado !== ""
  ) {
    const v =
      typeof body.valor_estimado === "number"
        ? body.valor_estimado
        : parseFloat(String(body.valor_estimado).replace(",", "."));
    if (!Number.isFinite(v) || v < 0) {
      return { ok: false, erro: "Valor estimado inválido." };
    }
    valor_estimado = v;
  }

  const dataRaw = (body.data_previsao_fechamento || body.data_entrega || "").trim();
  let data_previsao_fechamento: string | null = null;
  if (dataRaw) {
    const parsed = new Date(dataRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, erro: "Data de entrega inválida." };
    }
    data_previsao_fechamento = parsed.toISOString().slice(0, 10);
  }

  const entradaRaw = (body.data_entrada || "").trim();
  let data_entrada: string | null = null;
  if (entradaRaw) {
    const parsed = new Date(entradaRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, erro: "Data de entrada inválida." };
    }
    data_entrada = parsed.toISOString().slice(0, 10);
  }

  const entregaRaw = (body.data_entrega || "").trim();
  let data_entrega: string | null = data_previsao_fechamento;
  if (entregaRaw) {
    const parsed = new Date(entregaRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, erro: "Data de entrega inválida." };
    }
    data_entrega = parsed.toISOString().slice(0, 10);
    if (!data_previsao_fechamento) {
      data_previsao_fechamento = data_entrega;
    }
  }

  const lead_id = body.lead_id?.trim() || null;
  const pessoa_id = body.pessoa_id?.trim() || null;
  if (lead_id && !uuidValido(lead_id)) {
    return { ok: false, erro: "Lead selecionado inválido." };
  }
  if (pessoa_id && !uuidValido(pessoa_id)) {
    return { ok: false, erro: "Pessoa selecionada inválida." };
  }

  return {
    ok: true,
    data: {
      titulo: titulo.slice(0, 200),
      prefixo_mercado: prefixo,
      servico_catalogo_id,
      etapa,
      status,
      valor_estimado,
      data_previsao_fechamento,
      data_entrada,
      data_entrega,
      lead_id,
      pessoa_id,
    },
  };
}

export async function gerarCodigoNegocio(supabase: SupabaseClient): Promise<string> {
  return gerarCodigoSequencial(supabase, "hub_negocios", HUB_PREFIXO_CODIGO.negocio);
}
