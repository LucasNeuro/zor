import type { SupabaseClient } from "@supabase/supabase-js";
import { listTenantPipelines, type PipelineTipo } from "@/lib/crm/tenant-pipelines";

export type EstagioPipelineIaRef = {
  slug: string;
  label: string;
  tipo_fecho: string;
  pipeline_nome: string;
};

/** Estágios activos (abertos) de todos os pipelines do tenant — para IA e validação. */
export async function listarEstagiosPipelineParaIa(
  supabase: SupabaseClient,
  tenantId: string,
  tipo: PipelineTipo = "lead"
): Promise<EstagioPipelineIaRef[]> {
  const pipelines = await listTenantPipelines(supabase, tenantId, tipo);
  const out: EstagioPipelineIaRef[] = [];
  const seen = new Set<string>();

  for (const p of pipelines) {
    for (const e of p.estagios) {
      if (!e.ativo) continue;
      if (e.tipo_fecho === "ganho" || e.tipo_fecho === "perdido") continue;
      if (seen.has(e.slug)) continue;
      seen.add(e.slug);
      out.push({
        slug: e.slug,
        label: e.label,
        tipo_fecho: e.tipo_fecho,
        pipeline_nome: p.nome,
      });
    }
  }

  return out;
}

export function formatarEstagiosPipelineParaPrompt(estagios: EstagioPipelineIaRef[]): string {
  if (!estagios.length) return "";

  const byPipeline = new Map<string, EstagioPipelineIaRef[]>();
  for (const e of estagios) {
    const arr = byPipeline.get(e.pipeline_nome) ?? [];
    arr.push(e);
    byPipeline.set(e.pipeline_nome, arr);
  }

  const lines: string[] = [];
  for (const [nome, items] of byPipeline) {
    lines.push(`Pipeline «${nome}»:`);
    for (const it of items) {
      lines.push(`- slug \`${it.slug}\` — ${it.label}`);
    }
  }
  return lines.join("\n");
}

export function slugEstagioFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
