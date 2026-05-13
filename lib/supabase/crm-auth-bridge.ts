import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { isAuthApiError } from "@supabase/auth-js";

const g = globalThis as unknown as {
  __obraCrmAuthBridge?: boolean;
  __obraCrmAuthRecovering?: boolean;
};

function shouldRedirectToLogin(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  if (p === "/login" || p.startsWith("/login/")) return false;
  if (p.startsWith("/parceiro/")) return false;
  return p.startsWith("/crm") || p.startsWith("/office");
}

function isRefreshOrSessionFailure(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (isAuthApiError(err)) {
    const code = String((err as { code?: string }).code ?? "").toLowerCase();
    return (
      code === "refresh_token_not_found" ||
      code.includes("refresh") ||
      msg.includes("refresh token") ||
      msg.includes("invalid refresh") ||
      msg.includes("jwt expired") ||
      msg.includes("invalid jwt")
    );
  }
  return msg.includes("refresh token not found") || msg.includes("invalid refresh token");
}

async function postCrmAccessFromSession(session: Session | null) {
  if (!session?.access_token) return;
  try {
    await fetch("/api/auth/crm-session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: session.access_token,
        expires_in: session.expires_in,
      }),
    });
  } catch {
    /* rede — não bloquear */
  }
}

async function clearCrmCookieAndLocalSession(client: SupabaseClient) {
  try {
    await fetch("/api/auth/crm-session", { method: "DELETE", credentials: "include" });
  } catch {
    /* ignore */
  }
  await client.auth.signOut({ scope: "local" });
}

async function recoverStaleAuth(client: SupabaseClient) {
  if (g.__obraCrmAuthRecovering) return;
  g.__obraCrmAuthRecovering = true;
  try {
    await clearCrmCookieAndLocalSession(client);
    if (shouldRedirectToLogin()) {
      window.location.href = "/login?sessao=invalida";
    }
  } finally {
    g.__obraCrmAuthRecovering = false;
  }
}

/**
 * Mantém o cookie httpOnly do CRM alinhado ao JWT do Supabase após refresh,
 * e trata refresh token inválido (limpa armazenamento + cookie em vez de falhar em loop no console).
 */
export function installCrmAuthBridge(client: SupabaseClient) {
  if (typeof window === "undefined") return;
  if (g.__obraCrmAuthBridge) return;
  g.__obraCrmAuthBridge = true;

  void client.auth.getSession().then(({ data: { session }, error }) => {
    if (error && isRefreshOrSessionFailure(error)) {
      void recoverStaleAuth(client);
      return;
    }
    if (session?.access_token) void postCrmAccessFromSession(session);
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
      if (session) void postCrmAccessFromSession(session);
      return;
    }
    if (event === "SIGNED_OUT") {
      void fetch("/api/auth/crm-session", { method: "DELETE", credentials: "include" }).catch(() => {});
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!isRefreshOrSessionFailure(event.reason)) return;
    event.preventDefault();
    void recoverStaleAuth(client);
  });
}
