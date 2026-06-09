/** Como o agente opera no hub: legado canal vs jobs internos (cron/ciclos). */
export type ModoOperacaoAgente = "canal_whatsapp" | "jobs_internos";

/** Escolha no wizard ao criar agente (mapeia para hub_ciclos_ia.tipo). */
export type CicloExecucaoPadrao = "interacao" | "tempo_real" | "agenda";

export const MODO_OPERACAO_OPCOES: readonly ModoOperacaoAgente[] = [
  "canal_whatsapp",
  "jobs_internos",
] as const;

export const CICLO_EXECUCAO_PADRAO_OPCOES: readonly CicloExecucaoPadrao[] = [
  "interacao",
  "tempo_real",
  "agenda",
] as const;

export function isModoOperacaoAgente(v: unknown): v is ModoOperacaoAgente {
  return typeof v === "string" && (MODO_OPERACAO_OPCOES as readonly string[]).includes(v);
}

export function isCicloExecucaoPadrao(v: unknown): v is CicloExecucaoPadrao {
  return typeof v === "string" && (CICLO_EXECUCAO_PADRAO_OPCOES as readonly string[]).includes(v);
}

export function modoOperacaoFromCicloExecucao(exec: CicloExecucaoPadrao): ModoOperacaoAgente {
  return exec === "interacao" ? "canal_whatsapp" : "jobs_internos";
}

export function cicloExecucaoPadraoFromModoOperacao(modo: ModoOperacaoAgente): CicloExecucaoPadrao {
  return modo === "canal_whatsapp" ? "interacao" : "agenda";
}

/** Rótulos para UI (wizard, ciclos, listagens). */
export const MODO_OPERACAO_LABEL: Record<ModoOperacaoAgente, string> = {
  canal_whatsapp: "Atendimento (WhatsApp)",
  jobs_internos: "Agente interno (ciclos)",
};

export const MODO_OPERACAO_DESCRICAO: Record<ModoOperacaoAgente, string> = {
  canal_whatsapp:
    "Atende clientes e leads no WhatsApp: cada mensagem dispara o agente (cargo + playbook no runtime).",
  jobs_internos:
    "Copiloto interno: relatórios, análises e tarefas agendadas via ciclos — sem fila de atendimento ao vivo.",
};

type AgenteModoRow = {
  modo_operacao?: unknown;
  ciclo_execucao_padrao?: unknown;
};

type HubCicloInfer = {
  tipo?: string;
  configuracoes?: unknown;
};

function cfgObj(cfg: unknown): Record<string, unknown> {
  return cfg && typeof cfg === "object" && !Array.isArray(cfg) ? (cfg as Record<string, unknown>) : {};
}

/** Lê modo gravado no agente; null se coluna ausente ou valor inválido. */
export function modoOperacaoFromAgenteRow(row: AgenteModoRow | null | undefined): ModoOperacaoAgente | null {
  if (!row) return null;
  if (isModoOperacaoAgente(row.modo_operacao)) return row.modo_operacao;
  if (isCicloExecucaoPadrao(row.ciclo_execucao_padrao)) {
    return modoOperacaoFromCicloExecucao(row.ciclo_execucao_padrao);
  }
  return null;
}

/** Inferência para agentes antigos sem coluna (primeiro ciclo padrão do wizard). */
export function inferModoOperacaoFromHubCiclos(ciclos: HubCicloInfer[]): ModoOperacaoAgente | null {
  const wizard = ciclos.filter((c) => cfgObj(c.configuracoes).ciclo_origem_provisionamento === "wizard_agente_v1");
  const alvo = wizard[0] ?? ciclos[0];
  if (!alvo?.tipo) return null;
  if (alvo.tipo === "gatilho") return "canal_whatsapp";
  if (alvo.tipo === "continuo" || alvo.tipo === "programado") return "jobs_internos";
  return null;
}

export function resolveModoOperacaoAgente(
  row: AgenteModoRow | null | undefined,
  ciclosDoAgente: HubCicloInfer[]
): ModoOperacaoAgente | null {
  return modoOperacaoFromAgenteRow(row) ?? inferModoOperacaoFromHubCiclos(ciclosDoAgente);
}

export function agenteEhSomenteCanalWhatsapp(modo: ModoOperacaoAgente | null): boolean {
  return modo === "canal_whatsapp";
}
