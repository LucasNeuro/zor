import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
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
 * Aplica preset de conversação WhatsApp a um agente existente (ex.: Mari).
 * POST body: { preset?: "conversacao_universal", publicar_playbook?, forcar_playbook?, sincronizar_cargo? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { slug: raw } = await params;
  const agenteSlug = decodeURIComponent(raw).trim();
  if (!agenteSlug) {
    return NextResponse.json({ error: "slug inválido." }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const presetRaw = body.preset ?? body.preset_id ?? "conversacao_universal";
  if (!isWaPresetId(presetRaw)) {
    return NextResponse.json(
      { error: `preset inválido. Use: conversacao_universal.` },
      { status: 400 }
    );
  }
  const presetId = presetRaw as WaPresetId;

  const supabase = db();
  const result = await applyWaConversacaoPreset(supabase, agenteSlug, {
    presetId,
    publicarPlaybook: body.publicar_playbook === true,
    forcarPlaybook: body.forcar_playbook === true,
    sincronizarCargo: body.sincronizar_cargo !== false,
    cargoSlug: typeof body.cargo_slug === "string" ? body.cargo_slug.trim() : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, passos: result.passos ?? [] },
      { status: 400 }
    );
  }

  return NextResponse.json({
    sucesso: true,
    ...result,
  });
}
