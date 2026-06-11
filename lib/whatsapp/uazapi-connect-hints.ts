/** Motivos de desconexão UAZAPI que são esperados ao gerar novo QR (não são erro do utilizador). */
export function isBenignUazapiDisconnectReason(reason: string | null | undefined): boolean {
  const r = (reason || "").trim().toLowerCase();
  if (!r) return false;
  return (
    r.includes("connection attempt canceled") ||
    r.includes("attempt canceled by api") ||
    r.includes("cancelled by api") ||
    r.includes("canceled by api") ||
    r.includes("manual disconnect") ||
    r.includes("qr timeout") ||
    r.includes("timeout")
  );
}

export function formatUazapiDisconnectReasonForUi(reason: string): string {
  if (isBenignUazapiDisconnectReason(reason)) {
    return "Sessão anterior encerrada para gerar um QR novo. Use o código acima — se expirar, clique «Reconectar».";
  }
  return reason;
}
