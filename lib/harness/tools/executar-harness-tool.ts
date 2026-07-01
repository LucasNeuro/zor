import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";
import {
  delegarTrabalhoParaAgente,
  transferirLeadParaAgente,
  type HarnessToolContext,
} from "@/lib/harness/orchestration/delegate-to-agent";
import {
  formatarCorpoSkillParaModelo,
  listarSkillsL0Agente,
  obterSkillAgente,
} from "@/lib/harness/stores/skills-store";
import { isHarnessToolName } from "@/lib/harness/tools/harness-tools-defs";
import type { HarnessSurface } from "@/lib/harness/types";

function surfaceDefault(ctx: HarnessToolContext): HarnessSurface {
  if (ctx.harnessSurface) return ctx.harnessSurface;
  if (ctx.agenteInterno) return "copiloto_crm";
  return "whatsapp_lead";
}

export async function executarHarnessTool(
  supabase: SupabaseClient,
  toolName: string,
  args: Record<string, unknown>,
  ctx: HarnessToolContext
): Promise<string> {
  if (!isHarnessToolName(toolName)) {
    return JSON.stringify({ ok: false, erro: "harness_tool_desconhecida", nome: toolName });
  }

  const tenantId = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();

  if (toolName === "harness_skills_list") {
    const skills = await listarSkillsL0Agente(supabase, tenantId, ctx.agenteSlug);
    return JSON.stringify({
      ok: true,
      total: skills.length,
      skills: skills.map((s) => ({
        skill_id: s.skill_id,
        titulo: s.titulo,
        descricao: s.descricao,
      })),
    });
  }

  if (toolName === "harness_skill_view") {
    const skillId = String(args.skill_id ?? "").trim();
    if (!skillId) return JSON.stringify({ ok: false, erro: "skill_id_obrigatorio" });
    const skill = await obterSkillAgente(supabase, tenantId, ctx.agenteSlug, skillId);
    if (!skill) return JSON.stringify({ ok: false, erro: "skill_nao_encontrada", skill_id: skillId });
    return JSON.stringify({
      ok: true,
      skill_id: skill.skill_id,
      titulo: skill.titulo,
      corpo: formatarCorpoSkillParaModelo(skill),
    });
  }

  if (toolName === "harness_delegate_to_agent") {
    const dest = String(args.agente_destino_slug ?? "").trim();
    const brief = String(args.brief ?? "").trim();
    const out = await delegarTrabalhoParaAgente({
      supabase,
      tenantId,
      agenteOrigemSlug: ctx.agenteSlug,
      agenteDestinoSlug: dest,
      brief,
      surfaceOrigem: surfaceDefault(ctx),
      sessionId: ctx.sessionId,
      leadId: ctx.leadId ?? null,
    });
    return JSON.stringify({
      ok: out.ok,
      delegacao_id: out.delegacao_id ?? null,
      resposta_agente_destino: out.resposta ?? null,
      erro: out.erro ?? null,
    });
  }

  if (toolName === "harness_transfer_lead") {
    if (!ctx.leadId) {
      return JSON.stringify({ ok: false, erro: "lead_id_obrigatorio_para_transferencia" });
    }
    const dest = String(args.agente_destino_slug ?? "").trim();
    const resumo = typeof args.resumo === "string" ? args.resumo : undefined;
    const out = await transferirLeadParaAgente(supabase, {
      tenantId,
      leadId: ctx.leadId,
      agenteOrigemSlug: ctx.agenteSlug,
      agenteDestinoSlug: dest,
      resumo,
    });
    return JSON.stringify({
      ok: out.ok,
      agente_destino: dest,
      lead_id: ctx.leadId,
      erro: out.erro ?? null,
      aviso: out.ok
        ? "Próximas mensagens do cliente serão atendidas pelo agente destino."
        : undefined,
    });
  }

  return JSON.stringify({ ok: false, erro: "nao_implementado" });
}
