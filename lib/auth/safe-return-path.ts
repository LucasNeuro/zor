/**
 * Evita open redirect: só caminhos relativos internos (sem protocolo, sem "..").
 */
export function getSafeReturnPath(raw: string | null | undefined, fallback = "/office"): string {
  if (raw == null || typeof raw !== "string") return fallback;
  let t: string;
  try {
    t = decodeURIComponent(raw.trim());
  } catch {
    return fallback;
  }
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  if (t.includes("..")) return fallback;
  if (t.includes(":")) return fallback;
  if (t.length > 512) return fallback;
  return t || fallback;
}
