import type { SupabaseClient } from "@supabase/supabase-js";
import { safeCount } from "@/lib/crm/metricas-safe";

/** Filtros PostgREST partilhados para hub_leads_crm (analytics, dashboard, KPIs). */

/** Estágios finais — lead não entra em fila / pipeline aberto. */
export const ESTAGIOS_LEAD_TERMINAIS = [
  "perdido",
  "spam_invalido",
  "convertido_negocio",
  "ganho",
] as const;

/** Ainda não qualificados para métrica de taxa (slugs PDF normalizados). */
export const ESTAGIOS_LEAD_NAO_QUALIFICADOS = ["novo", "perdido", "spam_invalido"] as const;

const NAO_QUALIFICADOS_SET = new Set<string>(ESTAGIOS_LEAD_NAO_QUALIFICADOS);
const TERMINAIS_SET = new Set<string>(ESTAGIOS_LEAD_TERMINAIS);

export function metricasLeadsFromRows(
  rows: { estagio: string | null; agente_responsavel?: string | null; humano_responsavel?: string | null }[],
  normalizarEstagio: (raw: string | null) => string
): { total: number; qualificados: number; aguardando: number; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  let qualificados = 0;
  let aguardando = 0;
  for (const row of rows) {
    const slug = normalizarEstagio(row.estagio);
    counts[slug] = (counts[slug] ?? 0) + 1;
    if (!NAO_QUALIFICADOS_SET.has(slug)) qualificados++;
    // Sem coluna de responsável fiável no select: leads ativos não terminais ≈ fila
    if (!TERMINAIS_SET.has(slug)) aguardando++;
  }
  return { total: rows.length, qualificados, aguardando, counts };
}

/** Formato PostgREST: '("a","b")' */
export function postgrestInList(values: readonly string[]): string {
  return `(${values.map((v) => `"${v}"`).join(",")})`;
}

export const POSTGREST_LEAD_TERMINAIS = postgrestInList(ESTAGIOS_LEAD_TERMINAIS);
export const POSTGREST_LEAD_NAO_QUALIFICADOS = postgrestInList(ESTAGIOS_LEAD_NAO_QUALIFICADOS);

/** Conta leads ativos sem responsável (evita `.or()` frágil no PostgREST). */
export async function countLeadsAguardandoAtendimento(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  const base = () =>
    supabase
      .from("hub_leads_crm")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .not("estagio", "in", POSTGREST_LEAD_TERMINAIS);

  const [semResponsavelNull, semResponsavelVazio] = await Promise.all([
    safeCount(base().is("humano_responsavel", null)),
    safeCount(base().eq("humano_responsavel", "")),
  ]);
  return semResponsavelNull + semResponsavelVazio;
}
