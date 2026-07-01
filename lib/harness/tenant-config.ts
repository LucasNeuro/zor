import type { SupabaseClient } from "@supabase/supabase-js";

/** Config harness por tenant (RFC Fase 4 — write_approval). */
export type HarnessTenantConfig = {
  memory_write_approval: boolean;
  skills_write_approval: boolean;
};

const DEFAULT: HarnessTenantConfig = {
  memory_write_approval: false,
  skills_write_approval: true,
};

export async function carregarHarnessTenantConfig(
  supabase: SupabaseClient,
  tenantId: string
): Promise<HarnessTenantConfig> {
  const { data, error } = await supabase
    .from("hub_tenants")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle();

  if (error || !data?.settings || typeof data.settings !== "object") {
    return { ...DEFAULT };
  }

  const settings = data.settings as Record<string, unknown>;
  const harness =
    settings.harness && typeof settings.harness === "object"
      ? (settings.harness as Record<string, unknown>)
      : {};

  return {
    memory_write_approval: harness.memory_write_approval === true,
    skills_write_approval: harness.skills_write_approval !== false,
  };
}

export function memoriaExigeAprovacaoTenant(cfg: HarnessTenantConfig): boolean {
  return cfg.memory_write_approval;
}

export function skillsExigemAprovacaoTenant(cfg: HarnessTenantConfig): boolean {
  return cfg.skills_write_approval;
}
