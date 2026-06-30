import { isUrlArtefatoApp } from "@/lib/hub/superagente/artefato-public-url";

/** Canais que partilham o mesmo motor superagente (ferramentas, skills, artefactos). */
export type SuperagenteCanalInterno = "copiloto_crm" | "whatsapp_gestor" | "ciclo_programado";

export const BLOCO_CANAIS_SUPERAGENTE_EQUIVALENTES = `### CANAIS EQUIVALENTES (mesmo superagente)
- **Copiloto CRM**, **WhatsApp gestor** e **ciclos programados** usam o **mesmo motor**, skills e ferramentas (hub_superagente_*, hub_operacao_empresa, Mistral multimodal, etc.).
- O que puder fazer num canal deve estar disponível nos outros — consulte dados reais, gere artefactos canvas com link público e use OCR/áudio quando o gestor enviar ficheiros ou URLs.
- Em ciclos programados, execute o brief automaticamente com as mesmas capacidades.`;

export function linhaCanalSuperagente(canal: SuperagenteCanalInterno, briefCiclo?: string): string {
  if (canal === "ciclo_programado") {
    return `Modo: **ciclo programado** (execução automática). Brief: ${briefCiclo?.trim() || "Análise operacional conforme cargo."}`;
  }
  if (canal === "whatsapp_gestor") {
    return "Modo: **WhatsApp gestor** — conversa com o empresário/gestor (mesmas ferramentas do copiloto CRM).";
  }
  return "Modo: **copiloto CRM** — conversa com colega humano no painel (mesmas ferramentas do WhatsApp gestor).";
}

export function formatarLinksArtefactosParaTexto(urls: string[]): string {
  return urls
    .map((u, i) => {
      const label = isUrlArtefatoApp(u) ? "Relatório interativo" : "Relatório";
      return `📊 ${label} ${i + 1}:\n${u}`;
    })
    .join("\n\n");
}
