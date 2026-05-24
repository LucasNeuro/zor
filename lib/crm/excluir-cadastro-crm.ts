import type { SupabaseClient } from "@supabase/supabase-js";

export type RpcDeleteResult = {
  ok: boolean;
  error?: string;
  id?: string;
  codigo?: string | null;
  nome?: string | null;
  razao_social?: string | null;
};

function parseRpcRow(data: unknown): RpcDeleteResult {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
  const row = data as Record<string, unknown>;
  return {
    ok: row.ok === true,
    error: typeof row.error === "string" ? row.error : undefined,
    id: typeof row.id === "string" ? row.id : undefined,
    codigo: row.codigo != null ? String(row.codigo) : null,
    nome: row.nome != null ? String(row.nome) : null,
    razao_social: row.razao_social != null ? String(row.razao_social) : null,
  };
}

function statusFromMessage(msg: string): number {
  if (msg.includes("não encontrad") || msg.includes("nao encontrad")) return 404;
  if (msg.includes("vinculad") || msg.includes("Não é possível excluir")) return 409;
  if (msg.includes("inválid")) return 400;
  if (
    msg.includes("delete_authorized") ||
    (msg.includes("function") && msg.includes("does not exist"))
  ) {
    return 503;
  }
  return 500;
}

/** Exclui contacto via RPC (SET LOCAL app.delete_authorized). */
export async function excluirPessoaCrm(
  supabase: SupabaseClient,
  pessoaId: string
): Promise<{ result: RpcDeleteResult; httpStatus: number }> {
  const { data, error } = await supabase.rpc("hub_delete_pessoa_crm", { p_id: pessoaId });

  if (error) {
    const msg = error.message || "Falha ao excluir contacto.";
    return { result: { ok: false, error: msg }, httpStatus: statusFromMessage(msg) };
  }

  const result = parseRpcRow(data);
  if (!result.ok) {
    return {
      result,
      httpStatus: statusFromMessage(result.error || "Falha ao excluir."),
    };
  }
  return { result, httpStatus: 200 };
}

/** Exclui empresa via RPC (SET LOCAL app.delete_authorized). */
export async function excluirEmpresaCrm(
  supabase: SupabaseClient,
  empresaId: string
): Promise<{ result: RpcDeleteResult; httpStatus: number }> {
  const { data, error } = await supabase.rpc("hub_delete_empresa_crm", { p_id: empresaId });

  if (error) {
    const msg = error.message || "Falha ao excluir empresa.";
    return { result: { ok: false, error: msg }, httpStatus: statusFromMessage(msg) };
  }

  const result = parseRpcRow(data);
  if (!result.ok) {
    return {
      result,
      httpStatus: statusFromMessage(result.error || "Falha ao excluir."),
    };
  }
  return { result, httpStatus: 200 };
}
