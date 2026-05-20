import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";

export type LinhaWhatsAppWebhook =
  | {
      kind: "agent_instance";
      agenteSlug: string;
      instanceToken: string;
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

function validarAgenteWaRow(r: AgenteWaRow, tid: string): LinhaWhatsAppWebhook | null {
  if (r.arquivado_em != null || r.ativo === false) {
    return { kind: "ignored", reason: "agente_inativo_ou_arquivado" };
  }

  if (r.modo_operacao !== "canal_whatsapp") {
    return { kind: "ignored", reason: "agente_nao_modo_canal_whatsapp" };
  }

  const agentTenant = typeof r.tenant_id === "string" ? r.tenant_id : null;
  if (agentTenant && agentTenant !== tid) {
    return { kind: "ignored", reason: "tenant_instancia_incompativel" };
  }

  const token = typeof r.uazapi_instance_token === "string" ? r.uazapi_instance_token.trim() : "";
  const status = typeof r.uazapi_connection_status === "string" ? r.uazapi_connection_status.trim() : "";

  if (!token) {
    return { kind: "ignored", reason: "instancia_sem_token_em_hub" };
  }

  if (status !== "connected") {
    return { kind: "ignored", reason: "whatsapp_nao_conectado" };
  }

  const slug = typeof r.agente_slug === "string" ? r.agente_slug.trim() : "";
  if (!slug) {
    return { kind: "ignored", reason: "slug_agente_invalido" };
  }

  return { kind: "agent_instance", agenteSlug: slug, instanceToken: token };
}

async function resolverPorLinhaHub(
  supabase: SupabaseClient,
  row: AgenteWaRow | null,
  notFoundReason: string
): Promise<LinhaWhatsAppWebhook> {
  if (!row) return { kind: "ignored", reason: notFoundReason };
  const tid = defaultTenantId();
  const validated = validarAgenteWaRow(row, tid);
  return validated ?? { kind: "ignored", reason: "agente_validacao_falhou" };
}

async function resolverUnicoAgenteWhatsappConectado(
  supabase: SupabaseClient
): Promise<LinhaWhatsAppWebhook | null> {
  const tid = defaultTenantId();
  const { data: rows, error } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, modo_operacao, uazapi_instance_token, uazapi_connection_status, tenant_id, ativo, arquivado_em"
    )
    .eq("modo_operacao", "canal_whatsapp")
    .eq("uazapi_connection_status", "connected")
    .eq("ativo", true)
    .is("arquivado_em", null);

  if (error || !rows?.length) return null;

  const noTenant = (rows as AgenteWaRow[]).filter((r) => {
    const t = typeof r.tenant_id === "string" ? r.tenant_id : null;
    return !t || t === tid;
  });

  if (noTenant.length !== 1) return null;

  const validated = validarAgenteWaRow(noTenant[0]!, tid);
  return validated?.kind === "agent_instance" ? validated : null;
}

/**
 * Por mensagem inbound: identifica agente por uazapi_instance_id, token da instância no payload,
 * único agente WhatsApp connected, ou fallback legacy `UAZAPI_INSTANCE_TOKEN`.
 */
export async function resolverLinhaWhatsAppInbound(
  supabase: SupabaseClient,
  instanceId: string | undefined | null,
  opts?: { instanceToken?: string | null; instanceName?: string | null }
): Promise<LinhaWhatsAppWebhook> {
  const id = instanceId?.trim() || "";
  const tokenIn = opts?.instanceToken?.trim() || "";
  const nameIn = opts?.instanceName?.trim() || "";

  if (nameIn) {
    const { data: byName, error: nameErr } = await supabase
      .from("hub_agente_identidade")
      .select(
        "agente_slug, modo_operacao, uazapi_instance_token, uazapi_connection_status, tenant_id, ativo, arquivado_em"
      )
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
    const { data: row, error } = await supabase
      .from("hub_agente_identidade")
      .select(
        "agente_slug, modo_operacao, uazapi_instance_token, uazapi_connection_status, tenant_id, ativo, arquivado_em"
      )
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
      .select(
        "agente_slug, modo_operacao, uazapi_instance_token, uazapi_connection_status, tenant_id, ativo, arquivado_em"
      )
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

  if (tokenIn) {
    const { data: row, error } = await supabase
      .from("hub_agente_identidade")
      .select(
        "agente_slug, modo_operacao, uazapi_instance_token, uazapi_connection_status, tenant_id, ativo, arquivado_em"
      )
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

  const unico = await resolverUnicoAgenteWhatsappConectado(supabase);
  if (unico) return unico;

  const legacy = process.env.UAZAPI_INSTANCE_TOKEN?.trim() || "";
  if (legacy && (!tokenIn || tokenIn === legacy)) {
    return { kind: "legacy_global_token" };
  }

  return { kind: "ignored", reason: "instancia_desconhecida_sem_fallback_global" };
}
