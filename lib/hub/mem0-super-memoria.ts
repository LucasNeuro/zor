import type { SupabaseClient } from "@supabase/supabase-js";
import { extrairNomeClienteDaMensagem } from "@/lib/crm/extrair-nome-cliente";
import { salvarMemoriaNomeLead } from "@/lib/ia/memoria-lead";
import {
  mem0AddConversation,
  mem0SearchMemories,
  type Mem0SearchHit,
  resolverMem0ApiKey,
} from "@/lib/hub/mem0-api";
import { MEM0_SUPER_MEMORIA_KEY } from "@/lib/hub/mem0-constants";

export function mem0SuperMemoriaAtiva(usoFerramentas: Record<string, boolean> | null | undefined): boolean {
  return usoFerramentas?.[MEM0_SUPER_MEMORIA_KEY] === true;
}

export function formatarBlocoMem0SuperMemoria(hits: Mem0SearchHit[]): string {
  if (!hits.length) return "";
  const linhas = hits
    .slice(0, 8)
    .map((h) => `• ${(h.memory ?? h.text ?? "").slice(0, 280)}`)
    .filter((l) => l.length > 2);
  if (!linhas.length) return "";
  return `═══ SUPER MEMÓRIA (Mem0 — recall entre sessões) ═══
Use estas memórias para personalizar a conversa. Se o cliente corrigir um dado (ex.: nome), priorize o que disse agora e actualize o CRM.
${linhas.join("\n")}`;
}

/** Injecta contexto Mem0 no prompt antes do turno. */
export async function buscarBlocoMem0SuperMemoriaParaPrompt(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    leadId: string;
    agenteSlug: string;
    mensagem: string;
    usoFerramentas?: Record<string, boolean> | null;
  }
): Promise<string | null> {
  if (!mem0SuperMemoriaAtiva(params.usoFerramentas)) return null;

  const apiKey = await resolverMem0ApiKey(supabase, params.tenantId);
  if (!apiKey) return null;

  const query =
    params.mensagem.trim().slice(0, 400) ||
    "nome do cliente preferências interesses contexto anterior";

  const search = await mem0SearchMemories({
    apiKey,
    query,
    userId: params.leadId,
    agentId: params.agenteSlug,
    limit: 6,
  });

  if (!search.ok || !search.hits.length) return null;
  return formatarBlocoMem0SuperMemoria(search.hits);
}

/** Grava turno no Mem0 após resposta (fire-and-forget seguro). */
export async function sincronizarTurnoMem0SuperMemoria(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    leadId: string;
    agenteSlug: string;
    mensagemUsuario: string;
    respostaIA: string;
    telefone?: string;
    usoFerramentas?: Record<string, boolean> | null;
  }
): Promise<{ ok: boolean; motivo?: string }> {
  if (!mem0SuperMemoriaAtiva(params.usoFerramentas)) {
    return { ok: false, motivo: "super_memoria_desligada" };
  }

  const apiKey = await resolverMem0ApiKey(supabase, params.tenantId);
  if (!apiKey) return { ok: false, motivo: "mem0_sem_api_key" };

  const add = await mem0AddConversation({
    apiKey,
    userId: params.leadId,
    agentId: params.agenteSlug,
    messages: [
      { role: "user", content: params.mensagemUsuario },
      { role: "assistant", content: params.respostaIA },
    ],
    metadata: {
      tenant_id: params.tenantId,
      ...(params.telefone?.trim() ? { telefone: params.telefone.replace(/\D/g, "").slice(0, 15) } : {}),
    },
  });

  if (!add.ok) {
    console.warn("[MEM0] add turno:", add.erro);
    return { ok: false, motivo: add.erro };
  }

  const nomeMsg = extrairNomeClienteDaMensagem(params.mensagemUsuario, { respostaCurtaPermitida: true });
  if (nomeMsg) {
    await salvarMemoriaNomeLead(supabase, params.leadId, nomeMsg, "mem0_turno", 0.92);
  }

  return { ok: true };
}
