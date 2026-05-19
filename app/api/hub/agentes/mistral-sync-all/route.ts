import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { syncTodosAgentesHubParaMistral } from "@/lib/mistral/sync-hub-agent";
import { HUB_MODELO_SENTINEL } from "@/lib/ia/hub-model-defaults";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isClaudeOrLegacy(modelo: unknown): boolean {
  const t = String(modelo ?? "").trim().toLowerCase();
  if (!t) return false;
  if (["haiku", "sonnet", "opus"].includes(t)) return true;
  return t.startsWith("claude-");
}

/** Normaliza modelos legados Anthropic → sentinel mistral antes do sync. */
async function normalizarModelosAgentes(supabase: ReturnType<typeof db>) {
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, modelo_padrao, modelo_critico, modelo_alto_valor");

  if (error) throw new Error(error.message);

  let alterados = 0;
  for (const row of data ?? []) {
    const patch: Record<string, string> = {};
    if (isClaudeOrLegacy(row.modelo_padrao)) patch.modelo_padrao = HUB_MODELO_SENTINEL;
    if (isClaudeOrLegacy(row.modelo_critico)) patch.modelo_critico = HUB_MODELO_SENTINEL;
    if (isClaudeOrLegacy(row.modelo_alto_valor)) patch.modelo_alto_valor = HUB_MODELO_SENTINEL;
    if (!Object.keys(patch).length) continue;

    const { error: uErr } = await supabase
      .from("hub_agente_identidade")
      .update(patch)
      .eq("agente_slug", row.agente_slug);
    if (!uErr) alterados += 1;
  }
  return alterados;
}

/**
 * POST — normaliza modelos legados e sincroniza todos os agentes com sync Mistral activo.
 * Protegido por CRON_SECRET (Bearer) ou INTERNAL_API_KEY.
 */
export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
  if (!process.env.MISTRAL_API_KEY?.trim()) {
    return NextResponse.json({ error: "MISTRAL_API_KEY não configurada." }, { status: 503 });
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cron = process.env.CRON_SECRET?.trim();
  const internal = process.env.INTERNAL_API_KEY?.trim();
  const okAuth =
    (cron && token === cron) || (internal && token === internal) || process.env.NODE_ENV === "development";

  if (!okAuth) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = db();
  try {
    const modelosNormalizados = await normalizarModelosAgentes(supabase);
    const resultados = await syncTodosAgentesHubParaMistral(supabase);
    const ok = resultados.filter((r) => r.ok).length;
    const fail = resultados.filter((r) => !r.ok).length;

    return NextResponse.json({
      ok: fail === 0,
      modelos_normalizados: modelosNormalizados,
      total: resultados.length,
      sucesso: ok,
      falhas: fail,
      resultados,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
