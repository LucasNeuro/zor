import type { SupabaseClient } from "@supabase/supabase-js";
import type { SuperagenteCanalInterno } from "@/lib/hub/superagente/canais-internos";
import {
  formatarBlocoMem0SuperMemoria,
  mem0SuperMemoriaAtiva,
} from "@/lib/hub/mem0-super-memoria";
import { mem0AddConversation, mem0SearchMemories, resolverMem0ApiKey } from "@/lib/hub/mem0-api";
import { mem0PlataformaConfigurada } from "@/lib/hub/mem0-env";
import {
  extrairESalvarMemoriasAgente,
  formatarBlocoMemoriasAgente,
  listarMemoriasAgente,
  type MemoriaAgenteOrigem,
} from "@/lib/ia/memoria-agente";

const LIMITE_HUB_MEMORIAS = 12;
const LIMITE_MEM0_HITS = 8;

/** Identificador Mem0 estável — persiste entre dias e sessões. */
export function mem0UserIdSuperagenteInterno(params: {
  tenantId: string;
  agenteSlug: string;
  telefoneSessao?: string | null;
  usuarioCrmId?: string | null;
}): string {
  const base = `sa:${params.tenantId.trim()}:${params.agenteSlug.trim()}`;
  const tel = params.telefoneSessao?.replace(/\D/g, "").slice(-15);
  if (tel && tel.length >= 10) return `${base}:g:${tel}`;
  const uid = params.usuarioCrmId?.trim();
  if (uid) return `${base}:crm:${uid}`;
  return base;
}

function origemMemoriaPorCanal(canal: SuperagenteCanalInterno): MemoriaAgenteOrigem {
  if (canal === "whatsapp_gestor") return "gestor_whatsapp";
  if (canal === "ciclo_programado") return "briefing";
  return "briefing";
}

export async function montarBlocoMemoriaSuperagenteInterno(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    agenteSlug: string;
    mensagemUsuario: string;
    telefoneSessao?: string | null;
    usuarioCrmId?: string | null;
    usoFerramentas?: Record<string, boolean> | null;
  }
): Promise<string> {
  const partes: string[] = [];

  try {
    const hub = await listarMemoriasAgente(supabase, params.agenteSlug, LIMITE_HUB_MEMORIAS);
    const blocoHub = formatarBlocoMemoriasAgente(hub);
    if (blocoHub) partes.push(blocoHub);
  } catch {
    /* tabela opcional */
  }

  if (!mem0PlataformaConfigurada() || !mem0SuperMemoriaAtiva(params.usoFerramentas)) {
    return partes.join("\n\n");
  }

  const apiKey = await resolverMem0ApiKey(supabase, params.tenantId);
  if (!apiKey) return partes.join("\n\n");

  const userId = mem0UserIdSuperagenteInterno(params);
  const query =
    params.mensagemUsuario.trim().slice(0, 400) ||
    "preferências do gestor relatórios decisões contexto operacional";

  const search = await mem0SearchMemories({
    apiKey,
    query,
    userId,
    agentId: params.agenteSlug,
    limit: LIMITE_MEM0_HITS,
  });

  if (search.ok && search.hits.length) {
    const blocoMem0 = formatarBlocoMem0SuperMemoria(search.hits);
    if (blocoMem0) partes.push(blocoMem0);
  }

  return partes.join("\n\n");
}

/** Grava turno em hub_memorias_agente + Mem0 (memória de dias). */
export async function persistirMemoriaSuperagenteInterno(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    agenteSlug: string;
    mensagemUsuario: string;
    respostaIA: string;
    telefoneSessao?: string | null;
    usuarioCrmId?: string | null;
    canalInterno: SuperagenteCanalInterno;
    usoFerramentas?: Record<string, boolean> | null;
  }
): Promise<void> {
  const origem = origemMemoriaPorCanal(params.canalInterno);

  try {
    await extrairESalvarMemoriasAgente(supabase, {
      agenteSlug: params.agenteSlug,
      tenantId: params.tenantId,
      mensagemUsuario: params.mensagemUsuario,
      respostaIA: params.respostaIA,
      origem,
    });
  } catch {
    /* opcional */
  }

  if (!mem0SuperMemoriaAtiva(params.usoFerramentas)) return;

  const apiKey = await resolverMem0ApiKey(supabase, params.tenantId);
  if (!apiKey) return;

  const userId = mem0UserIdSuperagenteInterno(params);
  const add = await mem0AddConversation({
    apiKey,
    userId,
    agentId: params.agenteSlug,
    messages: [
      { role: "user", content: params.mensagemUsuario },
      { role: "assistant", content: params.respostaIA },
    ],
    metadata: {
      tenant_id: params.tenantId,
      canal: params.canalInterno,
      ...(params.telefoneSessao?.trim()
        ? { telefone: params.telefoneSessao.replace(/\D/g, "").slice(0, 15) }
        : {}),
      ...(params.usuarioCrmId?.trim() ? { usuario_crm_id: params.usuarioCrmId.trim() } : {}),
    },
  });

  if (!add.ok) {
    console.warn("[MEM0] superagente interno:", add.erro);
  }
}
