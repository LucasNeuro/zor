import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import {
  concederGrantEscritaCrmSessao,
  getOrCreateHarnessSession,
  updateHarnessSessionModo,
} from "@/lib/harness/stores/session-store";
import { listarPendingWritesAgente } from "@/lib/harness/stores/pending-approvals";
import type { HarnessModeId } from "@/lib/harness/types";
import { CRM_ACCESS_COOKIE, fetchAuthUserFromAccessToken } from "@/lib/auth/crm-session";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MODOS: HarnessModeId[] = ["conversar", "analisar", "operar", "planear"];

function parseModo(v: unknown): HarnessModeId | null {
  const m = String(v ?? "").trim() as HarnessModeId;
  return MODOS.includes(m) ? m : null;
}

/** GET — estado da sessão harness do copiloto (modo, grants). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const { tenantId } = tenantResolved;
  const { slug } = await params;

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
    modoId: "analisar",
  });

  if (!sessao) {
    return NextResponse.json({ ok: false, erro: "harness_session_indisponivel" }, { status: 503 });
  }

  const pending = await listarPendingWritesAgente(supabase, tenantId, slug);

    return NextResponse.json({
    ok: true,
    session_id: sessao.id,
    modo_id: sessao.modo_id,
    grants: sessao.grants,
    pending_approvals: pending,
    token_usage: sessao.token_usage ?? {},
  });
}

/** PATCH { modo_id?, aprovar_escrita_sessao?: boolean } */
export async function PATCH(
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

  const modo = parseModo(body.modo_id);
  if (modo) {
    await updateHarnessSessionModo(supabase, sessao.id, modo);
  }

  if (body.aprovar_escrita_sessao === true) {
    await concederGrantEscritaCrmSessao(supabase, sessao.id);
  }

  const atualizada = await getOrCreateHarnessSession(supabase, {
    tenantId,
    agenteSlug: slug,
    surface: "copiloto_crm",
    resourceId: usuarioCrmId,
  });

  return NextResponse.json({
    ok: true,
    session_id: atualizada?.id ?? sessao.id,
    modo_id: atualizada?.modo_id ?? modo ?? sessao.modo_id,
    grants: atualizada?.grants ?? sessao.grants,
  });
}
