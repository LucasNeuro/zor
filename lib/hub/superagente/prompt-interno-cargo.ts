/**
 * Prompt base para agentes internos (superagente) — sem regras de canal externo / WhatsApp.
 */

function linhasArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

export type PromptInternoCargoInput = {
  tituloCargo: string;
  area?: string | null;
  promptTemplate?: unknown;
  descricao?: unknown;
  descricaoCurta?: unknown;
  podeFazer?: unknown;
  naoPodeFazer?: unknown;
};

export function montarPromptBaseInternoDoCargo(params: PromptInternoCargoInput): string {
  const titulo = String(params.tituloCargo ?? "").trim();
  const area = String(params.area ?? "").trim();
  const promptTemplate = String(params.promptTemplate ?? "").trim();
  const descricao = String(params.descricao ?? "").trim();
  const descricaoCurta = String(params.descricaoCurta ?? "").trim();
  const podeFazer = linhasArray(params.podeFazer);
  const naoPode = linhasArray(params.naoPodeFazer);

  const secoes: string[] = [];
  secoes.push(
    `Superagente interno Waje — cargo **${titulo}**${area ? ` (área: ${area})` : ""}.`
  );
  secoes.push(
    [
      "## Contexto operacional",
      "- Actua apenas com a equipa interna (CRM, ciclos, dados reais da empresa).",
      "- Não atende cliente final, não simula WhatsApp comercial nem triagem de leads externos.",
      "- **Listar, criar e actualizar** registos com hub_int_crm_ent_* (tabelas hub_leads_crm, hub_negocios, etc.) — paridade com a interface CRM.",
      "- Use hub_int_crm_consultar / hub_superagente_dados para relatórios vw_rel_* quando precisar de dados enriquecidos.",
      "- Artefactos canvas e percepção multimodal (hub_superagente_artefato, hub_mistral_percepcao).",
      "- Confirme ids reais com consultas antes de alterar registos no CRM.",
    ].join("\n")
  );

  if (descricaoCurta && descricaoCurta !== descricao) {
    secoes.push(`## Resumo do cargo\n${descricaoCurta}`);
  }

  if (promptTemplate) {
    secoes.push(`## Missão e responsabilidades\n${promptTemplate}`);
  } else if (descricao) {
    secoes.push(`## Missão e responsabilidades\n${descricao}`);
  }

  if (podeFazer.length) {
    secoes.push(`## Pode fazer\n${podeFazer.map((x) => `- ${x}`).join("\n")}`);
  }
  if (naoPode.length) {
    secoes.push(`## Não pode fazer\n${naoPode.map((x) => `- ${x}`).join("\n")}`);
  }

  if (!promptTemplate && !descricao) {
    secoes.push(
      "Analise dados operacionais, responda com clareza, não invente números e escale decisões críticas para humano."
    );
  }

  return secoes.join("\n\n").trim();
}
