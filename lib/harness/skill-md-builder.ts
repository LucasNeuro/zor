import type { SuperagenteSkill } from "@/lib/hub/superagente/types";
import type { HarnessToolsetId } from "@/lib/harness/toolsets";

export function inferirToolsetsDaSkill(skill: SuperagenteSkill): HarnessToolsetId[] {
  const ferr = new Set(skill.ferramentas_sugeridas);
  const out: HarnessToolsetId[] = [];
  if (ferr.has("hub_superagente_artefato")) out.push("artefatos");
  if (ferr.has("hub_mistral_percepcao")) out.push("multimodal");
  if (ferr.has("hub_metricas_escritorio")) out.push("metricas");
  if (ferr.has("hub_superagente_dados") || ferr.has("hub_int_crm_consultar")) {
    out.push("crm_relatorios");
  }
  if (
    ferr.has("hub_operacao_empresa") ||
    skill.ferramentas_sugeridas.some((f) => f.startsWith("hub_int_crm_ent_"))
  ) {
    out.push("crm_operacoes");
  }
  if (!out.length) out.push("crm_operacoes");
  return out;
}

/** Corpo SKILL.md (agentskills.io) para persistência em hub_agente_skills. */
export function montarCorpoSkillMd(
  skill: SuperagenteSkill,
  opts?: { agenteSlug?: string; cargoTitulo?: string }
): string {
  const toolsets = inferirToolsetsDaSkill(skill);
  const tools = skill.ferramentas_sugeridas.length
    ? skill.ferramentas_sugeridas.map((f) => `- \`${f}\``).join("\n")
    : "- `hub_operacao_empresa`";

  const procedimento =
    skill.id === "artefatos_relatorios"
      ? `1. Chame \`hub_superagente_artefato\` com secções kpi_row, grafico, tabela, texto.
2. Use dados reais via \`hub_int_crm_ent_*\` antes de montar o canvas.
3. Responda só com o link \`url_publica\` devolvido.`
      : skill.id === "percepcao_multimodal"
        ? `1. Chame \`hub_mistral_percepcao\` com o anexo ou URL.
2. Use o texto extraído em consultas CRM se necessário.`
        : skill.id === "crm_pipeline" || /crm|lead|pipeline/i.test(skill.titulo)
          ? `1. Lead → \`hub_int_crm_ent_lead\` (consultar/obter) → guarde UUID.
2. Negócios → \`hub_int_crm_ent_negocio\` com \`filtro_lead_id\`.
3. Só confirme factos com JSON \`ok: true\`.`
          : `1. Identifique a entidade hub_* relevante.
2. Chame \`hub_int_crm_ent_{entidade}\` com acao=consultar ou obter.
3. Para gravar: acao=criar/atualizar no mesmo turno e re-consulte.`;

  return [
    "---",
    `name: ${skill.id}`,
    `description: ${skill.descricao}`,
    "version: 1.0.0",
    "metadata:",
    "  waje:",
    `    toolsets: [${toolsets.join(", ")}]`,
    `    requires_tools: [${skill.ferramentas_sugeridas.join(", ") || "hub_operacao_empresa"}]`,
    opts?.agenteSlug ? `    agente_slug: ${opts.agenteSlug}` : "    agente_slug: *",
    "---",
    "",
    `# ${skill.titulo}`,
    "",
    opts?.cargoTitulo ? `Cargo base: ${opts.cargoTitulo}.` : "",
    "",
    "## Quando usar",
    skill.descricao,
    "",
    "## Procedimento",
    procedimento,
    "",
    "## Ferramentas",
    tools,
    "",
    "## Verificação",
    "- Resposta da tool com `ok: true`.",
    "- Contagens coerentes com `registos.length` ou `total`.",
    "- Após gravar, obter/consultar o registo de novo.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
