/**
 * Gera harness (prompt + skills) para superagentes internos a partir do cargo no catálogo.
 */

import { mistralApiKey } from "@/lib/ia/mistral-health";
import { mistralChatCompletion } from "@/lib/ia/mistral-chat";
import { limparPromptMistralInterno } from "@/lib/hub/superagente/cargo-harness-sanitize";
import {
  ajustarSkillsPorFerramentasAtivas,
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

export type GerarHarnessInternoOpts = {
  uso_ferramentas_ia?: Partial<Record<string, boolean>>;
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

const SYSTEM_IA = `És um arquitecto de **identidade** para superagentes internos Waje (CRM hub_*, ferramentas injectadas em runtime).

Recebes contexto JSON de um cargo e um rascunho de system_prompt_base.

Devolve **apenas** JSON válido (sem Markdown à volta):
- "system_prompt_base": string em português (Brasil), markdown leve (## títulos, bullets). **200–500 palavras**.
  - Conteúdo: quem é o agente, missão do cargo, tom de resposta, quando escalar para humano.
  - **Proibido**: listar ferramentas ou nomes hub_*; secções «Pode fazer» / «Não pode fazer»; dizer «só leitura», «não modificar dados», «sem acesso ao CRM», «multi-tenant», WhatsApp comercial.
  - O harness runtime já injecta ferramentas CRM, skills e regras de gravação — não duplique.
- "skills_resumo": array opcional de 2–6 strings curtas (títulos de competências).

Não invente dados financeiros da empresa.`;

export function montarHarnessInternoDeterministico(
  cargo: HarnessInternoCargoContext,
  opts?: GerarHarnessInternoOpts
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
    incluirLimitesCatalogo: false,
  });

  let skills = gerarSkillsSuperagenteFromCargo(titulo, area);
  if (opts?.uso_ferramentas_ia) {
    skills = ajustarSkillsPorFerramentasAtivas(skills, opts.uso_ferramentas_ia).filter(
      (s) => s.ferramentas_sugeridas.length > 0
    );
  }

  return { system_prompt_base, skills, gerado_com_ia: false };
}

export async function gerarHarnessInternoComMistral(
  cargo: HarnessInternoCargoContext,
  opts?: GerarHarnessInternoOpts
): Promise<{ ok: true; harness: HarnessInternoGerado } | { ok: false; error: string }> {
  const deterministico = montarHarnessInternoDeterministico(cargo, opts);

  if (!mistralApiKey()) {
    return { ok: true, harness: deterministico };
  }

  const model =
    process.env.HUB_HARNESS_INTERNO_MISTRAL_MODEL?.trim() ||
    process.env.MISTRAL_MODEL?.trim() ||
    "mistral-small-latest";

  const titulo = String(cargo.titulo ?? "").trim();
  const skills = deterministico.skills;
  const ferramentasAtivas = opts?.uso_ferramentas_ia
    ? Object.entries(opts.uso_ferramentas_ia)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
    : [];

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
      ferramentas_ativas: ferramentasAtivas,
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
    maxTokens: 1_800,
    temperature: 0.3,
    playbookIaTurn: true,
  });

  if (!chat.ok) {
    return { ok: true, harness: deterministico };
  }

  const parsed = extrairJsonObjeto(chat.text);
  const promptBruto =
    typeof parsed?.system_prompt_base === "string" ? parsed.system_prompt_base.trim() : "";
  const promptIa = promptBruto ? limparPromptMistralInterno(promptBruto) : "";

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
