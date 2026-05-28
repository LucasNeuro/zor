/** Feature flags CRM (env na Render ou .env.local). */

function envBool(key: string, defaultValue = false): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  if (!v) return defaultValue;
  return v === "1" || v === "true" || v === "yes";
}

export const crmFeatureFlags = {
  pipelineV2: () => envBool("CRM_PIPELINE_V2", true),
  encaminhamentoV2: () => envBool("CRM_ENCAMINHAMENTO_V2", true),
  proximaAcaoObrigatoria: () => envBool("CRM_PROXIMA_ACAO_OBRIGATORIA"),
  logsAuditoria: () => envBool("CRM_LOGS_AUDITORIA", true),
} as const;
