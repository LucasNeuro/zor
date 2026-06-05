import type { NextRequest } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";

export type AuditoriaActor = {
  id: string;
  auth_id: string | null;
  name: string | null;
  email: string | null;
  tenant_id: string | null;
};

export async function getAuditoriaActor(request: NextRequest): Promise<AuditoriaActor | null> {
  const authId = request.headers.get("x-caller-auth-id")?.trim();
  if (!authId) return null;

  const { data, error } = await crmDb()
    .from("users")
    .select("id, auth_id, name, email, tenant_id")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error || !data) return null;
  return data as AuditoriaActor;
}

export async function logAuditoriaSistema(input: {
  tenantId: string;
  actor: AuditoriaActor | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  resumo: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await crmDb().from("hub_auditoria_sistema").insert({
      tenant_id: input.tenantId,
      actor_user_id: input.actor?.id ?? null,
      actor_auth_id: input.actor?.auth_id ?? null,
      actor_nome: input.actor?.name ?? null,
      actor_email: input.actor?.email ?? null,
      acao: input.acao,
      entidade: input.entidade,
      entidade_id: input.entidadeId ?? null,
      resumo: input.resumo.slice(0, 500),
      metadata: input.metadata ?? {},
    });
  } catch {
    // Tabela pode ainda não existir em bases sem migration aplicada.
  }
}
