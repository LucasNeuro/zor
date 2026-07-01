/**
 * Motor unificado para agentes internos (copiloto CRM, ciclos programados).
 * Delega ao HarnessHost (lib/harness).
 */

import { agenteEhCopilotoInterno, isModoOperacaoAgente } from "@/lib/hub/agente-modo-operacao";
import type { BriefingChatReplyResult } from "@/lib/agente-briefing-chat";
import { runHarnessHost } from "@/lib/harness/host";
import type { AgenteInternoTrigger, ExecutarAgenteInternoParams } from "@/lib/harness/types";

export type { AgenteInternoTrigger, ExecutarAgenteInternoParams };

/** @deprecated Preferir `canalInterno`. */
export type AgenteInternoTriggerLegacy = AgenteInternoTrigger;

export async function executarAgenteInterno(
  params: ExecutarAgenteInternoParams
): Promise<BriefingChatReplyResult> {
  return runHarnessHost(params);
}

export function agenteInternoMotorDisponivel(
  ferrIaRow: { motor_ferramentas_habilitado?: boolean | null } | null | undefined
): boolean {
  return ferrIaRow?.motor_ferramentas_habilitado === true;
}

export function ehAgenteInternoOperacao(modoOperacao?: string | null): boolean {
  return agenteEhCopilotoInterno(
    isModoOperacaoAgente(modoOperacao) ? modoOperacao : null
  );
}
