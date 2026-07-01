import type { SupabaseClient } from "@supabase/supabase-js";
import { montarCorpoSkillMd } from "@/lib/harness/skill-md-builder";
import type { HarnessSurface } from "@/lib/harness/types";
import { gerarSkillsSuperagenteFromCargo } from "@/lib/hub/superagente/skills-from-cargo";

export type AgenteSkillRow = {
  skill_id: string;
  titulo: string;
  descricao: string;
  corpo_md: string;
  ferramentas_sugeridas: string[];
};

function tabelaInexistente(msg?: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes("hub_agente_skills") && (m.includes("does not exist") || m.includes("schema cache"));
}

export async function listarSkillsL0Agente(
  supabase: SupabaseClient,
  tenantId: string,
  agenteSlug: string
): Promise<AgenteSkillRow[]> {
  const { data, error } = await supabase
    .from("hub_agente_skills")
    .select("skill_id, titulo, descricao, corpo_md, ferramentas_sugeridas")
    .eq("tenant_id", tenantId)
    .eq("agente_slug", agenteSlug)
    .eq("ativo", true)
    .order("titulo", { ascending: true })
    .limit(24);

  if (error) {
    if (tabelaInexistente(error.message)) return [];
    return [];
  }
  return (data ?? []) as AgenteSkillRow[];
}

export async function obterSkillAgente(
  supabase: SupabaseClient,
  tenantId: string,
  agenteSlug: string,
  skillId: string
): Promise<AgenteSkillRow | null> {
  const { data, error } = await supabase
    .from("hub_agente_skills")
    .select("skill_id, titulo, descricao, corpo_md, ferramentas_sugeridas")
    .eq("tenant_id", tenantId)
    .eq("agente_slug", agenteSlug)
    .eq("skill_id", skillId)
    .eq("ativo", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as AgenteSkillRow;
}

export async function ensureSkillsSeedFromCargo(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    agenteSlug: string;
    cargo?: string | null;
    area?: string | null;
    surface?: HarnessSurface | "whatsapp_lead" | "email_lead";
  }
): Promise<number> {
  const existentes = await listarSkillsL0Agente(supabase, params.tenantId, params.agenteSlug);
  if (existentes.length > 0) return 0;

  const skills = gerarSkillsSuperagenteFromCargo(params.cargo, params.area);

  const rows = skills.map((s) => ({
    tenant_id: params.tenantId,
    agente_slug: params.agenteSlug,
    skill_id: s.id,
    titulo: s.titulo,
    descricao: s.descricao,
    corpo_md: montarCorpoSkillMd(s, { cargoTitulo: params.cargo ?? undefined }),
    ferramentas_sugeridas: s.ferramentas_sugeridas,
    origem: "cargo_seed",
  }));

  const { error } = await supabase.from("hub_agente_skills").insert(rows);
  if (error && !tabelaInexistente(error.message)) return 0;
  return rows.length;
}

/** Persiste skills geradas no wizard (antes do primeiro turno). */
export async function persistirSkillsHarnessWizard(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    agenteSlug: string;
    skills: Array<{
      id: string;
      titulo: string;
      descricao: string;
      ferramentas_sugeridas: string[];
    }>;
    surface?: HarnessSurface | "whatsapp_lead" | "email_lead";
  }
): Promise<number> {
  if (!params.skills.length) return 0;

  const existentes = await listarSkillsL0Agente(supabase, params.tenantId, params.agenteSlug);
  if (existentes.length > 0) return 0;

  const rows = params.skills.map((s) => ({
    tenant_id: params.tenantId,
    agente_slug: params.agenteSlug,
    skill_id: s.id,
    titulo: s.titulo,
    descricao: s.descricao,
    corpo_md: montarCorpoSkillMd(
      {
        id: s.id,
        titulo: s.titulo,
        descricao: s.descricao,
        ferramentas_sugeridas: s.ferramentas_sugeridas,
      },
      { agenteSlug: params.agenteSlug }
    ),
    ferramentas_sugeridas: s.ferramentas_sugeridas,
    origem: "wizard",
  }));

  const { error } = await supabase.from("hub_agente_skills").insert(rows);
  if (error && !tabelaInexistente(error.message)) return 0;
  return rows.length;
}

export function formatarBlocoSkillsL0(skills: AgenteSkillRow[]): string {
  if (!skills.length) return "";
  const linhas = skills.map(
    (s) => `- **${s.titulo}** (\`${s.skill_id}\`): ${s.descricao}`
  );
  return [
    "═══ SKILLS DO AGENTE (índice L0 — use harness_skill_view para o runbook completo) ═══",
    ...linhas,
  ].join("\n");
}

export async function criarOuAtualizarSkillAgente(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    agenteSlug: string;
    skillId: string;
    titulo: string;
    descricao: string;
    corpoMd: string;
    ferramentasSugeridas?: string[];
    origem?: "agente" | "manual" | "wizard";
  }
): Promise<boolean> {
  const { error } = await supabase.from("hub_agente_skills").upsert(
    {
      tenant_id: params.tenantId,
      agente_slug: params.agenteSlug,
      skill_id: params.skillId,
      titulo: params.titulo,
      descricao: params.descricao,
      corpo_md: params.corpoMd,
      ferramentas_sugeridas: params.ferramentasSugeridas ?? [],
      origem: params.origem ?? "agente",
      ativo: true,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "tenant_id,agente_slug,skill_id" }
  );
  if (error && !tabelaInexistente(error.message)) return false;
  return !error;
}

export async function desactivarSkillAgente(
  supabase: SupabaseClient,
  tenantId: string,
  agenteSlug: string,
  skillId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("hub_agente_skills")
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("agente_slug", agenteSlug)
    .eq("skill_id", skillId);
  if (error && !tabelaInexistente(error.message)) return false;
  return !error;
}

export function formatarCorpoSkillParaModelo(skill: AgenteSkillRow): string {
  const corpo = skill.corpo_md?.trim() || skill.descricao;
  return [
    `# Skill: ${skill.titulo} (\`${skill.skill_id}\`)`,
    "",
    corpo,
    "",
    skill.ferramentas_sugeridas?.length
      ? `Ferramentas: ${skill.ferramentas_sugeridas.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
