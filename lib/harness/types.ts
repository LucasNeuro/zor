/**
 * Contratos do harness Waje v0.1 (hiperagentes empresariais).
 * @see docs/rfc-harness-interno-v0.1.md
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BriefingChatReplyResult, BriefingMensagemLinha } from "@/lib/agente-briefing-chat";
import type { SuperagenteCanalInterno } from "@/lib/hub/superagente/canais-internos";
import type { FerramentaCustomParaMistral } from "@/lib/hub/ferramentas-custom-db";
import type { FerramentaExternaParaMistral } from "@/lib/hub/ferramentas-externas-db";
import type { FerramentaIntegradorDefMistral } from "@/lib/hub/agente-ferramentas-registry";

export const HARNESS_RUNTIME_ID = "waje-mistral-v1" as const;
export const HARNESS_VERSION = "0.3.0" as const;

export type HarnessSurface =
  | "copiloto_crm"
  | "ciclo_programado"
  | "whatsapp_gestor"
  | "whatsapp_lead"
  | "email_lead"
  | "interno";

export type HarnessModeId = "conversar" | "analisar" | "operar" | "planear";

export type AgenteInternoTrigger = "copiloto" | "ciclo";

export type ExecutarAgenteInternoParams = {
  supabase: SupabaseClient;
  modelo: string;
  agenteNome: string;
  agenteSlug: string;
  tenantId?: string | null;
  cargo?: string;
  area?: string;
  bio?: string;
  promptBaseTrecho?: string;
  playbookTrecho?: string;
  snapshot?: string;
  historico: BriefingMensagemLinha[];
  mensagemUsuario: string;
  memoriasAgenteBloco?: string;
  trigger: AgenteInternoTrigger;
  canalInterno?: SuperagenteCanalInterno;
  telefoneSessao?: string | null;
  usuarioCrmId?: string | null;
  briefCiclo?: string;
  /** Sessão briefing CRM — liga thread_id na harness session */
  briefingSessaoId?: string | null;
  /** Resume após aprovação humana (RFC §9.3) */
  approvalId?: string | null;
  approvalDecisao?: "aprovar" | "rejeitar" | null;
};

export type HarnessHostContext = {
  tenantId: string;
  agenteSlug: string;
  agenteNome: string;
  surface: HarnessSurface;
  telefoneSessao: string | null;
  usuarioCrmId: string | null;
  leadId?: string | null;
  sessionId?: string | null;
  modoId?: HarnessModeId;
  grants?: Record<string, boolean>;
};

export type HarnessSessionSnapshot = {
  modeId: HarnessModeId;
  grants: Record<string, boolean>;
};

export type HarnessTurnInput = {
  systemPrompt: string;
  mensagens: Array<{ role: "user" | "assistant"; content: string }>;
  modelo: string;
  motorFerramentas: boolean;
  agentReasoningEnabled: boolean;
  mistralTools: unknown[];
};

export type HarnessTurnResult = {
  texto: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  urlsPublicas: string[];
};

export type HarnessToolDefs = {
  customDefs: FerramentaCustomParaMistral[];
  extDefs: FerramentaExternaParaMistral[];
  intDefs: FerramentaIntegradorDefMistral[];
  usoMap: Record<string, boolean>;
};

export type HarnessOutcomeClassification =
  | "assistant_text"
  | "reasoning_only"
  | "empty"
  | "error";

export type { BriefingChatReplyResult };
