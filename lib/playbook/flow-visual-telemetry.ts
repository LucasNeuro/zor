import { internalApiHeaders } from "@/lib/internal-api-headers";

export type FlowVisualTelemetryEvent =
  | "playbook.flow_visual.sideover_opened"
  | "playbook.flow_visual.markdown_applied"
  | "playbook.flow_visual.builder_fallback"
  | "playbook.flow_visual.publish_validation_invalid";

type FlowVisualTelemetryPayload = {
  event: FlowVisualTelemetryEvent;
  agente_slug: string;
  metadata?: Record<string, unknown>;
};

export async function emitFlowVisualTelemetry(payload: FlowVisualTelemetryPayload): Promise<void> {
  try {
    await fetch("/api/hub/playbook/visual-telemetry", {
      method: "POST",
      headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Telemetria não deve quebrar UX do editor.
  }
}
