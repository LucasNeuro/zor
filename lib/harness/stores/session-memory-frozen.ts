import type { SupabaseClient } from "@supabase/supabase-js";
import {
  carregarMemorySnapshot,
  formatarBlocoMemorySnapshot,
  type MemoryTarget,
} from "@/lib/harness/stores/memory-store";

export type MemorySnapshotFrozen = Partial<Record<MemoryTarget, string>>;

function tabelaInexistente(msg?: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes("hub_harness_sessions") && (m.includes("does not exist") || m.includes("schema cache"));
}

/** RFC Fase 4 — snapshot congelado no início da sessão harness. */
export async function obterOuCongelarMemorySnapshotSessao(
  supabase: SupabaseClient,
  params: {
    sessionId: string;
    tenantId: string;
    agenteSlug: string;
  }
): Promise<{ snapshot: MemorySnapshotFrozen; bloco: string }> {
  const { data, error } = await supabase
    .from("hub_harness_sessions")
    .select("state")
    .eq("id", params.sessionId)
    .maybeSingle();

  if (error && !tabelaInexistente(error.message)) {
    const snap = await carregarMemorySnapshot(supabase, params.tenantId, params.agenteSlug);
    return { snapshot: snap, bloco: formatarBlocoMemorySnapshot(snap) };
  }

  const state = (data?.state ?? {}) as Record<string, unknown>;
  const frozen = state.memory_snapshot as MemorySnapshotFrozen | undefined;

  if (frozen && typeof frozen === "object" && Object.keys(frozen).length > 0) {
    return { snapshot: frozen, bloco: formatarBlocoMemorySnapshot(frozen) };
  }

  const snap = await carregarMemorySnapshot(supabase, params.tenantId, params.agenteSlug);
  const nextState = { ...state, memory_snapshot: snap, memory_frozen_at: new Date().toISOString() };

  await supabase
    .from("hub_harness_sessions")
    .update({ state: nextState })
    .eq("id", params.sessionId);

  return { snapshot: snap, bloco: formatarBlocoMemorySnapshot(snap) };
}
