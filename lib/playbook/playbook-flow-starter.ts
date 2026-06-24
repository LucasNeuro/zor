import type { PlaybookFlowDefinition } from "./flow-definition-types";

function slugId(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

/** Fluxo mínimo editável no editor visual (sem IA — só estrutura de passos no canal WA). */
export function buildStarterPlaybookFlowDefinition(agenteSlug?: string): PlaybookFlowDefinition {
  const slug = agenteSlug?.trim() ? slugId(agenteSlug) : "agente";
  return {
    waje_playbook_flow_schema: 1,
    id: `waje_${slug}_starter_v1`,
    version: "1.0.0",
    entry_step_id: "inicio",
    steps: [
      {
        id: "inicio",
        kind: "message",
        title: "Boas-vindas",
        message: "Olá! Vou te ajudar em alguns passos rápidos.",
        next: "menu_principal",
      },
      {
        id: "menu_principal",
        kind: "menu",
        title: "Menu principal",
        prompt: "Qual opção faz mais sentido para você agora?",
        field: "intencao_inicial",
        options: [
          { id: "quero_orcamento", label: "Quero orçamento", next: "coleta_nome" },
          { id: "quero_falar_time", label: "Quero falar com o time", next: "encerramento" },
        ],
      },
      {
        id: "coleta_nome",
        kind: "input",
        title: "Coletar nome",
        prompt: "Qual seu nome?",
        field: "nome_contato",
        input_type: "text",
        next: "encerramento",
      },
      {
        id: "encerramento",
        kind: "complete",
        title: "Finalização",
        complete: {
          type: "complete",
          summary: "Encaminhar para atendimento humano com contexto coletado.",
        },
      },
    ],
  };
}
