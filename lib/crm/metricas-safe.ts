import type { SupabaseClient } from "@supabase/supabase-js";

/** Contagem que retorna 0 se a tabela/coluna não existir (OBRA10 parcial). */
export async function safeCount(
  promise: PromiseLike<{ count: number | null; error: { message?: string; code?: string } | null }>
): Promise<number> {
  const { count, error } = await promise;
  if (error) {
    const code = error.code ?? "";
    const msg = (error.message ?? "").toLowerCase();
    if (code === "PGRST205" || code === "PGRST204" || msg.includes("does not exist") || msg.includes("schema cache")) {
      return 0;
    }
    throw error;
  }
  return count ?? 0;
}

export async function safeSum(
  promise: PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>
): Promise<number> {
  const { data, error } = await promise;
  if (error) {
    const code = error.code ?? "";
    const msg = (error.message ?? "").toLowerCase();
    if (
      code === "PGRST205" ||
      code === "PGRST123" ||
      msg.includes("does not exist") ||
      msg.includes("schema cache") ||
      msg.includes("aggregate functions is not allowed")
    ) {
      return 0;
    }
    throw error;
  }
  const row = data as { sum?: number | null } | null;
  return Number(row?.sum ?? 0);
}
