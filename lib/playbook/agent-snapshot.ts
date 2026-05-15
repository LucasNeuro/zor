import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalJsonStringify } from "./canonical-json";
import { createHash } from "crypto";

export type AgentPlaybookSnapshotV1 = {
  version: 1;
  agente_slug: string;
  captured_at: string;
  identity: Record<string, unknown> | null;
  personalidade_row: Record<string, unknown> | null;
  conhecimento: Array<Record<string, unknown>>;
  regras_ia: Array<Record<string, unknown>>;
  configuracao: Record<string, unknown> | null;
  autonomia_matriz: Array<Record<string, unknown>>;
  cargo_catalogo: Record<string, unknown> | null;
};

export function hashSnapshot(snapshot: AgentPlaybookSnapshotV1): string {
  return createHash("sha256").update(canonicalJsonStringify(snapshot), "utf8").digest("hex");
}

export async function loadAgentPlaybookSnapshot(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<{ snapshot: AgentPlaybookSnapshotV1; hash: string } | { error: string }> {
  const { data: identity, error: idErr } = await supabase
    .from("hub_agente_identidade")
    .select("*")
    .eq("agente_slug", agenteSlug)
    .maybeSingle();

  if (idErr) return { error: idErr.message };
  if (!identity) return { error: "Agente não encontrado" };

  const [
    personalidade,
    conhecimento,
    regras,
    configuracao,
    autonomia,
    cargoCat,
  ] = await Promise.all([
    supabase.from("hub_personalidade").select("*").eq("agente_slug", agenteSlug).maybeSingle(),
    supabase
      .from("hub_agente_conhecimento")
      .select("*")
      .eq("agente_slug", agenteSlug)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("secao"),
    supabase
      .from("hub_regras_ia")
      .select("*")
      .eq("agente_slug", agenteSlug)
      .eq("ativo", true)
      .order("prioridade", { ascending: false }),
    supabase.from("hub_agente_configuracao").select("*").eq("agente_slug", agenteSlug).maybeSingle(),
    supabase.from("hub_autonomia_matriz").select("*").eq("agente_slug", agenteSlug).eq("ativo", true).order("prioridade", { ascending: false }),
    supabase
      .from("hub_cargos_catalogo")
      .select("*")
      .eq("titulo", identity.cargo as string)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle(),
  ]);

  const snapshot: AgentPlaybookSnapshotV1 = {
    version: 1,
    agente_slug: agenteSlug,
    captured_at: new Date().toISOString(),
    identity: identity as Record<string, unknown>,
    personalidade_row: personalidade.data as Record<string, unknown> | null,
    conhecimento: (conhecimento.data || []) as Array<Record<string, unknown>>,
    regras_ia: (regras.data || []) as Array<Record<string, unknown>>,
    configuracao: (configuracao.data || null) as Record<string, unknown> | null,
    autonomia_matriz: (autonomia.data || []) as Array<Record<string, unknown>>,
    cargo_catalogo: (cargoCat.data || null) as Record<string, unknown> | null,
  };

  return { snapshot, hash: hashSnapshot(snapshot) };
}
