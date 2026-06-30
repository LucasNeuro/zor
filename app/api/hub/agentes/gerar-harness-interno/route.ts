import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";
import { applyCargoTenantFilter } from "@/lib/hub/cargo-catalogo-tenant";
import {
  gerarHarnessInternoComMistral,
  type HarnessInternoCargoContext,
} from "@/lib/hub/superagente/gerar-harness-interno";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST { cargo_slug: string }
 * Devolve system_prompt_base + skills para superagente interno (sem playbook).
 */
export async function POST(request: NextRequest) {
  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;
  const { tenantId } = tenantResolved;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const cargoSlug = String(body.cargo_slug ?? "").trim();
  if (!cargoSlug) {
    return NextResponse.json({ error: "cargo_slug é obrigatório." }, { status: 400 });
  }

  const supabase = db();

  const { data: cat, error: catErr } = await applyCargoTenantFilter(
    supabase
      .from("hub_cargos_catalogo")
      .select(
        "slug, titulo, area, segmento, especialidade, descricao, descricao_curta, prompt_template, pode_fazer_padrao, nao_pode_fazer_padrao"
      )
      .eq("slug", cargoSlug)
      .eq("ativo", true),
    tenantId
  ).maybeSingle();

  if (catErr) {
    return NextResponse.json({ error: catErr.message }, { status: 500 });
  }
  if (!cat) {
    return NextResponse.json(
      { error: `Cargo "${cargoSlug}" não encontrado no catálogo (ativo).` },
      { status: 404 }
    );
  }

  const cargo: HarnessInternoCargoContext = {
    slug: String(cat.slug ?? cargoSlug),
    titulo: String(cat.titulo ?? "").trim(),
    area: (cat.area as string | null) ?? null,
    segmento: (cat.segmento as string | null) ?? null,
    especialidade: (cat.especialidade as string | null) ?? null,
    descricao: (cat.descricao as string | null) ?? null,
    descricao_curta: (cat.descricao_curta as string | null) ?? null,
    prompt_template: (cat.prompt_template as string | null) ?? null,
    pode_fazer_padrao: cat.pode_fazer_padrao,
    nao_pode_fazer_padrao: cat.nao_pode_fazer_padrao,
  };

  const out = await gerarHarnessInternoComMistral(cargo);
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: 502 });
  }

  return NextResponse.json({
    harness: out.harness,
    cargo_slug: cargo.slug,
    cargo_titulo: cargo.titulo,
  });
}
