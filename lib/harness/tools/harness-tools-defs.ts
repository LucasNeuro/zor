import type { MistralChatToolDefinition } from "@/lib/ia/mistral-chat-tools";

/** Ferramentas harness — disponíveis em agentes internos e de canal quando motor activo. */
export const HARNESS_TOOL_NAMES = [
  "harness_skills_list",
  "harness_skill_view",
  "harness_skill_manage",
  "harness_memory",
  "harness_session_search",
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
          "List active skills (L0 index) for this agent. Use BEFORE complex multi-step workflows to discover available runbooks. Returns { skill_id, titulo, descricao } for each skill. Do NOT use if you already loaded the skill list this session — prefer harness_skill_view to load the full runbook body.",
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
        description:
          "Load the full runbook (L1 body) of a skill by skill_id. Use AFTER harness_skills_list identifies the relevant skill_id. Required param: skill_id (string slug, e.g. 'crm_pipeline'). Returns markdown runbook with step-by-step instructions and suggested tools. Do NOT call without a valid skill_id from the index.",
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
        name: "harness_skill_manage",
        description:
          "Create, update (patch), or delete a skill runbook for this agent. Use to persist a new workflow (create), fix/extend an existing runbook (patch), or remove an outdated skill (delete). Required params: acao ('create'|'patch'|'delete') + skill_id. For create/patch also provide titulo, descricao, corpo_md (markdown). May require human approval in 'operar' mode.",
        parameters: {
          type: "object",
          properties: {
            acao: {
              type: "string",
              enum: ["create", "patch", "delete"],
              description: "Operação na skill",
            },
            skill_id: { type: "string", description: "ID único da skill (slug)" },
            titulo: { type: "string" },
            descricao: { type: "string" },
            corpo_md: { type: "string", description: "Corpo markdown do runbook" },
            ferramentas_sugeridas: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["acao", "skill_id"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "harness_memory",
        description:
          "Write to the agent's curated long-term memory (persists across sessions). Use AFTER a session yields a durable insight, preference or SOP worth remembering. Required params: acao ('add'|'replace'|'remove') + target ('operacional'|'utilizador'|'atendimento'). Provide conteudo for add/replace. Effect is visible from the NEXT session — not the current one. Do NOT use for temporary context; use only for genuinely persistent knowledge.",
        parameters: {
          type: "object",
          properties: {
            acao: {
              type: "string",
              enum: ["add", "replace", "remove"],
              description: "add=append, replace=substituir target, remove=limpar",
            },
            target: {
              type: "string",
              enum: ["operacional", "utilizador", "atendimento"],
            },
            conteudo: { type: "string", description: "Texto (obrigatório para add/replace)" },
          },
          required: ["acao", "target"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "harness_session_search",
        description:
          "Search previous copiloto/briefing conversation messages for this agent using full-text keywords. Use when the user refers to a past decision, prior analysis or historical context not in the current window. Required param: query (keyword string). Returns up to `limite` matching messages (default 8). Do NOT use for real-time CRM data — use CRM entity tools instead.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Termos de pesquisa" },
            limite: { type: "number", description: "Máximo de mensagens (default 8)" },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "harness_delegate_to_agent",
        description:
          "Delegate a sub-task to another AI agent of this tenant and return its response. Use when a specialised agent (e.g. financial analyst, legal advisor, SDR) can handle the request better. Required params: agente_destino_slug (target agent slug) + brief (full context and question for the target agent). Do NOT use to transfer ongoing lead attendance — use harness_transfer_lead instead.",
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
          "Transfer ongoing lead attendance to a different channel agent. All future messages from this lead will be handled by the target agent. Required param: agente_destino_slug (target agent slug). Optionally provide resumo to give the next agent context. Use when the conversation scope changes permanently (e.g. handing off to customer success). Do NOT use for temporary sub-tasks — use harness_delegate_to_agent instead.",
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
