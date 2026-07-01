export function extrairUrlsPublicasDeResultadoFerramenta(result: string): string[] {
  try {
    const p = JSON.parse(result) as Record<string, unknown>;
    const urls: string[] = [];
    if (typeof p.url_publica === "string" && p.url_publica.trim()) {
      urls.push(p.url_publica.trim());
    }
    if (typeof p.url === "string" && p.url.trim()) {
      urls.push(p.url.trim());
    }
    return urls;
  } catch {
    return [];
  }
}
