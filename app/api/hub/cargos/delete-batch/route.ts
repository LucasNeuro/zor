import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import { deleteCargoCatalogo } from "@/lib/hub/cargo-catalogo-db";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** POST { slugs: string[] } — elimina cada slug (RPC ou fallback). */
export async function POST(request: NextRequest) {
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const { tenantId } = tenantResolved;

  const supabase = db();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const raw = body.slugs;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "slugs deve ser um array não vazio." }, { status: 400 });
  }

  const slugs = [...new Set(raw.map((s) => String(s).trim()).filter((s) => s.length >= 2))];
  if (slugs.length === 0) {
    return NextResponse.json({ error: "Nenhum slug válido." }, { status: 400 });
  }

  const deleted: string[] = [];
  const blocked: { slug: string; error: string }[] = [];

  for (const slug of slugs) {
    const result = await deleteCargoCatalogo(supabase, slug, tenantId);
    if (result.ok) deleted.push(result.slug);
    else blocked.push({ slug, error: result.error });
  }

  return NextResponse.json({
    ok: blocked.length === 0,
    deleted,
    blocked,
    counts: { deleted: deleted.length, blocked: blocked.length },
  });
}
