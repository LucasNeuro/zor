/**
 * Gera harness (prompt + skills) para superagentes internos a partir do cargo no catálogo.
 */

import { mistralApiKey } from "@/lib/ia/mistral-health";
import { mistralChatCompletion } from "@/lib/ia/mistral-chat";
import {
  gerarSkillsSuperagenteFromCargo,
} from "@/lib/hub/superagente/skills-from-cargo";
import type { SuperagenteSkill } from "@/lib/hub/superagente/types";
import { montarPromptBaseInternoDoCargo } from "@/lib/hub/superagente/prompt-interno-cargo";

export type HarnessInternoCargoContext = {
  slug: string;
  titulo: string;
  area?: string | null;
  segmento?: string | null;
  especialidade?: string | null;
  descricao?: string | null;
  descricao_curta?: string | null;
  prompt_template?: string | null;
  pode_fazer_padrao?: unknown;
  nao_pode_fazer_padrao?: unknown;
};

export type HarnessInternoGerado = {
  system_prompt_base: string;
  skills: SuperagenteSkill[];
  gerado_com_ia: boolean;
};

function extrairJsonObjeto(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const inner = fence ? fence[1].trim() : t;
  const start = inner.indexOf("{");
  const end = inner.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(inner.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const SYSTEM_IA = `És um arquitecto de **superagentes internos** no ecossistema Waje (CRM com tabelas hub_* e CRUD via hub_int_crm_ent_*, relatórios vw_rel_*, artefactos canvas, Mistral multimodal).

Recebes contexto JSON de um cargo do catálogo hub_cargos_catalogo e um rascunho determinístico de system prompt.

Devolve **apenas** um objeto JSON válido (sem Markdown à volta) com:
- "system_prompt_base": string em português (Brasil), markdown leve permitido (## títulos, bullets). 400–1200 palavras no máximo.
  - Foco em trabalho interno (equipa, CRM, relatórios, ciclos) — **nunca** regras de atendimento WhatsApp ao cliente final.
  - Incorpora missão do cargo, limites claros, quando usar hub_int_crm_ent_* (tabelas CRM) e artefactos/OCR.
  - Nunca diga que o agente «só lê views» — tem CRUD nas entidades activas.
  - Não mencione "playbook" nem upload de ficheiros como requisito operacional.
- "skills_resumo": array opcional de 2–6 strings curtas (títulos de competências derivadas do cargo).

Não invente dados financeiros específicos da empresa.`;

export function montarHarnessInternoDeterministico(
  cargo: HarnessInternoCargoContext
): HarnessInternoGerado {
  const titulo = String(cargo.titulo ?? "").trim();
  const area = String(cargo.area ?? "").trim() || null;

  const system_prompt_base = montarPromptBaseInternoDoCargo({
    tituloCargo: titulo,
    area,
    promptTemplate: cargo.prompt_template,
    descricao: cargo.descricao,
    descricaoCurta: cargo.descricao_curta,
    podeFazer: cargo.pode_fazer_padrao,
    naoPodeFazer: cargo.nao_pode_fazer_padrao,
  });

  const skills = gerarSkillsSuperagenteFromCargo(titulo, area);

  return { system_prompt_base, skills, gerado_com_ia: false };
}

export async function gerarHarnessInternoComMistral(
  cargo: HarnessInternoCargoContext
): Promise<{ ok: true; harness: HarnessInternoGerado } | { ok: false; error: string }> {
  const deterministico = montarHarnessInternoDeterministico(cargo);

  if (!mistralApiKey()) {
    return { ok: true, harness: deterministico };
  }

  const model =
    process.env.HUB_HARNESS_INTERNO_MISTRAL_MODEL?.trim() ||
    process.env.MISTRAL_MODEL?.trim() ||
    "mistral-small-latest";

  const titulo = String(cargo.titulo ?? "").trim();
  const skills = deterministico.skills;

  const ctx = JSON.stringify(
    {
      cargo_slug: cargo.slug,
      titulo,
      area: cargo.area,
      segmento: cargo.segmento,
      especialidade: cargo.especialidade,
      descricao_curta: cargo.descricao_curta,
      descricao: cargo.descricao,
      prompt_template: cargo.prompt_template,
      pode_fazer: cargo.pode_fazer_padrao,
      nao_pode_fazer: cargo.nao_pode_fazer_padrao,
      skills_derivadas: skills.map((s) => ({ id: s.id, titulo: s.titulo, descricao: s.descricao })),
      rascunho_prompt: deterministico.system_prompt_base,
    },
    null,
    0
  );

  const chat = await mistralChatCompletion({
    model,
    system: SYSTEM_IA,
    messages: [{ role: "user", content: ctx }],
    maxTokens: 2_400,
    temperature: 0.35,
    playbookIaTurn: true,
  });

  if (!chat.ok) {
    return { ok: true, harness: deterministico };
  }

  const parsed = extrairJsonObjeto(chat.text);
  const promptIa =
    typeof parsed?.system_prompt_base === "string" ? parsed.system_prompt_base.trim() : "";

  if (!promptIa || promptIa.length < 80) {
    return { ok: true, harness: deterministico };
  }

  return {
    ok: true,
    harness: {
      system_prompt_base: promptIa,
      skills,
      gerado_com_ia: true,
    },
  };
}
