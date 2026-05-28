import type { SupabaseClient } from "@supabase/supabase-js";

/** Contagem que retorna 0 se a tabela/coluna não existir (OBRA10 parcial). */
export async function safeCount(
  promise: PromiseLike<{ count: number | null; error: { message?: string; code?: string } | null }>
): Promise<number> {
  const { count, error } = await promise;
  if (error) {
    const code = error.code ?? "";
    const msg = (error.message ?? "").toLowerCase();
    if (
      code === "PGRST205" ||
      code === "PGRST204" ||
      code === "22P02" ||
      code === "42703" ||
      msg.includes("does not exist") ||
      msg.includes("schema cache") ||
      msg.includes("invalid input")
    ) {
      console.warn("[crm safeCount]", code, error.message ?? "");
      return 0;
    }
    console.warn("[crm safeCount]", code, error.message ?? "");
    return 0;
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

/** Select que devolve [] se a tabela/coluna não existir ou houver erro de permissão. */
export async function safeSelectRows<T>(
  promise: PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>
): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    const code = error.code ?? "";
    const msg = (error.message ?? "").toLowerCase();
    if (
      code === "PGRST205" ||
      code === "PGRST204" ||
      code === "42501" ||
      msg.includes("does not exist") ||
      msg.includes("schema cache") ||
      msg.includes("permission denied")
    ) {
      return [] as T;
    }
    console.warn("[crm safeSelectRows]", error.message ?? error);
    return [] as T;
  }
  return (data ?? []) as T;
}
