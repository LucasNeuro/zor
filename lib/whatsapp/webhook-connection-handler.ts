import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractWebhookInstanceRefs,
  normalizeWebhookInstanceId,
} from "@/lib/whatsapp/webhook-inbound";
import { statusFromPayloadUazapi } from "@/lib/whatsapp/uazapi-instance-status";
import {
  resolverLinhaWhatsAppInbound,
  type LinhaWhatsAppEscopo,
} from "@/lib/whatsapp/resolver-linha-whatsapp";

function pickEventName(body: Record<string, unknown>): string {
  const direct =
    (typeof body.event === "string" && body.event.trim()) ||
    (typeof body.EventType === "string" && body.EventType.trim()) ||
    (typeof body.type === "string" && body.type.trim()) ||
    "";
  if (direct) return direct.toLowerCase();
  const payload = body.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const p = payload as Record<string, unknown>;
    const nested =
      (typeof p.event === "string" && p.event.trim()) ||
      (typeof p.EventType === "string" && p.EventType.trim()) ||
      "";
    if (nested) return nested.toLowerCase();
  }
  return "";
}

export function eventoWebhookEhConnection(body: Record<string, unknown>): boolean {
  const ev = pickEventName(body);
  return ev === "connection" || ev.includes("connection");
}

export type ConnectionWebhookResult =
  | { handled: false }
  | {
      handled: true;
      updated: boolean;
      tenantId?: string;
      scope: LinhaWhatsAppEscopo;
      status: string;
      linhaKind: string;
    };

export async function processarWebhookConnectionUazapi(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  scope: LinhaWhatsAppEscopo
): Promise<ConnectionWebhookResult> {
  if (!eventoWebhookEhConnection(body)) return { handled: false };

  const refs = extractWebhookInstanceRefs(body);
  const instanceKey =
    normalizeWebhookInstanceId(body) ?? refs.instanceId ?? refs.instanceName ?? undefined;

  const linhaWa = await resolverLinhaWhatsAppInbound(supabase, instanceKey, {
    instanceToken: refs.instanceToken,
    instanceName: refs.instanceName,
    escopo: scope,
  });

  if (linhaWa.kind === "ignored") {
    return {
      handled: true,
      updated: false,
      scope,
      status: statusFromPayloadUazapi(body),
      linhaKind: `ignored:${linhaWa.reason}`,
    };
  }

  const st = statusFromPayloadUazapi(body);
  const now = new Date().toISOString();

  if (linhaWa.kind === "gestor_instance") {
    const { error } = await supabase
      .from("hub_linha_gestor_whatsapp")
      .update({ uazapi_connection_status: st, uazapi_snapshot_at: now })
      .eq("tenant_id", linhaWa.tenantId);
    return {
      handled: true,
      updated: !error,
      tenantId: linhaWa.tenantId,
      scope,
      status: st,
      linhaKind: linhaWa.kind,
    };
  }

  if (linhaWa.kind === "agent_instance") {
    const { error } = await supabase
      .from("hub_agente_identidade")
      .update({ uazapi_connection_status: st, uazapi_snapshot_at: now })
      .eq("agente_slug", linhaWa.agenteSlug)
      .eq("tenant_id", linhaWa.tenantId);
    return {
      handled: true,
      updated: !error,
      tenantId: linhaWa.tenantId,
      scope,
      status: st,
      linhaKind: linhaWa.kind,
    };
  }

  return {
    handled: true,
    updated: false,
    scope,
    status: st,
    linhaKind: linhaWa.kind,
  };
}
