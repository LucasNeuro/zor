import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import { getOrCreateHarnessSession } from "@/lib/harness/stores/session-store";
import { listarPendingWritesAgente } from "@/lib/harness/stores/pending-approvals";
import { resumeHarnessAfterApproval } from "@/lib/harness/resume-after-approval";
import { montarSystemPromptHarness } from "@/lib/harness/build-system-prompt";
import {
  carregarMemorySnapshot,
  formatarBlocoMemorySnapshot,
} from "@/lib/harness/stores/memory-store";
import { formatarBlocoSkillsL0, listarSkillsL0Agente } from "@/lib/harness/stores/skills-store";
import { CRM_ACCESS_COOKIE, fetchAuthUserFromAccessToken } from "@/lib/auth/crm-session";
import type { HarnessHostContext } from "@/lib/harness/types";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST { approval_id, decisao: "aprovar"|"rejeitar", historico?: [...] }
 * Resume o harness após decisão humana (RFC §9.3).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const { tenantId } = tenantResolved;
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const approvalId = String(body.approval_id ?? "").trim();
  const decisaoRaw = String(body.decisao ?? "").trim();
  const decisao = decisaoRaw === "rejeitar" ? "rejeitar" : decisaoRaw === "aprovar" ? "aprovar" : null;

  if (!approvalId || !decisao) {
    return NextResponse.json({ error: "approval_id e decisao obrigatórios." }, { status: 400 });
  }

  let usuarioCrmId: string | null = null;
  try {
    const token = request.cookies.get(CRM_ACCESS_COOKIE)?.value;
    if (token) {
      const authUser = await fetchAuthUserFromAccessToken(token);
      usuarioCrmId = authUser?.id ?? null;
    }
  } catch {
    usuarioCrmId = null;
  }

  const supabase = db();
  const sessao = await getOrCreateHarnessSession(supabase, {
    tenantId,
    agenteSlug: slug,
    surface: "copiloto_crm",
    resourceId: usuarioCrmId,
  });

  if (!sessao?.id) {
    return NextResponse.json({ erro: "harness_session_indisponivel" }, { status: 503 });
  }

  const { data: agente } = await supabase
    .from("hub_agente_identidade")
    .select("nome, cargo, area, bio, system_prompt_base, modelo_padrao")
    .eq("agente_slug", slug)
    .maybeSingle();

  const historico = Array.isArray(body.historico)
    ? (body.historico as Array<{ role?: string; content?: string }>)
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content! }))
    : [];

  const [skillsL0, memorySnap] = await Promise.all([
    listarSkillsL0Agente(supabase, tenantId, slug),
    carregarMemorySnapshot(supabase, tenantId, slug),
  ]);

  const systemPrompt = montarSystemPromptHarness({
    agenteNome: String(agente?.nome ?? slug),
    agenteSlug: slug,
    cargo: typeof agente?.cargo === "string" ? agente.cargo : undefined,
    area: typeof agente?.area === "string" ? agente.area : undefined,
    bio: typeof agente?.bio === "string" ? agente.bio : undefined,
    promptBaseTrecho:
      typeof agente?.system_prompt_base === "string" ? agente.system_prompt_base : undefined,
    canalInterno: "copiloto_crm",
    memoriasBloco: formatarBlocoMemorySnapshot(memorySnap),
    skillsBloco: formatarBlocoSkillsL0(skillsL0),
  });

  const hostCtx: HarnessHostContext = {
    tenantId,
    agenteSlug: slug,
    agenteNome: String(agente?.nome ?? slug),
    surface: "copiloto_crm",
    telefoneSessao: null,
    usuarioCrmId,
    sessionId: sessao.id,
    modoId: sessao.modo_id,
    grants: sessao.grants,
  };

  try {
    const turn = await resumeHarnessAfterApproval({
      supabase,
      hostCtx,
      approvalId,
      decisao,
      systemPrompt,
      mensagens: historico,
      modelo: typeof agente?.modelo_padrao === "string" ? agente.modelo_padrao : "mistral",
    });

    const pending = await listarPendingWritesAgente(supabase, tenantId, slug);

    return NextResponse.json({
      ok: true,
      texto: turn.texto,
      modelo: turn.modelo,
      rejeitado: turn.rejeitado === true,
      pending_approvals: pending,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "falha_resume";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** GET — lista aprovações pendentes do agente */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const { tenantId } = tenantResolved;
  const { slug } = await params;

  const supabase = db();
  const pending = await listarPendingWritesAgente(supabase, tenantId, slug);
  return NextResponse.json({ ok: true, pending_approvals: pending });
}
