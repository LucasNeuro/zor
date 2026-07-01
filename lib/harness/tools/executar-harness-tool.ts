import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";
import {
  delegarTrabalhoParaAgente,
  transferirLeadParaAgente,
  type HarnessToolContext,
} from "@/lib/harness/orchestration/delegate-to-agent";
import {
  carregarMemorySnapshot,
  stagingMemoryPatch,
  upsertMemoryTarget,
  type MemoryTarget,
} from "@/lib/harness/stores/memory-store";
import {
  criarOuAtualizarSkillAgente,
  desactivarSkillAgente,
  formatarCorpoSkillParaModelo,
  listarSkillsL0Agente,
  obterSkillAgente,
} from "@/lib/harness/stores/skills-store";
import { isHarnessToolName } from "@/lib/harness/tools/harness-tools-defs";
import type { HarnessSurface } from "@/lib/harness/types";
import { pesquisarSessoesBriefingAgente } from "@/lib/harness/session-search";
import {
  carregarHarnessTenantConfig,
  memoriaExigeAprovacaoTenant,
  skillsExigemAprovacaoTenant,
  type HarnessTenantConfig,
} from "@/lib/harness/tenant-config";

function surfaceDefault(ctx: HarnessToolContext): HarnessSurface {
  if (ctx.harnessSurface) return ctx.harnessSurface;
  if (ctx.agenteInterno) return "copiloto_crm";
  return "whatsapp_lead";
}

function skillManageExigeAprovacao(
  ctx: HarnessToolContext,
  tenantCfg?: HarnessTenantConfig
): boolean {
  if (ctx.harnessGrants?.skill_manage) return false;
  if (tenantCfg && !skillsExigemAprovacaoTenant(tenantCfg)) return false;
  return ctx.harnessModoId === "operar";
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
  const tenantCfg = await carregarHarnessTenantConfig(supabase, tenantId);

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

  if (toolName === "harness_skill_manage") {
    const acao = String(args.acao ?? "").trim().toLowerCase();
    const skillId = String(args.skill_id ?? "").trim();
    if (!skillId) return JSON.stringify({ ok: false, erro: "skill_id_obrigatorio" });

    if (skillManageExigeAprovacao(ctx, tenantCfg)) {
      const { criarPendingWriteCrm } = await import("@/lib/harness/stores/pending-approvals");
      const approval = await criarPendingWriteCrm(supabase, {
        tenantId,
        agenteSlug: ctx.agenteSlug,
        sessionId: ctx.sessionId,
        toolName,
        argumentos: args,
        resumoHumano: `Skill ${acao}: ${skillId}`,
        nivel: "escrita_crm",
      });
      return JSON.stringify({
        ok: false,
        harness_policy: true,
        motivo: "aprovacao_necessaria",
        requer_aprovacao: true,
        harness_suspended: true,
        approval_id: approval?.id ?? null,
        resumo_humano: `Gerir skill «${skillId}» (${acao})`,
      });
    }

    if (acao === "delete") {
      const ok = await desactivarSkillAgente(supabase, tenantId, ctx.agenteSlug, skillId);
      return JSON.stringify({ ok, skill_id: skillId, acao: "delete" });
    }

    const titulo = String(args.titulo ?? skillId).trim();
    const descricao = String(args.descricao ?? "").trim();
    const corpoMd = String(args.corpo_md ?? descricao).trim();
    const ferramentas = Array.isArray(args.ferramentas_sugeridas)
      ? (args.ferramentas_sugeridas as unknown[]).map(String)
      : [];

    if (acao === "create" || acao === "patch") {
      const existente = await obterSkillAgente(supabase, tenantId, ctx.agenteSlug, skillId);
      const ok = await criarOuAtualizarSkillAgente(supabase, {
        tenantId,
        agenteSlug: ctx.agenteSlug,
        skillId,
        titulo,
        descricao: descricao || existente?.descricao || titulo,
        corpoMd: corpoMd || existente?.corpo_md || descricao,
        ferramentasSugeridas: ferramentas.length ? ferramentas : existente?.ferramentas_sugeridas,
        origem: "agente",
      });
      return JSON.stringify({ ok, skill_id: skillId, acao });
    }

    return JSON.stringify({ ok: false, erro: "acao_invalida", acao });
  }

  if (toolName === "harness_memory") {
    const acao = String(args.acao ?? "").trim().toLowerCase();
    const targetRaw = String(args.target ?? "operacional").trim();
    const target: MemoryTarget =
      targetRaw === "utilizador" || targetRaw === "atendimento" ? targetRaw : "operacional";
    const conteudo = String(args.conteudo ?? "").trim();

    if (acao === "remove") {
      await upsertMemoryTarget(supabase, {
        tenantId,
        agenteSlug: ctx.agenteSlug,
        target,
        conteudo: "",
      });
      return JSON.stringify({ ok: true, acao, target, aviso: "Memória limpa; efeito na próxima sessão." });
    }

    if (!conteudo) {
      return JSON.stringify({ ok: false, erro: "conteudo_obrigatorio" });
    }

    const requireApproval =
      memoriaExigeAprovacaoTenant(tenantCfg) || ctx.harnessModoId === "operar";

    if (acao === "add") {
      const snap = await carregarMemorySnapshot(supabase, tenantId, ctx.agenteSlug, [target]);
      const prev = snap[target]?.trim() ?? "";
      const merged = prev ? `${prev}\n- ${conteudo}` : conteudo;
      const staged = await stagingMemoryPatch(supabase, {
        tenantId,
        agenteSlug: ctx.agenteSlug,
        sessionId: ctx.sessionId,
        target,
        conteudo: merged,
        requireApproval,
      });
      return JSON.stringify({
        ok: true,
        acao,
        target,
        staged: staged === "staged",
        aviso: "Efeito no prompt = próxima sessão (ou após aprovação).",
      });
    }

    if (acao === "replace") {
      const staged = await stagingMemoryPatch(supabase, {
        tenantId,
        agenteSlug: ctx.agenteSlug,
        sessionId: ctx.sessionId,
        target,
        conteudo,
        requireApproval,
      });
      return JSON.stringify({
        ok: true,
        acao,
        target,
        staged: staged === "staged",
        aviso: "Efeito no prompt = próxima sessão (ou após aprovação).",
      });
    }

    return JSON.stringify({ ok: false, erro: "acao_invalida", acao });
  }

  if (toolName === "harness_session_search") {
    const query = String(args.query ?? "").trim();
    const limite = Math.min(16, Math.max(1, Number(args.limite) || 8));
    if (!query) return JSON.stringify({ ok: false, erro: "query_obrigatoria" });

    const hits = await pesquisarSessoesBriefingAgente(supabase, {
      agenteSlug: ctx.agenteSlug,
      query,
      limite,
    });

    return JSON.stringify({ ok: true, query, total: hits.length, mensagens: hits });
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
