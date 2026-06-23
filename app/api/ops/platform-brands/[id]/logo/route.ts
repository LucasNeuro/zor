import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { clearPlatformBrandCache } from "@/lib/platform-brands";
import {
  mapPlatformBrandRow,
  type PlatformBrandRow,
} from "@/lib/ops/platform-brand-map";
import {
  uploadPlatformBrandAsset,
  type PlatformBrandAssetKind,
} from "@/lib/ops/platform-brand-logo-upload";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

const FIELD_BY_KIND: Record<PlatformBrandAssetKind, keyof PlatformBrandRow> = {
  logo: "logo_url",
  logo_dark: "logo_dark_url",
  favicon: "favicon_url",
};

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Use multipart/form-data com campos file e kind (logo|favicon|logo_dark)." },
      { status: 415 }
    );
  }

  const { data: row, error: loadErr } = await crmDb()
    .from("hub_platform_brands")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!row?.slug) return NextResponse.json({ error: "Plataforma não encontrada." }, { status: 404 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido." }, { status: 400 });
  }

  const file = form.get("file");
  const kindRaw = String(form.get("kind") ?? "logo").trim().toLowerCase();
  const kind: PlatformBrandAssetKind =
    kindRaw === "favicon" ? "favicon" : kindRaw === "logo_dark" ? "logo_dark" : "logo";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo no campo file." }, { status: 400 });
  }

  const uploaded = await uploadPlatformBrandAsset(crmDb(), String(row.slug), kind, file);
  if (!uploaded.ok) {
    return NextResponse.json({ error: uploaded.error }, { status: 500 });
  }

  const field = FIELD_BY_KIND[kind];
  const { data: updated, error: upErr } = await crmDb()
    .from("hub_platform_brands")
    .update({
      [field]: uploaded.publicUrl,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  clearPlatformBrandCache();
  return NextResponse.json({
    data: mapPlatformBrandRow(updated as Record<string, unknown>),
    public_url: uploaded.publicUrl,
  });
}
