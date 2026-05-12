/** Saúde operacional exibida no CRM (heurística local + dados recentes). */
export type AgenteSaudeNivel = "ok" | "degradado" | "parado";

export type CicloLogResumo = {
  status?: string | null;
  iniciado_em?: string | null;
};

/**
 * - parado: inativo ou arquivado (UI passa isso).
 * - degradado: última execução de ciclo com erro, ou 2+ erros nas últimas 5, ou ciclos ativos sem log algum (cron nunca vinculado).
 * - ok: demais casos ativos.
 */
export function calcularSaudeAgente(params: {
  ativoOperacional: boolean;
  arquivado: boolean;
  ciclosAtivosCount: number;
  logsCiclo: CicloLogResumo[];
  ultimoPromptEm?: string | null;
}): AgenteSaudeNivel {
  if (!params.ativoOperacional || params.arquivado) return "parado";

  const logs = params.logsCiclo || [];
  const last = logs[0];
  if (last?.status === "erro") return "degradado";

  const ult5 = logs.slice(0, 5);
  const erros = ult5.filter((l) => l.status === "erro").length;
  if (erros >= 2) return "degradado";

  if (params.ciclosAtivosCount > 0 && logs.length === 0) return "degradado";

  if (params.ultimoPromptEm) {
    const t = new Date(params.ultimoPromptEm).getTime();
    if (!Number.isNaN(t) && Date.now() - t < 48 * 60 * 60 * 1000) return "ok";
  }

  if (params.ciclosAtivosCount === 0 && logs.length === 0) {
    return params.ultimoPromptEm ? "ok" : "degradado";
  }

  if (last?.iniciado_em) {
    const t = new Date(last.iniciado_em).getTime();
    if (!Number.isNaN(t) && Date.now() - t > 14 * 24 * 60 * 60 * 1000) return "degradado";
  }

  return "ok";
}

export const SAUDE_CORES: Record<AgenteSaudeNivel, { bg: string; fg: string; label: string }> = {
  ok: { bg: "#14532d", fg: "#86efac", label: "OK" },
  degradado: { bg: "#713f12", fg: "#fde047", label: "Degradado" },
  parado: { bg: "#450a0a", fg: "#fecaca", label: "Parado" },
};
