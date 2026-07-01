import type { MistralChatToolDefinition } from "@/lib/ia/mistral-chat-tools";

/** Ferramentas harness — disponíveis em agentes internos e de canal quando motor activo. */
export const HARNESS_TOOL_NAMES = [
  "harness_skills_list",
  "harness_skill_view",
  "harness_delegate_to_agent",
  "harness_transfer_lead",
] as const;

export type HarnessToolName = (typeof HARNESS_TOOL_NAMES)[number];

export function isHarnessToolName(n: string): n is HarnessToolName {
  return (HARNESS_TOOL_NAMES as readonly string[]).includes(n);
}

export function definicoesMistralHarnessTools(): MistralChatToolDefinition[] {
  return [
    {
      type: "function",
      function: {
        name: "harness_skills_list",
        description:
          "Lista skills activas deste agente (índice L0). Use antes de tarefas complexas para saber que runbooks existem.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "harness_skill_view",
        description: "Carrega o runbook completo (L1) de uma skill pelo skill_id.",
        parameters: {
          type: "object",
          properties: {
            skill_id: { type: "string", description: "ID da skill (ex.: crm_pipeline)" },
          },
          required: ["skill_id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "harness_delegate_to_agent",
        description:
          "Delega uma tarefa a outro agente IA do tenant e devolve a resposta dele. Use para especialistas (financeiro, jurídico, outro SDR).",
        parameters: {
          type: "object",
          properties: {
            agente_destino_slug: { type: "string", description: "Slug do agente destino" },
            brief: { type: "string", description: "O que pedir ao outro agente (contexto + pergunta)" },
          },
          required: ["agente_destino_slug", "brief"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "harness_transfer_lead",
        description:
          "Transfere o atendimento deste lead para outro agente de canal. Próximas mensagens do cliente serão tratadas por esse agente.",
        parameters: {
          type: "object",
          properties: {
            agente_destino_slug: { type: "string" },
            resumo: { type: "string", description: "Resumo opcional para o próximo agente" },
          },
          required: ["agente_destino_slug"],
          additionalProperties: false,
        },
      },
    },
  ];
}

export function mergeHarnessToolsIntoMistral(
  tools: MistralChatToolDefinition[]
): MistralChatToolDefinition[] {
  const names = new Set(tools.map((t) => t.function.name));
  const harness = definicoesMistralHarnessTools();
  const extra = harness.filter((h) => !names.has(h.function.name));
  return [...tools, ...extra];
}
