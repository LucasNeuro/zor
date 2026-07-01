import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import {
  criarOuAtualizarSkillAgente,
  desactivarSkillAgente,
  listarSkillsL0Agente,
  obterSkillAgente,
} from "@/lib/harness/stores/skills-store";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** GET — lista skills activas do agente */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const { tenantId } = tenantResolved;
  const { slug } = await params;

  const supabase = db();
  const skills = await listarSkillsL0Agente(supabase, tenantId, slug);
  return NextResponse.json({ ok: true, skills });
}

/** POST — criar ou actualizar skill manualmente */
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

  const skillId = String(body.skill_id ?? "").trim();
  const titulo = String(body.titulo ?? "").trim();
  if (!skillId || !titulo) {
    return NextResponse.json({ error: "skill_id e titulo obrigatórios." }, { status: 400 });
  }

  const supabase = db();
  const ok = await criarOuAtualizarSkillAgente(supabase, {
    tenantId,
    agenteSlug: slug,
    skillId,
    titulo,
    descricao: String(body.descricao ?? "").trim(),
    corpoMd: String(body.corpo_md ?? body.descricao ?? titulo).trim(),
    ferramentasSugeridas: Array.isArray(body.ferramentas_sugeridas)
      ? (body.ferramentas_sugeridas as unknown[]).map(String)
      : [],
    origem: "manual",
  });

  if (!ok) return NextResponse.json({ error: "falha_gravar_skill" }, { status: 500 });
  const skill = await obterSkillAgente(supabase, tenantId, slug, skillId);
  return NextResponse.json({ ok: true, skill });
}

/** DELETE ?skill_id= — desactiva skill */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const { tenantId } = tenantResolved;
  const { slug } = await params;

  const skillId = request.nextUrl.searchParams.get("skill_id")?.trim();
  if (!skillId) return NextResponse.json({ error: "skill_id obrigatório." }, { status: 400 });

  const supabase = db();
  const ok = await desactivarSkillAgente(supabase, tenantId, slug, skillId);
  return NextResponse.json({ ok });
}
