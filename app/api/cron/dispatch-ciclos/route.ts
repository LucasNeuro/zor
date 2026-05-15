import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import {
  type HubCicloIaDispatchRow,
  inferDispatchFromCicloRow,
  isProgramadoCicloDue,
} from "@/lib/ciclos-dispatch";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MAX_RUN_PER_TICK = 25;

function publicBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  const v = process.env.VERCEL_URL?.trim();
  if (v) return `https://${v.replace(/\/$/, "")}`;
  return "http://localhost:3001";
}

function innerCronHeaders(): HeadersInit {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) return { Authorization: `Bearer ${secret}` };
  return {};
}

/**
 * Um único agendamento externo (ex.: cron 1–5 min no Render/VPS) chama esta rota.
 * Lê `hub_ciclos_ia` (ativo, tipo programado), decide o que está "devido" e invoca
 * os runners existentes com `hub_ciclo_id` para atualizar a linha certa.
 *
 * Query: `dry_run=1` — só lista o que dispararia, sem HTTP interno.
 */
export async function GET(request: NextRequest) {
  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ erro: "Serviço indisponível" }, { status: 503 });
  }

  const dryRun =
    request.nextUrl.searchParams.get("dry_run") === "true" ||
    request.nextUrl.searchParams.get("dry_run") === "1";
  const now = new Date();
  const supabase = db();

  const { data: rows, error } = await supabase
    .from("hub_ciclos_ia")
    .select(
      "id, agente_slug, nome, tipo, ativo, cron_expressao, intervalo_minutos, ultimo_ciclo, configuracoes"
    )
    .eq("ativo", true)
    .eq("tipo", "programado");

  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  const list = (rows || []) as HubCicloIaDispatchRow[];
  const due: Array<{ id: string; nome: string; dispatch: { api: string; ciclo: string } }> = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const row of list) {
    if (!isProgramadoCicloDue(row, now)) continue;
    const dispatch = inferDispatchFromCicloRow(row);
    if (!dispatch) {
      skipped.push({
        id: row.id,
        reason:
          "Sem rota: use configuracoes.dispatch { api, ciclo } ou nome/slug compatível (documento mestre).",
      });
      continue;
    }
    due.push({ id: row.id, nome: row.nome, dispatch });
  }

  const ran: Array<{ id: string; ok: boolean; status?: number }> = [];
  const errors: string[] = [];

  if (!dryRun && due.length > 0) {
    const origin = publicBaseUrl();
    const slice = due.slice(0, MAX_RUN_PER_TICK);
    for (const d of slice) {
      const url = new URL(`${origin}/api/ciclos/${d.dispatch.api}`);
      url.searchParams.set("ciclo", d.dispatch.ciclo);
      url.searchParams.set("hub_ciclo_id", d.id);
      try {
        const res = await fetch(url.toString(), {
          method: "GET",
          headers: innerCronHeaders(),
          cache: "no-store",
        });
        ran.push({ id: d.id, ok: res.ok, status: res.status });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { erro?: string };
          errors.push(`${d.nome}: HTTP ${res.status} ${j?.erro ?? ""}`.trim());
        }
      } catch (e) {
        ran.push({ id: d.id, ok: false, status: 0 });
        errors.push(`${d.nome}: ${e instanceof Error ? e.message : "fetch falhou"}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    tick: now.toISOString(),
    dry_run: dryRun,
    checked: list.length,
    due_count: due.length,
    due_preview: due.slice(0, MAX_RUN_PER_TICK).map((x) => ({
      id: x.id,
      nome: x.nome,
      api: x.dispatch.api,
      ciclo: x.dispatch.ciclo,
    })),
    ran: dryRun ? [] : ran,
    skipped: skipped.slice(0, 50),
    skipped_count: skipped.length,
    capped: due.length > MAX_RUN_PER_TICK,
    errors,
  });
}

export const POST = GET;
