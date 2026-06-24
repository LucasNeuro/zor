import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { clearPlatformBrandCache } from "@/lib/platform-brands";
import { cadastroPatchFromBody, mapPlatformBrandRow } from "@/lib/ops/platform-brand-map";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { data: existing, error: loadErr } = await crmDb()
    .from("hub_platform_brands")
    .select("is_principal, slug")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Plataforma não encontrada." }, { status: 404 });

  const patch: Record<string, unknown> = {
    atualizado_em: new Date().toISOString(),
    ...cadastroPatchFromBody(body),
  };

  if (body.nome != null) patch.nome = String(body.nome).trim();
  if (body.tagline != null) patch.tagline = String(body.tagline).trim() || null;
  if (body.logo_url != null) patch.logo_url = String(body.logo_url).trim() || null;
  if (body.logo_dark_url != null) patch.logo_dark_url = String(body.logo_dark_url).trim() || null;
  if (body.favicon_url != null) patch.favicon_url = String(body.favicon_url).trim() || null;
  if (body.cor_primaria != null) patch.cor_primaria = String(body.cor_primaria).trim();
  if (body.cor_accent != null) patch.cor_accent = String(body.cor_accent).trim();
  if (body.cor_fundo != null) patch.cor_fundo = String(body.cor_fundo).trim();
  if (body.company_name != null) patch.company_name = String(body.company_name).trim() || null;
  if (body.ativo != null) patch.ativo = body.ativo === true;
  if (body.landing_assistant_ativo != null) {
    patch.landing_assistant_ativo = body.landing_assistant_ativo === true;
  }

  if (body.dominios != null) {
    patch.dominios = Array.isArray(body.dominios)
      ? body.dominios.map((d) => String(d).trim().toLowerCase()).filter(Boolean)
      : String(body.dominios)
          .split(/[,;\n]+/)
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);
  }

  if (body.slug != null && !existing.is_principal) {
    patch.slug = String(body.slug)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-");
  }

  const { data, error } = await crmDb()
    .from("hub_platform_brands")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  clearPlatformBrandCache();
  return NextResponse.json({ data: mapPlatformBrandRow(data as Record<string, unknown>) });
}
