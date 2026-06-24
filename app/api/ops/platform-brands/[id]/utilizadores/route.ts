import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { loadPlatformBrandUsers } from "@/lib/ops/platform-brand-stats";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

/** Utilizadores e tenants da marca (leitura — controlo financeiro). */
export async function GET(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const db = crmDb();

  const { data: brand, error: bErr } = await db
    .from("hub_platform_brands")
    .select("id, nome, is_principal")
    .eq("id", id)
    .maybeSingle();

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
  if (!brand) return NextResponse.json({ error: "Plataforma não encontrada." }, { status: 404 });

  const { data: principal } = await db
    .from("hub_platform_brands")
    .select("id")
    .eq("is_principal", true)
    .maybeSingle();

  try {
    const { stats, usuarios } = await loadPlatformBrandUsers(
      db,
      id,
      principal?.id != null ? String(principal.id) : null
    );
    return NextResponse.json({
      data: {
        brand_id: id,
        brand_nome: brand.nome,
        stats,
        usuarios,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao carregar utilizadores." },
      { status: 500 }
    );
  }
}
