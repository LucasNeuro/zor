import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { tenantIdFromRequest } from "@/lib/tenant-default";
import {
  applyWaConversacaoPreset,
  isWaPresetId,
  type WaPresetId,
} from "@/lib/hub/presets/wa-conversacao-preset";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Aplica preset WA a todos os agentes de conversação WhatsApp do tenant.
 * POST: { preset?, apenas_sem_playbook?, forcar_playbook?, slugs?: string[] }
 */
export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const presetRaw = body.preset ?? "conversacao_universal";
  if (!isWaPresetId(presetRaw)) {
    return NextResponse.json({ error: "preset inválido." }, { status: 400 });
  }
  const presetId = presetRaw as WaPresetId;

  const tenantId = tenantIdFromRequest(request.headers);
  const supabase = db();

  let query = supabase
    .from("hub_agente_identidade")
    .select("agente_slug, playbook_object_path, playbook_public_url")
    .eq("ativo", true)
    .is("arquivado_em", null)
    .eq("modo_operacao", "canal_whatsapp");

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const slugsFilter = Array.isArray(body.slugs)
    ? body.slugs.map((s) => String(s).trim()).filter(Boolean)
    : [];
  if (slugsFilter.length > 0) {
    query = query.in("agente_slug", slugsFilter);
  }

  const { data: agentes, error: listErr } = await query.order("nome");
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const apenasSemPlaybook = body.apenas_sem_playbook === true;
  const forcarPlaybook = body.forcar_playbook === true;
  const publicarPlaybook = body.publicar_playbook === true;

  const resultados: Array<{
    agente_slug: string;
    ok: boolean;
    error?: string;
    playbook_publicado?: boolean;
  }> = [];

  for (const row of agentes ?? []) {
    const slug = String(row.agente_slug ?? "").trim();
    if (!slug) continue;

    const temPlaybook =
      Boolean(String(row.playbook_object_path ?? "").trim()) ||
      Boolean(String(row.playbook_public_url ?? "").trim());

    if (apenasSemPlaybook && temPlaybook) {
      resultados.push({ agente_slug: slug, ok: true, playbook_publicado: false });
      continue;
    }

    const out = await applyWaConversacaoPreset(supabase, slug, {
      presetId,
      forcarPlaybook,
      publicarPlaybook: forcarPlaybook || publicarPlaybook || !temPlaybook,
      sincronizarCargo: body.sincronizar_cargo !== false,
    });

    resultados.push({
      agente_slug: slug,
      ok: out.ok,
      error: out.ok ? undefined : out.error,
      playbook_publicado: out.ok ? out.playbook_publicado : undefined,
    });
  }

  const okCount = resultados.filter((r) => r.ok).length;
  const failCount = resultados.length - okCount;

  return NextResponse.json({
    sucesso: failCount === 0,
    total: resultados.length,
    ok: okCount,
    falhas: failCount,
    resultados,
  });
}
