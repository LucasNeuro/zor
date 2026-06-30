import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";
import { telefonesConversaEquivalentes } from "@/lib/crm/isolamento-conversa-lead";
import { WA_LIVE_STATUSES } from "@/lib/whatsapp/resolver-linha-whatsapp";
import { normalizarTelefoneGestorLista } from "@/lib/whatsapp/gestor-telefones-format";

export type LinhaGestorWhatsappRow = {
  tenant_id: string;
  uazapi_instance_id?: string | null;
  uazapi_instance_token?: string | null;
  uazapi_instance_name?: string | null;
  uazapi_connection_status?: string | null;
  ativo?: boolean | null;
  telefones_autorizados?: unknown;
};

const GESTOR_SELECT =
  "tenant_id, uazapi_instance_id, uazapi_instance_token, uazapi_instance_name, uazapi_connection_status, ativo, telefones_autorizados";

export function telefonesAutorizadosGestor(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => normalizarTelefoneGestorLista(String(t ?? "")))
    .filter((t) => t.length >= 12);
}

export function gestorTelefoneAutorizado(telefone: string, autorizados: string[]): boolean {
  const tel = normalizarTelefoneGestorLista(telefone);
  if (tel.length < 12) return false;
  if (!autorizados.length) return false;
  return autorizados.some((a) => telefonesConversaEquivalentes(tel, a));
}

/** Telefone da sessão gestor a partir do chat fromMe (ex.: «mensagens para você»). */
export function resolverTelefoneGestorFromMe(
  destinoChat: string,
  autorizados: string[]
): string | null {
  const dest = normalizarTelefoneGestorLista(destinoChat);
  if (dest.length >= 12) {
    const match = autorizados.find((a) => telefonesConversaEquivalentes(dest, a));
    if (match) return match;
  }
  if (autorizados.length === 1) return autorizados[0]!;
  if (autorizados.length > 1 && dest.length >= 12) {
    return autorizados.find((a) => telefonesConversaEquivalentes(dest, a)) ?? null;
  }
  return autorizados[0] ?? null;
}

export function ehGestorChatInternoFromMe(destinoChat: string, autorizados: string[]): boolean {
  if (!autorizados.length) return false;
  const dest = normalizarTelefoneGestorLista(destinoChat);
  if (dest.length < 12) return autorizados.length === 1;
  return autorizados.some((a) => telefonesConversaEquivalentes(dest, a));
}

export function validarLinhaGestorRow(r: LinhaGestorWhatsappRow): {
  ok: true;
  tenantId: string;
  instanceToken: string;
} | { ok: false; reason: string } {
  if (r.ativo === false) return { ok: false, reason: "linha_gestor_inativa" };
  const token = typeof r.uazapi_instance_token === "string" ? r.uazapi_instance_token.trim() : "";
  const status = (
    typeof r.uazapi_connection_status === "string" ? r.uazapi_connection_status.trim() : ""
  ).toLowerCase();
  if (!token) return { ok: false, reason: "gestor_sem_token" };
  if (!WA_LIVE_STATUSES.has(status)) return { ok: false, reason: "gestor_whatsapp_nao_conectado" };
  const tenantId =
    typeof r.tenant_id === "string" && r.tenant_id.trim() ? r.tenant_id.trim() : defaultTenantId();
  return { ok: true, tenantId, instanceToken: token };
}

export async function buscarLinhaGestorPorInstancia(
  supabase: SupabaseClient,
  instanceId: string
): Promise<LinhaGestorWhatsappRow | null> {
  const id = instanceId.trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from("hub_linha_gestor_whatsapp")
    .select(GESTOR_SELECT)
    .eq("uazapi_instance_id", id)
    .maybeSingle();
  if (!error && data) return data as LinhaGestorWhatsappRow;

  const { data: byName } = await supabase
    .from("hub_linha_gestor_whatsapp")
    .select(GESTOR_SELECT)
    .eq("uazapi_instance_name", id)
    .maybeSingle();
  return (byName as LinhaGestorWhatsappRow | null) ?? null;
}

export async function buscarLinhaGestorPorToken(
  supabase: SupabaseClient,
  token: string
): Promise<LinhaGestorWhatsappRow | null> {
  const t = token.trim();
  if (!t) return null;
  const { data } = await supabase
    .from("hub_linha_gestor_whatsapp")
    .select(GESTOR_SELECT)
    .eq("uazapi_instance_token", t)
    .maybeSingle();
  return (data as LinhaGestorWhatsappRow | null) ?? null;
}

export async function buscarLinhaGestorPorTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<LinhaGestorWhatsappRow | null> {
  const { data } = await supabase
    .from("hub_linha_gestor_whatsapp")
    .select(GESTOR_SELECT)
    .eq("tenant_id", tenantId.trim() || defaultTenantId())
    .maybeSingle();
  return (data as LinhaGestorWhatsappRow | null) ?? null;
}
