import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buscarTrechosConhecimentoTenant,
  buscarTrechosDiretosConhecimentoTenant,
  type TenantConhecimentoTrecho,
} from "@/lib/hub/tenant-conhecimento-rag";
import { buscarTrechosRag, buscarTrechosDiretosAgente, type RagTrecho } from "@/lib/hub/rag";
import {
  resolverConsultaRagParaBusca,
  type TurnoConsultaRag,
} from "@/lib/ia/consulta-rag-conversa";

const MAX_TRECHOS_EMPRESA = 8;
const MAX_TRECHOS_AGENTE = 6;

function dedupeTrechosEmpresa(rows: TenantConhecimentoTrecho[]): TenantConhecimentoTrecho[] {
  const vistos = new Set<string>();
  const out: TenantConhecimentoTrecho[] = [];
  for (const row of rows) {
    const key = row.conteudo.slice(0, 120);
    if (vistos.has(key)) continue;
    vistos.add(key);
    out.push(row);
  }
  return out;
}

function dedupeTrechosAgente(rows: RagTrecho[]): RagTrecho[] {
  const vistos = new Set<string>();
  const out: RagTrecho[] = [];
  for (const row of rows) {
    const key = row.conteudo.slice(0, 120);
    if (vistos.has(key)) continue;
    vistos.add(key);
    out.push(row);
  }
  return out;
}

async function buscarSemanticoEmpresa(
  supabase: SupabaseClient,
  tenantId: string,
  consulta: string
): Promise<TenantConhecimentoTrecho[]> {
  const passes: Array<{ limit: number; threshold: number }> = [
    { limit: 5, threshold: 0.65 },
    { limit: 4, threshold: 0.55 },
    { limit: 4, threshold: 0.45 },
  ];
  for (const p of passes) {
    const rows = await buscarTrechosConhecimentoTenant(supabase, tenantId, consulta, p);
    if (rows.length > 0) return rows;
  }
  return [];
}

async function buscarSemanticoAgente(
  supabase: SupabaseClient,
  agenteSlug: string,
  consulta: string
): Promise<RagTrecho[]> {
  const passes: Array<{ limit: number; threshold: number }> = [
    { limit: 4, threshold: 0.68 },
    { limit: 4, threshold: 0.56 },
    { limit: 3, threshold: 0.45 },
  ];
  for (const p of passes) {
    const rows = await buscarTrechosRag(supabase, agenteSlug, consulta, p);
    if (rows.length > 0) return rows;
  }
  return [];
}

/**
 * Sempre monta contexto dos documentos da empresa (Conhecimento).
 * Usado em WhatsApp e simulação — busca semântica + trechos diretos como rede de segurança.
 */
export async function buscarContextoDocumentosEmpresaParaPrompt(
  supabase: SupabaseClient,
  tenantId: string,
  params: { mensagemAtual?: string; turnosConversa?: TurnoConsultaRag[] }
): Promise<TenantConhecimentoTrecho[]> {
  const { count } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "pronto");

  if (!count) return [];

  const consulta = resolverConsultaRagParaBusca(params.mensagemAtual ?? "", params.turnosConversa);
  const merged: TenantConhecimentoTrecho[] = [];

  merged.push(...(await buscarSemanticoEmpresa(supabase, tenantId, consulta)));

  const faltam = Math.max(0, MAX_TRECHOS_EMPRESA - merged.length);
  if (faltam > 0) {
    merged.push(...(await buscarTrechosDiretosConhecimentoTenant(supabase, tenantId, faltam)));
  }

  return dedupeTrechosEmpresa(merged).slice(0, MAX_TRECHOS_EMPRESA);
}

/**
 * Sempre monta contexto dos documentos específicos do agente (RAG wizard).
 */
export async function buscarContextoDocumentosAgenteParaPrompt(
  supabase: SupabaseClient,
  agenteSlug: string,
  params: { mensagemAtual?: string; turnosConversa?: TurnoConsultaRag[] }
): Promise<RagTrecho[]> {
  const { count } = await supabase
    .from("hub_agente_rag_documentos")
    .select("id", { count: "exact", head: true })
    .eq("agente_slug", agenteSlug)
    .eq("status", "pronto");

  if (!count) return [];

  const consulta = resolverConsultaRagParaBusca(params.mensagemAtual ?? "", params.turnosConversa);
  const merged: RagTrecho[] = [];

  merged.push(...(await buscarSemanticoAgente(supabase, agenteSlug, consulta)));

  const faltam = Math.max(0, MAX_TRECHOS_AGENTE - merged.length);
  if (faltam > 0) {
    merged.push(...(await buscarTrechosDiretosAgente(supabase, agenteSlug, faltam)));
  }

  return dedupeTrechosAgente(merged).slice(0, MAX_TRECHOS_AGENTE);
}
