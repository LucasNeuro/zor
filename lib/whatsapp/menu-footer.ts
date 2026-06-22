/** Rodapé UAZAPI em menus (footerText) — nome comercial do tenant, nunca marca Waje legada. */
export function menuFooterEmpresa(nomeEmpresa?: string | null): string {
  const n = String(nomeEmpresa ?? "").trim();
  if (n) return n.slice(0, 500);
  return "Atendimento";
}
