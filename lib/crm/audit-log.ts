import type { SupabaseClient } from "@supabase/supabase-js";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";

export type HubLogEntidade =
  | "lead"
  | "negocio"
  | "pessoa"
  | "empresa"
  | "encaminhamento"
  | string;

export async function registrarLogCrm(
  supabase: SupabaseClient,
  params: {
    entidade: HubLogEntidade;
    entidade_id: string;
    acao: string;
    valor_anterior?: string | null;
    valor_novo?: string | null;
    motivo?: string | null;
    usuario_id?: string | null;
    origem?: string;
    tenant_id?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  if (!crmFeatureFlags.logsAuditoria()) return;

  const { error } = await supabase.from("hub_logs").insert({
    entidade: params.entidade,
    entidade_id: params.entidade_id,
    acao: params.acao,
    valor_anterior: params.valor_anterior ?? null,
    valor_novo: params.valor_novo ?? null,
    motivo: params.motivo ?? null,
    usuario_id: params.usuario_id ?? null,
    origem: params.origem ?? "crm",
    tenant_id: params.tenant_id ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.warn("[hub_logs]", error.message);
  }
}
