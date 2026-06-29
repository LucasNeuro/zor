import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";
import {
  buscarLinhaGestorPorInstancia,
  buscarLinhaGestorPorToken,
  validarLinhaGestorRow,
} from "@/lib/whatsapp/gestor-linha-db";

export type LinhaWhatsAppEscopo = "externo" | "gestor";

export type LinhaWhatsAppWebhook =
  | {
      kind: "agent_instance";
      agenteSlug: string;
      instanceToken: string;
      tenantId: string;
    }
  | {
      kind: "gestor_instance";
      instanceToken: string;
      tenantId: string;
    }
  | { kind: "legacy_global_token" }
  | { kind: "ignored"; reason: string };

type AgenteWaRow = {
  agente_slug?: string;
  modo_operacao?: string | null;
  uazapi_instance_token?: string | null;
  uazapi_connection_status?: string | null;
  tenant_id?: string | null;
  ativo?: boolean | null;
  arquivado_em?: string | null;
};

const AGENTE_WA_SELECT =
  "agente_slug, modo_operacao, uazapi_instance_token, uazapi_connection_status, tenant_id, ativo, arquivado_em";

const WA_LIVE_STATUSES = new Set(["connected", "connecting", "open", "online"]);

export { WA_LIVE_STATUSES };

/** Em produção, não adivinhar instância sem token/id explícito (evita vazamento multi-tenant). */
function webhookResolverEstrito(): boolean {
  const raw = process.env.WEBHOOK_STRICT_INSTANCE_RESOLVE?.trim().toLowerCase();
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return process.env.NODE_ENV === "production";
}

