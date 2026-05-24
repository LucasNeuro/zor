import type { SupabaseClient } from "@supabase/supabase-js";

export type ActorCrm = {
  id?: string | null;
  email?: string | null;
  nome?: string | null;
};

export function actorFromRequestHeaders(headers: Headers): ActorCrm {
  return {
    id: headers.get("x-user-id")?.trim() || null,
    email: headers.get("x-user-email")?.trim() || null,
    nome: headers.get("x-user-name")?.trim() || null,
  };
}

/** Regista exclusão (ou outra operação) em hub_auditoria_seguranca — falha silenciosa se tabela ausente. */
export async function registrarAuditoriaCrm(
  supabase: SupabaseClient,
  params: {
    tabela: string;
    operacao: "ler" | "inserir" | "atualizar" | "deletar";
    motivo: string;
    actor?: ActorCrm;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const actor = params.actor ?? {};
  const meta = {
    ...params.metadata,
    deletado_por_id: actor.id ?? null,
    deletado_por_email: actor.email ?? null,
    deletado_por_nome: actor.nome ?? null,
  };

  try {
    await supabase.from("hub_auditoria_seguranca").insert({
      origem: "humano",
      tabela: params.tabela,
      operacao: params.operacao,
      motivo: params.motivo,
      metadata: meta,
    });
  } catch {
    /* tabela opcional em alguns ambientes */
  }
}
