export { runHarnessHost } from "@/lib/harness/host";
export { harnessV1Enabled } from "@/lib/harness/feature-flag";
export { delegarTrabalhoParaAgente, transferirLeadParaAgente } from "@/lib/harness/orchestration/delegate-to-agent";
export { resolverAgenteSlugParaLead } from "@/lib/harness/resolve-lead-agente";
export { HARNESS_RUNTIME_ID, HARNESS_VERSION } from "@/lib/harness/types";
export type {
  ExecutarAgenteInternoParams,
  HarnessSurface,
  HarnessModeId,
} from "@/lib/harness/types";
