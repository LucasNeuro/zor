import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireHubTenantId } from "@/lib/crm/hub-tenant-api";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Reordena passos (drag-and-drop). Body: { ordem_ids: string[] } */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const tenantResolved = await requireHubTenantId(request);
  if (tenantResolved instanceof NextResponse) return tenantResolved;

  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  let body: { ordem_ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const ids = Array.isArray(body.ordem_ids)
    ? body.ordem_ids.map((x) => String(x)).filter(Boolean)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ordem_ids obrigatório" }, { status: 400 });
  }

  const supabase = db();
  const { data: passos, error: listErr } = await supabase
    .from("hub_agente_followup_passo")
    .select("id")
    .eq("agente_slug", slug)
    .in("id", ids);

  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
  if ((passos || []).length !== ids.length) {
    return NextResponse.json({ error: "Passos inválidos para este agente" }, { status: 400 });
  }

  // Evita conflito UNIQUE (config_id, ordem): desloca temporariamente
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from("hub_agente_followup_passo")
      .update({ ordem: 1000 + i })
      .eq("id", ids[i])
      .eq("agente_slug", slug);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from("hub_agente_followup_passo")
      .update({ ordem: i + 1 })
      .eq("id", ids[i])
      .eq("agente_slug", slug);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: atualizados, error: fetchErr } = await supabase
    .from("hub_agente_followup_passo")
    .select("*")
    .eq("agente_slug", slug)
    .order("ordem");

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  return NextResponse.json({ passos: atualizados ?? [] });
}
