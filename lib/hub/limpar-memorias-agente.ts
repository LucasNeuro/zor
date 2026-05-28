import type { SupabaseClient } from "@supabase/supabase-js";

export type LimparMemoriasAgenteResult = {
  memoriasRemovidas: number;
  briefingSessoesRemovidas: number;
};

export type LimparMemoriasAgenteContagem = {
  memorias: number;
  briefingSessoes: number;
};

export async function contarMemoriasAgente(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<LimparMemoriasAgenteContagem> {
  const slug = agenteSlug.trim();
  let memorias = 0;
  let briefingSessoes = 0;

  const { count: memCount, error: memErr } = await supabase
    .from("hub_memorias_agente")
    .select("id", { count: "exact", head: true })
    .eq("agente_slug", slug);

  if (!memErr && typeof memCount === "number") memorias = memCount;

  const { count: briefCount, error: briefErr } = await supabase
    .from("hub_crm_agente_briefing_sessao")
    .select("id", { count: "exact", head: true })
    .eq("agente_slug", slug);

  if (!briefErr && typeof briefCount === "number") briefingSessoes = briefCount;

  return { memorias, briefingSessoes };
}

/** Apaga memórias operacionais do agente e, opcionalmente, sessões do briefing interno. */
export async function limparMemoriasAgente(
  supabase: SupabaseClient,
  agenteSlug: string,
  opts?: { incluirBriefing?: boolean }
): Promise<LimparMemoriasAgenteResult> {
  const slug = agenteSlug.trim();
  const incluirBriefing = opts?.incluirBriefing !== false;

  let memoriasRemovidas = 0;
  let briefingSessoesRemovidas = 0;

  const { data: memRows, error: memErr } = await supabase
    .from("hub_memorias_agente")
    .delete()
    .eq("agente_slug", slug)
    .select("id");

  if (memErr) {
    if (!memErr.message.includes("hub_memorias_agente") || !memErr.message.includes("does not exist")) {
      throw new Error(memErr.message);
    }
  } else {
    memoriasRemovidas = memRows?.length ?? 0;
  }

  if (incluirBriefing) {
    const { data: briefRows, error: briefErr } = await supabase
      .from("hub_crm_agente_briefing_sessao")
      .delete()
      .eq("agente_slug", slug)
      .select("id");

    if (briefErr) {
      if (
        !briefErr.message.includes("hub_crm_agente_briefing_sessao") ||
        !briefErr.message.includes("does not exist")
      ) {
        throw new Error(briefErr.message);
      }
    } else {
      briefingSessoesRemovidas = briefRows?.length ?? 0;
    }
  }

  return { memoriasRemovidas, briefingSessoesRemovidas };
}
