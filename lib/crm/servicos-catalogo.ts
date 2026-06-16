import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseAnaliseCacheFromSettings,
  type TenantConhecimentoAnaliseNegocio,
} from "@/lib/hub/tenant-conhecimento-rag";
import { extrairServicosCatalogoViaIa } from "@/lib/crm/servicos-catalogo-ia";
import {
  CATALOGO_BOOTSTRAP_HINT,
  isCatalogoSchemaMissingError,
  isRpcCatalogoUnavailableError,
} from "@/lib/crm/schema-status";

export type ServicoCatalogoRow = {
  id: string;
  tenant_id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  preco_referencia: number | null;
  moeda: string;
  tipo: string;
  origem: string;
  ativo: boolean;
  ordem: number;
};

export type ServicoCatalogoItemInput = {
  nome: string;
  descricao?: string | null;
  preco_referencia?: number | null;
  ordem?: number;
  origem?: string;
  metadata?: Record<string, unknown>;
};

export function itensCatalogoFromAnalise(
  analise: TenantConhecimentoAnaliseNegocio
): ServicoCatalogoItemInput[] {
  const seen = new Set<string>();
  const itens: ServicoCatalogoItemInput[] = [];
  let ordem = 0;
  for (const nome of analise.produtos_servicos) {
    const key = nome.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    itens.push({ nome: nome.trim(), origem: "conhecimento_ia", ordem: ordem++ });
  }
  return itens;
}

export async function carregarAnaliseConhecimentoTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantConhecimentoAnaliseNegocio | null> {
  const { data, error } = await supabase
    .from("hub_tenants")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !data) return null;
  const cache = parseAnaliseCacheFromSettings(data.settings);
  return cache?.analise ?? null;
}

