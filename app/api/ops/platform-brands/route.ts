import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { clearPlatformBrandCache } from "@/lib/platform-brands";
import { enrichPlatformBrandRowAssets } from "@/lib/ops/platform-brand-asset-url";
import { cadastroPatchFromBody, mapPlatformBrandRow } from "@/lib/ops/platform-brand-map";
import { loadPlatformBrandStatsMap } from "@/lib/ops/platform-brand-stats";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

export async function GET(request: NextRequest) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const db = crmDb();
  const { data, error } = await db
    .from("hub_platform_brands")
    .select("*")
    .order("is_principal", { ascending: false })
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message, schema_ready: false }, { status: 500 });
  }

  const rows = await Promise.all(
    (data ?? []).map(async (r) => {
      const mapped = mapPlatformBrandRow(r as Record<string, unknown>);
      const enriched = await enrichPlatformBrandRowAssets(db, mapped);
      return mapPlatformBrandRow(enriched as Record<string, unknown>);
    })
  );

  const principalId = rows.find((r) => r.is_principal)?.id ?? null;
  let statsMap: Map<string, import("@/lib/ops/platform-brand-stats").PlatformBrandStats>;
  try {
    statsMap = await loadPlatformBrandStatsMap(db, principalId);
  } catch {
    statsMap = new Map();
  }

  const withStats = rows.map((r) => {
    const s = statsMap.get(r.id);
    return {
      ...r,
      tenants_total: s?.tenants_total ?? 0,
      tenants_ativos: s?.tenants_ativos ?? 0,
      usuarios_total: s?.usuarios_total ?? 0,
      usuarios_ativos: s?.usuarios_ativos ?? 0,
    };
  });

  clearPlatformBrandCache();
  return NextResponse.json({ data: withStats });
}

export async function POST(request: NextRequest) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const slug = String(body.slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const nome = String(body.nome ?? "").trim();
  if (!slug || !nome) {
    return NextResponse.json({ error: "slug e nome são obrigatórios." }, { status: 400 });
  }

  const dominios = Array.isArray(body.dominios)
    ? body.dominios.map((d) => String(d).trim().toLowerCase()).filter(Boolean)
    : String(body.dominios ?? "")
        .split(/[,;\n]+/)
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);

  const { data, error } = await crmDb()
    .from("hub_platform_brands")
    .insert({
      slug,
      nome,
      tagline: body.tagline ? String(body.tagline).trim() : null,
      dominios,
      logo_url: body.logo_url ? String(body.logo_url).trim() : null,
      logo_dark_url: body.logo_dark_url ? String(body.logo_dark_url).trim() : null,
      favicon_url: body.favicon_url ? String(body.favicon_url).trim() : null,
      cor_primaria: body.cor_primaria ? String(body.cor_primaria).trim() : "#3f9848",
      cor_accent: body.cor_accent ? String(body.cor_accent).trim() : "#92ff00",
      cor_fundo: body.cor_fundo ? String(body.cor_fundo).trim() : "#0b1f10",
      company_name: body.company_name ? String(body.company_name).trim() : null,
      is_principal: false,
      ativo: body.ativo !== false,
      landing_assistant_ativo: body.landing_assistant_ativo !== false,
      ...cadastroPatchFromBody(body),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  clearPlatformBrandCache();
  return NextResponse.json({ data: mapPlatformBrandRow(data as Record<string, unknown>) }, { status: 201 });
}
