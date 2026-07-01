/** Mascara ref do projecto Supabase (ex.: vrlw••••••.supabase.co). */
export function mascararHostSupabase(hostOrUrl: string): string {
  const raw = hostOrUrl.replace(/^https?:\/\//, "").trim();
  if (!raw) return "";

  const host = raw.split("/")[0] ?? raw;
  const parts = host.split(".");
  if (parts.length < 2) return "••••••";

  const ref = parts[0] ?? "";
  const suffix = parts.slice(1).join(".");
  if (!ref) return `••••••.${suffix}`;
  if (ref.length <= 4) return `${ref[0] ?? "•"}•••.${suffix}`;

  return `${ref.slice(0, 4)}••••••.${suffix}`;
}

export function hostSupabaseDeUrl(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).host;
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  }
}
