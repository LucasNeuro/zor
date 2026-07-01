import type { SupabaseClient } from "@supabase/supabase-js";
import {
  gerarSkillsSuperagenteFromCargo,
} from "@/lib/hub/superagente/skills-from-cargo";
import type { HarnessSurface } from "@/lib/harness/types";

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
  const isExterno =
    params.surface === "whatsapp_lead" || params.surface === "email_lead";

  const rows = skills.map((s) => ({
    tenant_id: params.tenantId,
    agente_slug: params.agenteSlug,
    skill_id: s.id,
    titulo: s.titulo,
    descricao: s.descricao,
    corpo_md: [
      `# ${s.titulo}`,
      "",
      s.descricao,
      "",
      "## Ferramentas sugeridas",
      ...s.ferramentas_sugeridas.map((f) => `- \`${f}\``),
      "",
      isExterno
        ? "## Quando usar\nPedidos do cliente final no canal comercial — priorize tom empático e dados do lead."
        : "## Quando usar\nTarefas internas da equipa — use ferramentas CRM e confirme com JSON `ok: true`.",
    ].join("\n"),
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

  const isExterno =
    params.surface === "whatsapp_lead" || params.surface === "email_lead";

  const rows = params.skills.map((s) => ({
    tenant_id: params.tenantId,
    agente_slug: params.agenteSlug,
    skill_id: s.id,
    titulo: s.titulo,
    descricao: s.descricao,
    corpo_md: [
      `# ${s.titulo}`,
      "",
      s.descricao,
      "",
      "## Ferramentas sugeridas",
      ...s.ferramentas_sugeridas.map((f) => `- \`${f}\``),
      "",
      isExterno
        ? "## Quando usar\nPedidos do cliente final no canal comercial — priorize tom empático e dados do lead."
        : "## Quando usar\nTarefas internas da equipa — use ferramentas CRM e confirme com JSON `ok: true`.",
    ].join("\n"),
    ferramentas_sugeridas: s.ferramentas_sugeridas,
    origem: "wizard_cargo",
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
