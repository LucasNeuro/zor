import { NextRequest, NextResponse } from "next/server";
import { createHubLogger } from "@/lib/observability/hub-log";

const ALLOWED_EVENTS = new Set([
  "playbook.flow_visual.sideover_opened",
  "playbook.flow_visual.markdown_applied",
  "playbook.flow_visual.builder_fallback",
  "playbook.flow_visual.draft_saved",
  "playbook.flow_visual.publish_validation_invalid",
  "playbook.flow_visual.starter_flow_created",
]);

function safeString(value: unknown, max = 120): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, max);
}

function normalizeMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(source)) {
    if (!key || key.length > 60) continue;
    const lower = key.toLowerCase();
    if (
      lower.includes("lead") ||
      lower.includes("telefone") ||
      lower.includes("phone") ||
      lower.includes("email") ||
      lower.includes("nome") ||
      lower.includes("markdown") ||
      lower.includes("content") ||
      lower.includes("message")
    ) {
      continue;
    }
    if (typeof raw === "string") {
      out[key] = raw.slice(0, 200);
      continue;
    }
    if (typeof raw === "number" || typeof raw === "boolean") {
      out[key] = raw;
      continue;
    }
    if (Array.isArray(raw) && raw.length <= 8) {
      const values = raw
        .filter((v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")
        .map((v) => (typeof v === "string" ? v.slice(0, 80) : v));
      out[key] = values;
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  let body: { event?: unknown; agente_slug?: unknown; metadata?: unknown };
  try {
    body = (await request.json()) as { event?: unknown; agente_slug?: unknown; metadata?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const event = safeString(body.event);
  if (!event || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
  }
  const agenteSlug = safeString(body.agente_slug);
  if (!agenteSlug) {
    return NextResponse.json({ error: "agente_slug obrigatório." }, { status: 400 });
  }

  const logger = createHubLogger("playbook_visual_editor", {
    channel: "playbook_visual_flow",
    agente_slug: agenteSlug,
  });

  logger.info(event, normalizeMetadata(body.metadata));
  return NextResponse.json({ ok: true, trace_id: logger.traceId });
}
