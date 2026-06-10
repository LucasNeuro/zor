import type { SupabaseClient } from "@supabase/supabase-js";
import { estagiosPadraoParaTipo, type PipelineTipo as PipelineTipoDefaults } from "@/lib/crm/pipeline-defaults";

export type PipelineTipo = "lead" | "negocio" | "atendimento";

export type PipelineComEstagios = {
  id: string;
  slug: string;
  nome: string;
  tipo: PipelineTipo;
  mercado_sigla: string | null;
  ordem: number;
  estagios: {
    id: string;
    slug: string;
    label: string;
    cor: string;
    ordem: number;
    ativo: boolean;
    tipo_fecho: string;
    sistema: boolean;
  }[];
};

const BOOTSTRAP_PIPELINES: { slug: string; nome: string; tipo: PipelineTipo; ordem: number }[] = [
  { slug: "leads-principal", nome: "Leads", tipo: "lead", ordem: 0 },
  { slug: "negocios-principal", nome: "Negócios", tipo: "negocio", ordem: 0 },
  { slug: "atendimento-principal", nome: "Atendimento", tipo: "atendimento", ordem: 0 },
];

async function inserirEstagiosPadrao(
  supabase: SupabaseClient,
  pipelineId: string,
  tipo: PipelineTipoDefaults
): Promise<void> {
  await supabase.from("hub_pipeline_estagios").insert(
    estagiosPadraoParaTipo(tipo).map((e) => ({
      pipeline_id: pipelineId,
      slug: e.slug,
      label: e.label,
      cor: e.cor,
      ordem: e.ordem,
      tipo_fecho: e.tipo_fecho,
      sistema: true,
    }))
  );
}

function mapPipelineRow(raw: Record<string, unknown>): PipelineComEstagios {
  const estagios = (raw.hub_pipeline_estagios as Record<string, unknown>[] | null) || [];
  const sorted = [...estagios].sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0));
  return {
    id: String(raw.id),
    slug: String(raw.slug),
    nome: String(raw.nome),
    tipo: raw.tipo as PipelineTipo,
    mercado_sigla: raw.mercado_sigla != null ? String(raw.mercado_sigla) : null,
    ordem: Number(raw.ordem ?? 0),
    estagios: sorted.map((e) => ({
      id: String(e.id ?? e.slug),
      slug: String(e.slug),
      label: String(e.label),
      cor: String(e.cor ?? "#6B7280"),
      ordem: Number(e.ordem ?? 0),
      ativo: e.ativo !== false,
      tipo_fecho: String(e.tipo_fecho ?? "aberto"),
      sistema: e.sistema === true,
    })),
  };
}

/** Garante pipelines Waje iniciais por tenant (sem mercados Obra10). */
export async function ensureTenantPipelines(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  for (const tpl of BOOTSTRAP_PIPELINES) {
    const { data: existing } = await supabase
      .from("hub_pipelines")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("tipo", tpl.tipo)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { count } = await supabase
        .from("hub_pipeline_estagios")
        .select("id", { count: "exact", head: true })
        .eq("pipeline_id", existing.id);
      if (!count) await inserirEstagiosPadrao(supabase, String(existing.id), tpl.tipo);
      continue;
    }

    const { data: pipeline, error } = await supabase
      .from("hub_pipelines")
      .insert({
        slug: `${tpl.slug}-${tenantId.slice(0, 8)}`,
        nome: tpl.nome,
        tipo: tpl.tipo,
        mercado_sigla: null,
        ordem: tpl.ordem,
        tenant_id: tenantId,
        ativo: true,
      })
      .select("id")
      .single();

    if (error || !pipeline?.id) continue;
    await inserirEstagiosPadrao(supabase, String(pipeline.id), tpl.tipo);
  }
}

/** Lista apenas pipelines do tenant Waje (ignora seeds globais Obra10). */
export async function listTenantPipelines(
  supabase: SupabaseClient,
  tenantId: string,
  tipo: PipelineTipo
): Promise<PipelineComEstagios[]> {
  await ensureTenantPipelines(supabase, tenantId);

  const { data, error } = await supabase
    .from("hub_pipelines")
    .select(
      "id, slug, nome, tipo, mercado_sigla, ativo, ordem, hub_pipeline_estagios(id, slug, label, cor, ordem, ativo, tipo_fecho, sistema)"
    )
    .eq("tenant_id", tenantId)
    .eq("tipo", tipo)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => mapPipelineRow(row as Record<string, unknown>));
}

const LEGACY_PIPELINE_LABELS = new Set(["global", "pipeline global", "funil operacional"]);

export function labelPipelineTab(pipe: { nome: string }): string {
  const raw = pipe.nome.trim();
  if (!raw) return "Pipeline";
  const semPrefixo = raw
    .replace(/^Leads\s+[—-]\s+/i, "")
    .replace(/^Negócios\s+[—-]\s+/i, "")
    .replace(/^Atendimento\s+[—-]\s+/i, "")
    .trim();
  if (!semPrefixo || LEGACY_PIPELINE_LABELS.has(semPrefixo.toLowerCase())) {
    if (/^leads/i.test(raw)) return "Leads";
    if (/^negócios/i.test(raw)) return "Negócios";
    if (/^atendimento/i.test(raw)) return "Atendimento";
  }
  return semPrefixo || raw;
}
