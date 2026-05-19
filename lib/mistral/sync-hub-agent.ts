import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ferramentasMistralListaParaAgente,
  mergeUsoFerramentasComPadraoPreservandoCustom,
} from "@/lib/hub/agente-ferramentas-registry";
import {
  fetchFerramentasCustomAtivas,
  rowParaMistralDef,
  type FerramentaCustomParaMistral,
} from "@/lib/hub/ferramentas-custom-db";
import {
  resolveMistralAgentsModelId,
} from "@/lib/ia/hub-model-defaults";
import { loadAgentPlaybookSnapshot } from "@/lib/playbook/agent-snapshot";
import { buildUnifiedProductionPrompt } from "@/lib/playbook/render-deterministic";
import { defaultTenantId } from "@/lib/tenant-default";

const MISTRAL_AGENTS_URL = "https://api.mistral.ai/v1/agents";

type IdentRow = {
  agente_slug: string;
  nome: string | null;
  system_prompt_base: string | null;
  modelo_padrao: string | null;
  mistral_agent_id: string | null;
  uso_ferramentas_ia: unknown;
  tenant_id?: string | null;
};

function truncarInstrucoes(s: string, max = 32000): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n\n[… truncado por limite Mistral …]";
}

/** Mesmo texto que a engine usa em produção (identidade + conhecimento + regras). */
async function resolverInstrucoesMistral(
  supabase: SupabaseClient,
  agenteSlug: string,
  fallback: string
): Promise<string> {
  const loaded = await loadAgentPlaybookSnapshot(supabase, agenteSlug);
  if ("error" in loaded) {
    return truncarInstrucoes(fallback);
  }
  try {
    const unified = buildUnifiedProductionPrompt(loaded.snapshot).trim();
    if (unified) return truncarInstrucoes(unified);
  } catch (e) {
    console.warn("[mistral-agents] buildUnifiedProductionPrompt:", agenteSlug, e);
  }
  return truncarInstrucoes(fallback);
}

export type SyncHubAgentMistralResult =
  | { ok: true; mistral_agent_id: string; created: boolean }
  | { ok: false; error: string };

/**
 * Cria ou actualiza um agente na Mistral (Agents API) e persiste estado no Hub.
 */
export async function syncHubAgenteParaMistral(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<SyncHubAgentMistralResult> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "MISTRAL_API_KEY não configurada no servidor." };
  }

  const { data: row, error } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, nome, system_prompt_base, modelo_padrao, mistral_agent_id, uso_ferramentas_ia, mistral_agent_sync_habilitado, tenant_id"
    )
    .eq("agente_slug", agenteSlug)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  const r = row as IdentRow & { mistral_agent_sync_habilitado?: boolean };
  if (!r) return { ok: false, error: "Agente não encontrado." };

  if (r.mistral_agent_sync_habilitado === false) {
    return { ok: false, error: "Sincronização Mistral desativada para este agente." };
  }

  const model = resolveMistralAgentsModelId(String(r.modelo_padrao || ""));
  const name = `hub-${r.agente_slug}`.slice(0, 64);
  const fallbackInstr = String(r.system_prompt_base || r.nome || r.agente_slug);
  const instructions = await resolverInstrucoesMistral(supabase, agenteSlug, fallbackInstr);
  const uso = mergeUsoFerramentasComPadraoPreservandoCustom(r.uso_ferramentas_ia);
  const tenantId = String(r.tenant_id || "").trim() || defaultTenantId();
  let customDefs: FerramentaCustomParaMistral[] = [];
  try {
    const rows = await fetchFerramentasCustomAtivas(supabase, tenantId);
    customDefs = rows.map(rowParaMistralDef);
  } catch {
    customDefs = [];
  }
  const tools = ferramentasMistralListaParaAgente(uso, customDefs);

  const body: Record<string, unknown> = {
    model,
    name,
    description: `Agente Hub «${r.nome || r.agente_slug}» — sincronizado a partir do escritório virtual.`,
    instructions,
    tools: tools.length > 0 ? tools : undefined,
  };

  const existingId = r.mistral_agent_id?.trim();

  try {
    let mistralId = existingId;
    let created = false;

    if (existingId) {
      const res = await fetch(`${MISTRAL_AGENTS_URL}/${encodeURIComponent(existingId)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        const fallback = await tentarCriarAgente(key, body);
        if (!fallback.ok) {
          await gravarErroSync(supabase, agenteSlug, `PATCH ${res.status}: ${text.slice(0, 400)}`);
          return { ok: false, error: `Mistral PATCH falhou (${res.status}). ${text.slice(0, 200)}` };
        }
        mistralId = fallback.id;
        created = true;
      } else {
        const data = JSON.parse(text || "{}") as { id?: string };
        mistralId = data.id || existingId;
      }
    } else {
      const createdRes = await tentarCriarAgente(key, body);
      if (!createdRes.ok) {
        await gravarErroSync(supabase, agenteSlug, createdRes.error);
        return { ok: false, error: createdRes.error };
      }
      mistralId = createdRes.id;
      created = true;
    }

    await supabase
      .from("hub_agente_identidade")
      .update({
        mistral_agent_id: mistralId,
        mistral_agent_sync_em: new Date().toISOString(),
        mistral_agent_sync_erro: null,
      })
      .eq("agente_slug", agenteSlug);

    return { ok: true, mistral_agent_id: mistralId!, created };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await gravarErroSync(supabase, agenteSlug, msg);
    return { ok: false, error: msg };
  }
}

async function tentarCriarAgente(
  key: string,
  body: Record<string, unknown>
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await fetch(MISTRAL_AGENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: `Mistral POST agents ${res.status}: ${text.slice(0, 400)}` };
  }
  try {
    const data = JSON.parse(text) as { id?: string; agent_id?: string };
    const id = data.id || data.agent_id;
    if (!id) return { ok: false, error: "Mistral não devolveu id do agente." };
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Resposta Mistral inválida (JSON)." };
  }
}

async function gravarErroSync(supabase: SupabaseClient, slug: string, erro: string) {
  await supabase
    .from("hub_agente_identidade")
    .update({
      mistral_agent_sync_erro: erro.slice(0, 2000),
    })
    .eq("agente_slug", slug);
}

/** Serializa uso para JSONB: builtins normalizados + chaves hub_custom_* preservadas. */
export function serializarUsoFerramentasParaDb(raw: unknown): Record<string, boolean> {
  return mergeUsoFerramentasComPadraoPreservandoCustom(raw);
}

/** Sincroniza todos os agentes com mistral_agent_sync_habilitado = true. */
export async function syncTodosAgentesHubParaMistral(
  supabase: SupabaseClient
): Promise<Array<{ agente_slug: string; ok: boolean; mistral_agent_id?: string; error?: string }>> {
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug")
    .eq("mistral_agent_sync_habilitado", true)
    .order("agente_slug");

  if (error) {
    return [{ agente_slug: "*", ok: false, error: error.message }];
  }

  const out: Array<{ agente_slug: string; ok: boolean; mistral_agent_id?: string; error?: string }> = [];
  for (const row of data ?? []) {
    const slug = String((row as { agente_slug?: string }).agente_slug ?? "").trim();
    if (!slug) continue;
    const syn = await syncHubAgenteParaMistral(supabase, slug);
    out.push({
      agente_slug: slug,
      ok: syn.ok,
      mistral_agent_id: syn.ok ? syn.mistral_agent_id : undefined,
      error: syn.ok ? undefined : syn.error,
    });
  }
  return out;
}
