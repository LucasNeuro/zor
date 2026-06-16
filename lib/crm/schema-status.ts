import type { SupabaseClient } from "@supabase/supabase-js";

export const WAJE_BOOTSTRAP_SQL = "docs/sql/waje-bootstrap-prioridade.sql";
export const CATALOGO_RPC_SQL = "docs/sql/hub-upsert-servicos-catalogo-rpc.sql";

export const CATALOGO_BOOTSTRAP_HINT =
  "Catálogo ainda não existe no Supabase. Execute docs/sql/waje-bootstrap-prioridade.sql no SQL Editor e recarregue o schema (Settings → API → Reload schema).";

export const CATALOGO_RPC_HINT =
  "RPC hub_upsert_servicos_catalogo_batch ausente ou schema desatualizado. Execute docs/sql/hub-upsert-servicos-catalogo-rpc.sql (ou o bootstrap completo) e recarregue o schema (Settings → API → Reload schema).";

export function isCatalogoSchemaMissingError(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    (msg.includes("could not find the table") && msg.includes("hub_tenant_servicos_catalogo")) ||
    (msg.includes("does not exist") && msg.includes("hub_tenant_servicos_catalogo")) ||
    (msg.includes("relation") && msg.includes("hub_tenant_servicos_catalogo"))
  );
}

export function isRpcCatalogoUnavailableError(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    (msg.includes("could not find the function") && msg.includes("hub_upsert_servicos_catalogo_batch")) ||
    (msg.includes("does not exist") && msg.includes("hub_upsert_servicos_catalogo_batch"))
  );
}

export function mensagemErroCatalogo(message: string): string {
  if (isCatalogoSchemaMissingError(message)) return CATALOGO_BOOTSTRAP_HINT;
  if (isRpcCatalogoUnavailableError(message)) return CATALOGO_RPC_HINT;
  return message;
}

export type SchemaCheckItem = {
  id: string;
  label: string;
  ok: boolean;
  detalhe?: string;
};

export type CrmSchemaStatus = {
  pronto: boolean;
  bootstrap: string;
  itens: SchemaCheckItem[];
};

async function probeTable(supabase: SupabaseClient, table: string): Promise<boolean> {
  const { error } = await supabase.from(table).select("id").limit(1);
  if (!error) return true;
  const msg = (error.message || "").toLowerCase();
  return !(
    msg.includes("could not find the table") ||
    (msg.includes("does not exist") && msg.includes("relation"))
  );
}

async function probeRpc(supabase: SupabaseClient): Promise<boolean> {
  const { error } = await supabase.rpc("hub_upsert_servicos_catalogo_batch", {
    p_tenant_id: "00000000-0000-0000-0000-000000000000",
    p_itens: [],
  });
  if (!error) return true;
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("could not find the function") || msg.includes("does not exist")) {
    return false;
  }
  return true;
}

/** Verifica tabelas/views/RPC necessárias para catálogo, negócios e financeiro Waje. */
export async function verificarSchemaCrmWaje(supabase: SupabaseClient): Promise<CrmSchemaStatus> {
  const checks: { id: string; label: string; table?: string; rpc?: boolean }[] = [
    { id: "hub_contas_receber", label: "Contas a receber", table: "hub_contas_receber" },
    { id: "hub_contas_pagar", label: "Contas a pagar", table: "hub_contas_pagar" },
    { id: "hub_tenant_servicos_catalogo", label: "Catálogo de serviços", table: "hub_tenant_servicos_catalogo" },
    { id: "vw_rel_fluxo_caixa", label: "View fluxo de caixa", table: "vw_rel_fluxo_caixa" },
    { id: "vw_rel_contas_receber", label: "View contas a receber", table: "vw_rel_contas_receber" },
    { id: "vw_rel_contas_pagar", label: "View contas a pagar", table: "vw_rel_contas_pagar" },
    { id: "hub_upsert_servicos_catalogo_batch", label: "RPC sync catálogo", rpc: true },
  ];

  const itens: SchemaCheckItem[] = [];

  for (const c of checks) {
    if (c.rpc) {
      const ok = await probeRpc(supabase);
      itens.push({
        id: c.id,
        label: c.label,
        ok,
        ...(!ok ? { detalhe: "Função RPC ausente (sync usa fallback se a tabela existir)" } : {}),
      });
      continue;
    }
    const ok = await probeTable(supabase, c.table!);
    itens.push({
      id: c.id,
      label: c.label,
      ok,
      ...(!ok ? { detalhe: `Tabela/view ${c.table} ausente` } : {}),
    });
  }

  return {
    pronto: itens.every((i) => i.ok),
    bootstrap: WAJE_BOOTSTRAP_SQL,
    itens,
  };
}
