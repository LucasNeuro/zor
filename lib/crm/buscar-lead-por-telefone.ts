import type { SupabaseClient } from "@supabase/supabase-js";
import { telefoneConversaId, telefonesConversaEquivalentes } from "@/lib/crm/isolamento-conversa-lead";
import { isMissingPgColumn } from "@/lib/tenant-default";

function suffixBrasil(tel: string): string {
  const d = telefoneConversaId(tel);
  return d.length >= 12 ? d.slice(-11) : d;
}

/** Busca lead existente pelo telefone (identificador único da conversa WA). Preferência: mais recente contacto. */
export async function buscarLeadPorTelefoneWhatsapp(
  supabase: SupabaseClient,
  telefone: string,
  tenantId: string
): Promise<{ lead: Record<string, unknown> | null; duplicatas: number }> {
  const tel = telefoneConversaId(telefone);
  if (tel.length < 10) return { lead: null, duplicatas: 0 };

  const sufixo = suffixBrasil(tel);

  const runQuery = async (withTenant: boolean) => {
    let q = supabase
      .from("hub_leads_crm")
      .select("*")
      .not("telefone", "is", null)
      .order("ultimo_contato", { ascending: false, nullsFirst: false })
      .order("atualizado_em", { ascending: false })
      .limit(20);
    if (withTenant && tenantId) q = q.eq("tenant_id", tenantId);
    return q;
  };

  let res = await runQuery(true);
  if (res.error && isMissingPgColumn(res.error, "tenant_id")) {
    res = await runQuery(false);
  }
  if (res.error) {
    console.warn("[CRM][buscar-lead-telefone]", res.error.message);
    return { lead: null, duplicatas: 0 };
  }

  const candidatos = (res.data ?? []).filter((row) => {
    const t = typeof row.telefone === "string" ? row.telefone : "";
    return telefonesConversaEquivalentes(tel, t) || telefoneConversaId(t).endsWith(sufixo);
  }) as Record<string, unknown>[];

  if (candidatos.length === 0) return { lead: null, duplicatas: 0 };

  if (candidatos.length > 1) {
    console.warn("[CRM][buscar-lead-telefone] duplicatas telefone", {
      telefone: `***${tel.slice(-4)}`,
      count: candidatos.length,
      ids: candidatos.slice(0, 5).map((r) => r.id),
    });
  }

  return { lead: candidatos[0] ?? null, duplicatas: candidatos.length };
}
