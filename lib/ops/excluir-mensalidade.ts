import { crmDb } from "@/lib/crm/supabase-server";
import { OPS_BOLETOS_BUCKET } from "@/lib/ops/ops-boleto-storage";

export type MensalidadeParaExcluir = {
  id: string;
  tenant_id: string;
  status: string;
  cora_invoice_id?: string | null;
  boleto_storage_path?: string | null;
};

export function mensalidadePodeExcluir(pag: {
  status: string;
  cora_invoice_id?: string | null;
}): boolean {
  if (pag.status === "pago") return false;
  if (pag.cora_invoice_id) return false;
  return true;
}

async function removerPdfStorage(path: string | null | undefined) {
  if (!path?.trim()) return;
  await crmDb().storage.from(OPS_BOLETOS_BUCKET).remove([path.trim()]);
}

export async function excluirMensalidadeOps(pagamentoId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: pag, error: readErr } = await crmDb()
    .from("hub_tenant_mensalidades")
    .select("id, tenant_id, status, cora_invoice_id, boleto_storage_path")
    .eq("id", pagamentoId)
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };
  if (!pag) return { ok: false, error: "Cobrança não encontrada." };
  if (!mensalidadePodeExcluir(pag)) {
    return {
      ok: false,
      error: pag.status === "pago"
        ? "Cobrança paga não pode ser apagada."
        : "Cancele a cobrança emitida antes de apagar o registo.",
    };
  }

  await removerPdfStorage(pag.boleto_storage_path);

  const { error: delErr } = await crmDb().from("hub_tenant_mensalidades").delete().eq("id", pag.id);
  if (delErr) return { ok: false, error: delErr.message };

  return { ok: true };
}

export async function excluirMensalidadesSemEmissaoTenant(tenantId: string): Promise<{
  apagadas: number;
  ids: string[];
}> {
  const { data: rows, error } = await crmDb()
    .from("hub_tenant_mensalidades")
    .select("id, status, cora_invoice_id, boleto_storage_path")
    .eq("tenant_id", tenantId)
    .is("cora_invoice_id", null)
    .neq("status", "pago");

  if (error) throw new Error(error.message);

  const elegiveis = (rows ?? []).filter((r) => mensalidadePodeExcluir(r));
  if (!elegiveis.length) return { apagadas: 0, ids: [] };

  const paths = elegiveis.map((r) => r.boleto_storage_path).filter(Boolean) as string[];
  if (paths.length) {
    await crmDb().storage.from(OPS_BOLETOS_BUCKET).remove(paths);
  }

  const ids = elegiveis.map((r) => r.id);
  const { error: delErr } = await crmDb().from("hub_tenant_mensalidades").delete().in("id", ids);
  if (delErr) throw new Error(delErr.message);

  return { apagadas: ids.length, ids };
}
