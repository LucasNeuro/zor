/** Origem pública para links de artefactos partilháveis (WhatsApp gestor, copiloto). */
export function resolvePublicAppOrigin(): string {
  const isProd = process.env.NODE_ENV === "production";

  const explicit = normalizeOrigin(process.env.ARTEFATO_PUBLIC_ORIGIN?.trim());
  if (explicit) return explicit;

  // Em dev, priorizar localhost para preview/copiloto (não synkronia sem deploy).
  if (!isProd) {
    const local =
      normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL?.trim()) ||
      normalizeOrigin(`http://localhost:${process.env.PORT || "3001"}`);
    if (local) return local;
  }

  const prodCandidates = [
    process.env.WHATSAPP_WEBHOOK_PUBLIC_ORIGIN?.trim(),
    process.env.WEBHOOK_PUBLIC_ORIGIN?.trim(),
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.APP_URL?.trim(),
    process.env.RENDER_EXTERNAL_URL?.trim(),
  ];

  for (const raw of prodCandidates) {
    const accepted = normalizeOrigin(raw, isProd);
    if (accepted) return accepted;
  }

  return isProd ? "https://synkronia.com.br" : "http://localhost:3001";
}

function normalizeOrigin(raw?: string | null, isProd = process.env.NODE_ENV === "production"): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    if (isProd && (h === "localhost" || h === "127.0.0.1")) return null;
    u.pathname = "";
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function extrairIdArtefatoDaUrl(url: string): string | null {
  try {
    const m = new URL(url).pathname.match(/\/artefato\/([0-9a-f-]{36})/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export function pathArtefatoRelativo(artefatoId: string): string {
  return `/artefato/${encodeURIComponent(artefatoId.trim())}`;
}

export function buildUrlArtefatoPublico(artefatoId: string): string {
  const id = artefatoId.trim();
  const origin = resolvePublicAppOrigin();
  return `${origin}${pathArtefatoRelativo(id)}`;
}

export function buildUrlArtefatoNoOrigin(origin: string, artefatoId: string): string {
  const base = normalizeOrigin(origin) || resolvePublicAppOrigin();
  return `${base}${pathArtefatoRelativo(artefatoId)}`;
}

export function isUrlArtefatoApp(url: string): boolean {
  try {
    const u = new URL(url, "http://localhost");
    return /\/artefato\/[0-9a-f-]{36}$/i.test(u.pathname);
  } catch {
    return false;
  }
}
