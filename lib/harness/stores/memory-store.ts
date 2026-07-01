import type { SupabaseClient } from "@supabase/supabase-js";

export type MemoryTarget = "operacional" | "utilizador" | "atendimento";

function tabelaInexistente(msg?: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes("hub_agente_memory") && (m.includes("does not exist") || m.includes("schema cache"));
}

export async function carregarMemorySnapshot(
  supabase: SupabaseClient,
  tenantId: string,
  agenteSlug: string,
  targets: MemoryTarget[] = ["operacional", "utilizador", "atendimento"]
): Promise<Record<MemoryTarget, string>> {
  const out: Record<string, string> = {};
  const { data, error } = await supabase
    .from("hub_agente_memory")
    .select("target, conteudo")
    .eq("tenant_id", tenantId)
    .eq("agente_slug", agenteSlug)
    .in("target", targets);

  if (error) {
    if (tabelaInexistente(error.message)) return out as Record<MemoryTarget, string>;
    return out as Record<MemoryTarget, string>;
  }

  for (const row of data ?? []) {
    const t = row.target as MemoryTarget;
    const c = typeof row.conteudo === "string" ? row.conteudo.trim() : "";
    if (c) out[t] = c.slice(0, 2200);
  }
  return out as Record<MemoryTarget, string>;
}

export function formatarBlocoMemorySnapshot(
  snapshot: Record<string, string>
): string {
  const partes: string[] = [];
  if (snapshot.operacional) {
    partes.push(`**Operacional:**\n${snapshot.operacional}`);
  }
  if (snapshot.utilizador) {
    partes.push(`**Preferências do gestor:**\n${snapshot.utilizador}`);
  }
  if (snapshot.atendimento) {
    partes.push(`**Padrões de atendimento:**\n${snapshot.atendimento}`);
  }
  if (!partes.length) return "";
  return [
    "═══ MEMÓRIA CURADA DO AGENTE (snapshot da sessão — não contradiga CRM) ═══",
    ...partes,
  ].join("\n\n");
}

export async function upsertMemoryTarget(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    agenteSlug: string;
    target: MemoryTarget;
    conteudo: string;
  }
): Promise<void> {
  const conteudo = params.conteudo.trim().slice(0, 2200);
  if (!conteudo) return;

  const { error } = await supabase.from("hub_agente_memory").upsert(
    {
      tenant_id: params.tenantId,
      agente_slug: params.agenteSlug,
      target: params.target,
      conteudo,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "tenant_id,agente_slug,target" }
  );

  if (error && !tabelaInexistente(error.message)) {
    throw error;
  }
}

const MAX_LINHAS_RESUMO_CONVERSA = 12;

/** Acumula tópicos recentes do copiloto (entre sessões) em target utilizador. */
export async function appendResumoTurnoCopiloto(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    agenteSlug: string;
    linhaResumo: string;
  }
): Promise<void> {
  const linha = params.linhaResumo.trim();
  if (!linha) return;

  const snap = await carregarMemorySnapshot(supabase, params.tenantId, params.agenteSlug, [
    "utilizador",
  ]);
  const prev = snap.utilizador?.trim() ?? "";
  const prefixo = "Últimos tópicos com o gestor:";
  const existentes = prev
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .slice(-(MAX_LINHAS_RESUMO_CONVERSA - 1));
  const novas = [...existentes, `- ${linha.slice(0, 200)}`].slice(-MAX_LINHAS_RESUMO_CONVERSA);
  const conteudo = `${prefixo}\n${novas.join("\n")}`;

  await upsertMemoryTarget(supabase, {
    tenantId: params.tenantId,
    agenteSlug: params.agenteSlug,
    target: "utilizador",
    conteudo,
  });
}

export async function stagingMemoryPatch(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    agenteSlug: string;
    sessionId?: string | null;
    target: MemoryTarget;
    conteudo: string;
    requireApproval?: boolean;
  }
): Promise<"applied" | "staged"> {
  if (!params.requireApproval) {
    await upsertMemoryTarget(supabase, {
      tenantId: params.tenantId,
      agenteSlug: params.agenteSlug,
      target: params.target,
      conteudo: params.conteudo,
    });
    return "applied";
  }

  await supabase.from("hub_harness_pending_writes").insert({
    tenant_id: params.tenantId,
    agente_slug: params.agenteSlug,
    session_id: params.sessionId ?? null,
    tipo: "memory_patch",
    payload: { target: params.target, conteudo: params.conteudo.slice(0, 2200) },
    status: "pending",
  });
  return "staged";
}
