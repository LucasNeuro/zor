/**
 * Modos de instrução do agente Hub:
 * - playbook-only: sem cargo no catálogo; playbook publicado no bucket é a fonte estática.
 * - cargo: catálogo hub_cargos_catalogo (com ou sem playbook publicado — playbook ganha no prompt).
 */

export type AgenteInstrucaoIdent = {
  cargo?: string | null;
  playbook_object_path?: string | null;
  playbook_public_url?: string | null;
};

export function cargoAgentePreenchido(cargo: string | null | undefined): boolean {
  return Boolean(String(cargo ?? "").trim());
}

export function temReferenciaPlaybookPublicado(ident: AgenteInstrucaoIdent): boolean {
  return Boolean(
    String(ident.playbook_object_path ?? "").trim() || String(ident.playbook_public_url ?? "").trim()
  );
}

/** Playbook no bucket + sem cargo → só playbook (nada do catálogo no prompt/fluxo). */
export function isPlaybookOnlyAgent(ident: AgenteInstrucaoIdent): boolean {
  return temReferenciaPlaybookPublicado(ident) && !cargoAgentePreenchido(ident.cargo);
}

/**
 * Catálogo de cargo entra no prompt apenas se existir cargo E não houver playbook publicado
 * (playbook publicado tem prioridade sobre perguntas/saudação do cargo).
 */
export function deveUsarCargoCatalogoNoPrompt(
  ident: AgenteInstrucaoIdent,
  playbookPublicadoOk: boolean
): boolean {
  if (!cargoAgentePreenchido(ident.cargo)) return false;
  if (playbookPublicadoOk) return false;
  return true;
}

export const PROMPT_BASE_PLAYBOOK_ONLY = `Você é um agente de atendimento do HUB Obra 10+.
Suas instruções operacionais completas estão no playbook publicado em hub-agent-playbooks (Markdown no bucket).
Siga esse playbook como fonte única de comportamento estático; o runtime acrescenta apenas contexto da sessão (lead, canal, memórias).`;
