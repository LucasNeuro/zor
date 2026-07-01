/**
 * Identidade base (system_prompt_base) para agentes internos.
 * O harness completo (ferramentas, skills L0, orquestração) é montado em runtime por montarSystemPromptHarness.
 */

import { sanitizarCatalogoInterno } from "@/lib/hub/superagente/cargo-harness-sanitize";

export type PromptInternoCargoInput = {
  tituloCargo: string;
  area?: string | null;
  promptTemplate?: unknown;
  descricao?: unknown;
  descricaoCurta?: unknown;
  podeFazer?: unknown;
  naoPodeFazer?: unknown;
  /** Quando false, omite listas do catálogo (evita contradizer ferramentas CRM). */
  incluirLimitesCatalogo?: boolean;
};

export function montarPromptBaseInternoDoCargo(params: PromptInternoCargoInput): string {
  const titulo = String(params.tituloCargo ?? "").trim();
  const area = String(params.area ?? "").trim();
  const promptTemplate = String(params.promptTemplate ?? "").trim();
  const descricao = String(params.descricao ?? "").trim();
  const descricaoCurta = String(params.descricaoCurta ?? "").trim();
  const incluirLimites = params.incluirLimitesCatalogo === true;
  const { podeFazer, naoPodeFazer } = sanitizarCatalogoInterno(
    params.podeFazer,
    params.naoPodeFazer
  );

  const secoes: string[] = [];
  secoes.push(
    `Superagente interno Waje — cargo **${titulo}**${area ? ` (área: ${area})` : ""}.`
  );
  secoes.push(
    [
      "## Contexto operacional",
      "- Actua apenas com a equipa interna (CRM, ciclos, dados reais da empresa).",
      "- Não atende cliente final nem simula WhatsApp comercial.",
      "- Dados e gravações no CRM são feitos pelas **ferramentas activas** injectadas pelo harness em runtime (hub_int_crm_ent_*, relatórios, canvas, Mistral).",
      "- Confirme ids reais com consultas antes de alterar registos.",
    ].join("\n")
  );

  if (descricaoCurta && descricaoCurta !== descricao) {
    secoes.push(`## Resumo do cargo\n${descricaoCurta}`);
  }

  if (promptTemplate) {
    secoes.push(`## Missão e responsabilidades\n${promptTemplate}`);
  } else if (descricao) {
    secoes.push(`## Missão e responsabilidades\n${descricao}`);
  } else {
    secoes.push(
      "## Missão e responsabilidades\nAnalise dados operacionais, responda com clareza, não invente números e escale decisões críticas para humano."
    );
  }

  secoes.push(
    [
      "## Nota harness",
      "Esta identidade grava-se no agente. O motor Waje acrescenta em cada turno: catálogo de ferramentas activas, skills (harness_skills_*), memória, orquestração multi-agente e regras de gravação CRM.",
      "Não repita listas de ferramentas nem negue acesso ao banco — isso é definido pelo harness, não por este texto.",
    ].join("\n")
  );

  if (incluirLimites && podeFazer.length) {
    secoes.push(`## Pode fazer (escopo de negócio)\n${podeFazer.map((x) => `- ${x}`).join("\n")}`);
  }
  if (incluirLimites && naoPodeFazer.length) {
    secoes.push(
      `## Não pode fazer (escopo de negócio)\n${naoPodeFazer.map((x) => `- ${x}`).join("\n")}`
    );
  }

  return secoes.join("\n\n").trim();
}