function legacyGlobalTokenPermitido(): boolean {
  const raw = process.env.WEBHOOK_ALLOW_LEGACY_GLOBAL_TOKEN?.trim().toLowerCase();
  if (raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/** Valida agente para webhook inbound — não filtra por DEFAULT_TENANT_ID do servidor. */
export function validarAgenteWaRowForWebhook(r: AgenteWaRow): LinhaWhatsAppWebhook | null {
  if (r.arquivado_em != null || r.ativo === false) {
    return { kind: "ignored", reason: "agente_inativo_ou_arquivado" };
  }

  if (r.modo_operacao !== "canal_whatsapp") {
    return { kind: "ignored", reason: "agente_nao_modo_canal_whatsapp" };
  }

  const token = typeof r.uazapi_instance_token === "string" ? r.uazapi_instance_token.trim() : "";
  const status = (typeof r.uazapi_connection_status === "string" ? r.uazapi_connection_status.trim() : "").toLowerCase();

  if (!token) {
    return { kind: "ignored", reason: "instancia_sem_token_em_hub" };
  }

  if (!WA_LIVE_STATUSES.has(status)) {
    return { kind: "ignored", reason: "whatsapp_nao_conectado" };
  }

  const slug = typeof r.agente_slug === "string" ? r.agente_slug.trim() : "";
  if (!slug) {
    return { kind: "ignored", reason: "slug_agente_invalido" };
  }

  const tenantId =
    typeof r.tenant_id === "string" && r.tenant_id.trim() ? r.tenant_id.trim() : defaultTenantId();

  return { kind: "agent_instance", agenteSlug: slug, instanceToken: token, tenantId };
}

async function resolverPorLinhaHub(
  supabase: SupabaseClient,
  row: AgenteWaRow | null,
  notFoundReason: string
): Promise<LinhaWhatsAppWebhook> {
  if (!row) return { kind: "ignored", reason: notFoundReason };
  const validated = validarAgenteWaRowForWebhook(row);
  return validated ?? { kind: "ignored", reason: "agente_validacao_falhou" };
}

async function resolverUnicoAgenteWhatsappConectado(
  supabase: SupabaseClient
): Promise<LinhaWhatsAppWebhook | null> {
  const { data: rows, error } = await supabase
    .from("hub_agente_identidade")
    .select(AGENTE_WA_SELECT)
    .eq("modo_operacao", "canal_whatsapp")
    .in("uazapi_connection_status", [...WA_LIVE_STATUSES])
    .eq("ativo", true);

  if (error || !rows?.length) return null;

  const candidates = (rows as AgenteWaRow[])
    .map((r) => validarAgenteWaRowForWebhook(r))
    .filter((v): v is Extract<LinhaWhatsAppWebhook, { kind: "agent_instance" }> => v?.kind === "agent_instance");

  if (candidates.length !== 1) return null;

  return candidates[0]!;
}

/**
 * Por mensagem inbound: identifica agente por uazapi_instance_id, token da instância no payload,
 * único agente WhatsApp connected, ou fallback legacy `UAZAPI_INSTANCE_TOKEN`.
 */
export async function resolverLinhaWhatsAppInbound(
  supabase: SupabaseClient,
  instanceId: string | undefined | null,
  opts?: {
    instanceToken?: string | null;
    instanceName?: string | null;
    /** externo = só agentes canal_whatsapp; gestor = só linha empresário */
    escopo?: LinhaWhatsAppEscopo;
  }
): Promise<LinhaWhatsAppWebhook> {
  const escopo = opts?.escopo ?? "externo";
  const id = instanceId?.trim() || "";
  const tokenIn = opts?.instanceToken?.trim() || "";
  const nameIn = opts?.instanceName?.trim() || "";

  if (escopo === "gestor") {
    if (id) {
      const gestorById = await buscarLinhaGestorPorInstancia(supabase, id);
      if (gestorById) {
        const v = validarLinhaGestorRow(gestorById);
        if (v.ok) {
          return { kind: "gestor_instance", tenantId: v.tenantId, instanceToken: v.instanceToken };
        }
        return { kind: "ignored", reason: v.reason };
      }
    }
    if (tokenIn) {
      const gestorByToken = await buscarLinhaGestorPorToken(supabase, tokenIn);
      if (gestorByToken) {
        const v = validarLinhaGestorRow(gestorByToken);
        if (v.ok) {
          return { kind: "gestor_instance", tenantId: v.tenantId, instanceToken: v.instanceToken };
        }
        return { kind: "ignored", reason: v.reason };
      }
    }
    if (nameIn) {
      const { data: byName } = await supabase
        .from("hub_linha_gestor_whatsapp")
        .select("tenant_id, uazapi_instance_id, uazapi_instance_token, uazapi_instance_name, uazapi_connection_status, ativo, telefones_autorizados")
        .eq("uazapi_instance_name", nameIn)
        .maybeSingle();
      if (byName) {
        const v = validarLinhaGestorRow(byName as import("@/lib/whatsapp/gestor-linha-db").LinhaGestorWhatsappRow);
        if (v.ok) {
          return { kind: "gestor_instance", tenantId: v.tenantId, instanceToken: v.instanceToken };
        }
        return { kind: "ignored", reason: v.reason };
      }
    }
    return { kind: "ignored", reason: "gestor_instancia_desconhecida" };
  }

  if (nameIn && escopo === "externo") {
    const { data: byName, error: nameErr } = await supabase
      .from("hub_agente_identidade")
      .select(AGENTE_WA_SELECT)
      .eq("uazapi_instance_name", nameIn)
      .maybeSingle();

    if (nameErr) {
      console.warn("[WEBHOOK] resolver linha WhatsApp (instanceName):", nameErr.message);
    } else {
      const byNameResolved = await resolverPorLinhaHub(
        supabase,
        byName as AgenteWaRow | null,
        "instancia_sem_agente_hub"
      );
      if (byNameResolved.kind !== "ignored" || byNameResolved.reason !== "instancia_sem_agente_hub") {
        return byNameResolved;
      }
    }
  }

  if (id) {
    if (escopo === "externo") {
      const { data: row, error } = await supabase
        .from("hub_agente_identidade")
        .select(AGENTE_WA_SELECT)
        .eq("uazapi_instance_id", id)
        .maybeSingle();

      if (error) {
        console.warn("[WEBHOOK] resolver linha WhatsApp (id):", error.message);
        return { kind: "ignored", reason: "erro_bd_resolver_instancia" };
      }

      const resolved = await resolverPorLinhaHub(supabase, row as AgenteWaRow | null, "instancia_sem_agente_hub");
      if (resolved.kind !== "ignored" || resolved.reason !== "instancia_sem_agente_hub") {
        return resolved;
      }

      const { data: byName, error: nameErr } = await supabase
        .from("hub_agente_identidade")
        .select(AGENTE_WA_SELECT)
        .eq("uazapi_instance_name", id)
        .maybeSingle();

      if (nameErr) {
        console.warn("[WEBHOOK] resolver linha WhatsApp (nome):", nameErr.message);
      } else {
        const byNameResolved = await resolverPorLinhaHub(supabase, byName as AgenteWaRow | null, "instancia_sem_agente_hub");
        if (byNameResolved.kind !== "ignored" || byNameResolved.reason !== "instancia_sem_agente_hub") {
          return byNameResolved;
        }
      }
    }
  }

  if (tokenIn && escopo === "externo") {
    const { data: row, error } = await supabase
      .from("hub_agente_identidade")
      .select(AGENTE_WA_SELECT)
      .eq("uazapi_instance_token", tokenIn)
      .maybeSingle();

    if (error) {
      console.warn("[WEBHOOK] resolver linha WhatsApp (token):", error.message);
      return { kind: "ignored", reason: "erro_bd_resolver_token" };
    }

    const resolved = await resolverPorLinhaHub(supabase, row as AgenteWaRow | null, "token_sem_agente_hub");
    if (resolved.kind !== "ignored" || resolved.reason !== "token_sem_agente_hub") {
      return resolved;
    }
  }

  if (!webhookResolverEstrito()) {
    const unico = await resolverUnicoAgenteWhatsappConectado(supabase);
    if (unico) return unico;

    const legacy = process.env.UAZAPI_INSTANCE_TOKEN?.trim() || "";
    if (legacyGlobalTokenPermitido() && legacy && (!tokenIn || tokenIn === legacy)) {
      return { kind: "legacy_global_token" };
    }
  }

  return { kind: "ignored", reason: "instancia_desconhecida_sem_fallback_global" };
}