export async function listarServicosCatalogo(
  supabase: SupabaseClient,
  tenantId: string,
  opts?: { incluirInativos?: boolean }
): Promise<ServicoCatalogoRow[]> {
  let query = supabase
    .from("hub_tenant_servicos_catalogo")
    .select(
      "id, tenant_id, slug, nome, descricao, preco_referencia, moeda, tipo, origem, ativo, ordem"
    )
    .eq("tenant_id", tenantId)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (!opts?.incluirInativos) {
    query = query.eq("ativo", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ServicoCatalogoRow[];
}

/** Replica a lógica de slug da função SQL hub_upsert_servicos_catalogo_batch. */
export function slugFromNomeCatalogo(nome: string): string {
  const trimmed = nome.trim();
  let slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    slug = `item-${createHash("md5").update(trimmed).digest("hex").slice(0, 8)}`;
  }
  return slug;
}

function parsePrecoReferencia(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return value;
}

async function upsertServicosCatalogoBatchFallback(
  supabase: SupabaseClient,
  tenantId: string,
  itens: ServicoCatalogoItemInput[]
): Promise<{ inseridos: number; atualizados: number; total: number }> {
  const { data: existentes, error: loadError } = await supabase
    .from("hub_tenant_servicos_catalogo")
    .select("slug")
    .eq("tenant_id", tenantId);

  if (loadError) {
    if (isCatalogoSchemaMissingError(loadError.message)) {
      throw new Error(CATALOGO_BOOTSTRAP_HINT);
    }
    throw new Error(loadError.message);
  }

  const slugsExistentes = new Set((existentes ?? []).map((row) => String(row.slug)));
  let inseridos = 0;
  let atualizados = 0;
  const slugs: string[] = [];

  for (const item of itens) {
    const nome = item.nome.trim();
    if (!nome) continue;

    const slug = slugFromNomeCatalogo(nome);
    slugs.push(slug);
    const row = {
      tenant_id: tenantId,
      slug,
      nome,
      descricao: item.descricao?.trim() || null,
      preco_referencia: parsePrecoReferencia(item.preco_referencia),
      origem: item.origem?.trim() || "conhecimento_ia",
      ativo: true,
      ordem: item.ordem ?? 0,
      metadata: item.metadata ?? {},
    };

    const { error } = await supabase
      .from("hub_tenant_servicos_catalogo")
      .upsert(row, { onConflict: "tenant_id,slug" });

    if (error) {
      if (isCatalogoSchemaMissingError(error.message)) {
        throw new Error(CATALOGO_BOOTSTRAP_HINT);
      }
      throw new Error(error.message);
    }

    if (slugsExistentes.has(slug)) {
      atualizados += 1;
    } else {
      inseridos += 1;
      slugsExistentes.add(slug);
    }
  }

  if (slugs.length) {
    await supabase.from("hub_tenant_servicos_catalogo_sync").insert({
      tenant_id: tenantId,
      itens_inseridos: inseridos,
      itens_atualizados: atualizados,
      metadata: { slugs, fallback: true },
    });
  }

  return { inseridos, atualizados, total: inseridos + atualizados };
}

async function upsertServicosCatalogoBatch(
  supabase: SupabaseClient,
  tenantId: string,
  itens: ServicoCatalogoItemInput[]
): Promise<{ inseridos: number; atualizados: number; total: number }> {
  const { data, error } = await supabase.rpc("hub_upsert_servicos_catalogo_batch", {
    p_tenant_id: tenantId,
    p_itens: itens,
  });

  if (!error) {
    const payload = (data ?? {}) as {
      inseridos?: number;
      atualizados?: number;
      total?: number;
    };
    return {
      inseridos: Number(payload.inseridos ?? 0),
      atualizados: Number(payload.atualizados ?? 0),
      total: Number(payload.total ?? itens.length),
    };
  }

  if (isRpcCatalogoUnavailableError(error.message)) {
    return upsertServicosCatalogoBatchFallback(supabase, tenantId, itens);
  }

  if (isCatalogoSchemaMissingError(error.message)) {
    throw new Error(CATALOGO_BOOTSTRAP_HINT);
  }

  throw new Error(error.message);
}

export async function sincronizarServicosFromConhecimento(
  supabase: SupabaseClient,
  tenantId: string,
  opts?: { usarIa?: boolean }
): Promise<{ inseridos: number; atualizados: number; total: number; itens: number }> {
  const usarIa = opts?.usarIa !== false;
  let itens: ServicoCatalogoItemInput[] = [];

  if (usarIa) {
    try {
      itens = await extrairServicosCatalogoViaIa(supabase, tenantId);
    } catch {
      itens = [];
    }
  }

  if (!itens.length) {
    const analise = await carregarAnaliseConhecimentoTenant(supabase, tenantId);
    if (!analise?.produtos_servicos?.length) {
      return { inseridos: 0, atualizados: 0, total: 0, itens: 0 };
    }
    itens = itensCatalogoFromAnalise(analise);
  }

  const result = await upsertServicosCatalogoBatch(supabase, tenantId, itens);

  return {
    ...result,
    itens: itens.length,
  };
}

export async function resolverServicoCatalogoParaNegocio(
  supabase: SupabaseClient,
  tenantId: string,
  servicoCatalogoId: string | null | undefined
): Promise<ServicoCatalogoRow | null> {
  const id = String(servicoCatalogoId || "").trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from("hub_tenant_servicos_catalogo")
    .select(
      "id, tenant_id, slug, nome, descricao, preco_referencia, moeda, tipo, origem, ativo, ordem"
    )
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ServicoCatalogoRow | null) ?? null;
}

/** Sincroniza catálogo após indexar documentos ou regenerar análise (não bloqueia o fluxo principal). */
export async function propagarCatalogoAposConhecimento(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ ok: boolean; inseridos?: number; atualizados?: number; itens?: number; erro?: string }> {
  try {
    const result = await sincronizarServicosFromConhecimento(supabase, tenantId, { usarIa: true });
    return {
      ok: true,
      inseridos: result.inseridos,
      atualizados: result.atualizados,
      itens: result.itens,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro_sync_catalogo";
    if (message === CATALOGO_BOOTSTRAP_HINT) {
      return { ok: false, erro: message };
    }
    if (isCatalogoSchemaMissingError(message) || isRpcCatalogoUnavailableError(message)) {
      return { ok: false, erro: CATALOGO_BOOTSTRAP_HINT };
    }
    return { ok: false, erro: message };
  }
}
