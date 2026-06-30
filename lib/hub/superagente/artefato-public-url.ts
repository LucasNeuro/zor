/** Origem pública para links de artefactos partilháveis (WhatsApp gestor, copiloto). */
export function resolvePublicAppOrigin(): string {
  const isProd = process.env.NODE_ENV === "production";
  const candidates = [
    process.env.ARTEFATO_PUBLIC_ORIGIN?.trim(),
    process.env.WHATSAPP_WEBHOOK_PUBLIC_ORIGIN?.trim(),
    process.env.WEBHOOK_PUBLIC_ORIGIN?.trim(),
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.APP_URL?.trim(),
    process.env.RENDER_EXTERNAL_URL?.trim(),
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const u = new URL(raw);
      const h = u.hostname.toLowerCase();
      if (isProd && (h === "localhost" || h === "127.0.0.1")) continue;
      u.pathname = "";
      u.search = "";
      u.hash = "";
      return u.toString().replace(/\/+$/, "");
    } catch {
      continue;
    }
  }

  if (!isProd) return "http://localhost:3001";
  return "https://synkronia.com.br";
}

export function buildUrlArtefatoPublico(artefatoId: string): string {
  const id = artefatoId.trim();
  const origin = resolvePublicAppOrigin();
  return `${origin}/artefato/${encodeURIComponent(id)}`;
}

export function isUrlArtefatoApp(url: string): boolean {
  try {
    const u = new URL(url);
    return /\/artefato\/[0-9a-f-]{36}$/i.test(u.pathname);
  } catch {
    return false;
  }
}
