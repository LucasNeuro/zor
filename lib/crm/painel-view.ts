import type { PainelTabId } from "@/lib/crm/painel-tabs";

export type PainelViewMode = "paineis" | "tabela";

export function parsePainelViewMode(
  raw: string | null | undefined,
  tabId: PainelTabId
): PainelViewMode {
  if (tabId === "personalizado") return "tabela";
  return raw === "tabela" ? "tabela" : "paineis";
}

export function painelSuportaGraficos(tabId: PainelTabId): boolean {
  return tabId !== "personalizado";
}
