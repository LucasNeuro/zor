/** Feature flags CRM (env na Render ou .env.local). */

function envBool(key: string, defaultValue = false): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  if (!v) return defaultValue;
  return v === "1" || v === "true" || v === "yes";
}

/** NEXT_PUBLIC_* no cliente: acesso literal (webpack não substitui process.env[chave dinâmica]). */
function publicEnvBool(value: string | undefined, defaultValue = false): boolean {
  const v = value?.trim().toLowerCase();
  if (!v) return defaultValue;
  return v === "1" || v === "true" || v === "yes";
}

export const crmFeatureFlags = {
  pipelineV2: () => envBool("CRM_PIPELINE_V2", true),
  encaminhamentoV2: () => envBool("CRM_ENCAMINHAMENTO_V2", true),
  proximaAcaoObrigatoria: () => envBool("CRM_PROXIMA_ACAO_OBRIGATORIA"),
  logsAuditoria: () => envBool("CRM_LOGS_AUDITORIA", true),
  playbookFlowVisualSideover: () =>
    publicEnvBool(
      process.env.NEXT_PUBLIC_CRM_PLAYBOOK_FLOW_VISUAL_SIDEOVER,
      process.env.NODE_ENV === "development"
    ),
} as const;
