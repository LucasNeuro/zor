/**
 * Constantes e helpers do preset WA — seguros para importar em componentes client.
 * Não importar playbook-flow-template (usa node:fs) aqui.
 */
import { mergeUsoFerramentasWhatsappCanal } from "@/lib/hub/agente-ferramentas-registry";
import type { ConhecimentoSecaoId } from "@/lib/hub/conhecimento-secoes";

/** Presets disponíveis para agentes de conversação WhatsApp. */
export const WA_PRESET_IDS = ["conversacao_universal"] as const;
export type WaPresetId = (typeof WA_PRESET_IDS)[number];

export const WA_PRESET_CARGO_SLUG = "atendimento-whatsapp-waje";

export type WaPresetMeta = {
  id: WaPresetId;
  titulo: string;
  descricao: string;
  cargo_slug: string;
  inclui: string[];
};

export const WA_PRESETS_META: Record<WaPresetId, WaPresetMeta> = {
  conversacao_universal: {
    id: "conversacao_universal",
    titulo: "Conversação WhatsApp Waje",
    descricao:
      "Playbook Waje v1 com fluxo dinâmico, cargo de atendimento, ferramentas CRM, ciclo sob interação e follow-up proativo.",
    cargo_slug: WA_PRESET_CARGO_SLUG,
    inclui: [
      "Playbook publicado com bloco waje_playbook_flow",
      "Cargo com perguntas essenciais sequenciais",
      "Motor de ferramentas (menu WA, CRM, notas)",
      "Ciclo gatilho (sob interação)",
      "Ciclo follow-up (24h / 48h / 72h)",
      "Secções de conhecimento (atendimento + proibições)",
    ],
  },
};

export const NUNCA_DIZER_PRESET = [
  "Inventar preços, prazos, condições ou garantias fora da documentação",
  "Prometer resultados sem base na base de conhecimento ou playbook",
  "Mencionar cargo ou função interna (SDR, qualificador, closer)",
  "Repetir saudação ou menu de triagem já respondido nesta conversa",
] as const;

export const CONHECIMENTO_PRESET: Partial<Record<ConhecimentoSecaoId, string>> = {
  atendimento: [
    "## Como conduzir no WhatsApp",
    "- Uma pergunta ou decisão por mensagem (máx. 2–3 linhas).",
    "- Responda primeiro ao que o cliente perguntou; depois conduza o próximo passo.",
    "- Seja proativo: sempre indique o que vem a seguir.",
    "- Use hub_whatsapp_menu para triagem e decisões binárias.",
    "- Registe dados com hub_atualizar_lead assim que souber (nome, interesse, cidade, prazo).",
    "- Baseie respostas na documentação da empresa; se não souber, diga e ofereça encaminhar ao time.",
  ].join("\n"),
  proibicoes: [
    "## Nunca fazer",
    "- Inventar preços, prazos, condições ou políticas não documentadas.",
    "- Prometer o que não está na base de conhecimento.",
    "- Enviar blocos longos de texto ou várias perguntas na mesma mensagem.",
    "- Pedir telefone (já veio do WhatsApp).",
    "- Escrever <<<UAZ_LIST>>> ou <<<UAZ_BUTTONS>>> — use hub_whatsapp_menu.",
  ].join("\n"),
};

export function isWaPresetId(v: unknown): v is WaPresetId {
  return typeof v === "string" && (WA_PRESET_IDS as readonly string[]).includes(v);
}

export function personalizarPlaybookTemplate(markdown: string, nomeAgente: string): string {
  const nome = nomeAgente.trim() || "Assistente";
  return markdown
    .replace(/\[Nome\]/g, nome)
    .replace(/assistente virtual/gi, nome)
    .replace(/# Playbook — Atendimento Waje \(template v1\)/, `# Playbook — ${nome} (preset Waje v1)`);
}

export type WaPresetCreateHints = {
  cargo_slug: string;
  modo_operacao: "canal_whatsapp";
  ciclo_execucao: "interacao";
  motor_ferramentas_habilitado: true;
  uso_ferramentas_ia: Record<string, boolean>;
  conhecimento_secoes: Partial<Record<ConhecimentoSecaoId, string>>;
};

/** Valores sugeridos para POST /api/hub/agentes com wa_preset. */
export function waPresetHintsParaCriacao(): WaPresetCreateHints {
  const uso = mergeUsoFerramentasWhatsappCanal({}, "canal_whatsapp");
  return {
    cargo_slug: WA_PRESET_CARGO_SLUG,
    modo_operacao: "canal_whatsapp",
    ciclo_execucao: "interacao",
    motor_ferramentas_habilitado: true,
    uso_ferramentas_ia: uso,
    conhecimento_secoes: { ...CONHECIMENTO_PRESET },
  };
}
