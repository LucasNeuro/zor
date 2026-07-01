import { copilotoInternoPreamble } from "@/lib/agente-briefing-chat";
import { blocoEscopoFuncaoCopilotoInterno } from "@/lib/hub/copiloto-interno-escopo";
import { HUB_DADOS_EMPRESA_VIEWS_PROMPT } from "@/lib/hub/hub-dados-empresa";
import { HUB_OPERACAO_EMPRESA_ENTIDADES_PROMPT } from "@/lib/hub/hub-operacao-empresa";
import {
  BLOCO_CANAIS_SUPERAGENTE_EQUIVALENTES,
  linhaCanalSuperagente,
  type SuperagenteCanalInterno,
} from "@/lib/hub/superagente/canais-internos";
import {
  formatarBlocoSkillsHarness,
  gerarSkillsSuperagenteFromCargo,
} from "@/lib/hub/superagente/skills-from-cargo";

function trunc(s: string, n: number): string {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

export const BLOCO_SUPERAGENTE = `### SUPERAGENTE (canvas + Mistral)
- **hub_superagente_dados** — catálogo vw_rel_* e consultas em views (complementar às tabelas hub_int_crm_ent_*).
- **hub_superagente_artefato** — relatório canvas com UI Synkron.IA, avatar e nome do agente, tabelas e gráficos Chart.js (inclua seções tipo grafico; tabelas numéricas geram gráfico automático).
- **hub_mistral_percepcao** — OCR, transcrição de áudio, visão de imagens (Mistral).
- Para relatório visual: **sempre** chame hub_superagente_artefato e cite **apenas** a url_publica devolvida pela ferramenta.
- **Nunca** invente URLs (ex.: artefato.waje.com.br, ficheiros .html fictícios). Sem url_publica da ferramenta, diga que o relatório não foi publicado.
- **Memória de dias**: use o bloco MEMÓRIAS DO AGENTE e SUPER MEMÓRIA (Mem0) no prompt; grave preferências e decisões importantes para os próximos dias.`;

export const BLOCO_FERRAMENTAS_INTERNAS = `### FERRAMENTAS INTERNAS (function calling) — superagente operacional
Você é **funcionário operacional** do empresário: CRM, financeiro, pipelines, briefings, KPIs, configurações e demais módulos via tabelas hub_* do tenant.

- **hub_int_crm_ent_{entidade}** — **principal** para TODAS as entidades operacionais (consultar, obter, criar, actualizar, nota).
- **hub_int_crm_consultar** — views vw_rel_* (relatórios agregados).
- **hub_int_crm_atualizar_lead** — atalho lead (passe lead_id no copiloto).
- Entidades disponíveis (CRM + financeiro + operações):
${HUB_OPERACAO_EMPRESA_ENTIDADES_PROMPT}
- **hub_int_supabase_externo_consultar** — Supabase externo opcional (só leitura).
- **hub_superagente_artefato** / **hub_metricas_escritorio** / integrações activas.

### REGRAS DE DADOS E GRAVAÇÃO (obrigatório)
1. **Nunca** afirme listas, contagens ou factos sem chamar ferramenta no **mesmo turno**.
2. Para **criar ou actualizar**: chame hub_int_crm_ent_* no **mesmo turno** — **proibido** «vou criar», «um momento» ou «aguarde» sem tool.
3. Só confirme gravação com \`ok: true\` no JSON da ferramenta; depois **obter** ou **consultar** para mostrar o registo.
4. Se o utilizador já deu valores exactos e disse «pode criar/gravar», **execute imediatamente** sem pedir confirmação extra.
5. Tem CRUD nas entidades activas do tenant (excepto users e credenciais).`;

export type MontarSystemPromptParams = {
  agenteNome: string;
  agenteSlug: string;
  cargo?: string;
  area?: string;
  bio?: string;
  promptBaseTrecho?: string;
  playbookTrecho?: string;
  canalInterno: SuperagenteCanalInterno;
  briefCiclo?: string;
  memoriasBloco?: string;
  snapshot?: string;
  skillsBloco?: string;
};

export function montarSystemPromptHarness(params: MontarSystemPromptParams): string {
  const escopoInterno = blocoEscopoFuncaoCopilotoInterno({
    cargo: params.cargo,
    area: params.area,
    bio: params.bio,
  });

  const identity = [
    `Identidade: nome=${params.agenteNome}, slug=${params.agenteSlug}`,
    params.cargo ? `Cargo: ${params.cargo}` : null,
    params.promptBaseTrecho
      ? `Instruções base:\n${trunc(params.promptBaseTrecho, 3_200)}`
      : null,
    params.playbookTrecho
      ? `Playbook publicado:\n${trunc(params.playbookTrecho, 2_400)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const triggerLinha = linhaCanalSuperagente(params.canalInterno, params.briefCiclo);
  const skillsHarness =
    params.skillsBloco?.trim() ||
    formatarBlocoSkillsHarness(
      gerarSkillsSuperagenteFromCargo(params.cargo, params.area)
    );

  const blocoOrquestracao = `### ORQUESTRAÇÃO MULTI-AGENTE
- Pode delegar tarefas a outro agente do tenant com **harness_delegate_to_agent** (especialistas internos).
- Use **harness_skills_list** / **harness_skill_view** antes de fluxos complexos.
- Nunca invente resposta de outro agente — delegue e use o JSON devolvido.`;

  return [
    copilotoInternoPreamble(params.agenteNome, params.cargo, escopoInterno),
    triggerLinha,
    BLOCO_CANAIS_SUPERAGENTE_EQUIVALENTES,
    BLOCO_FERRAMENTAS_INTERNAS,
    BLOCO_SUPERAGENTE,
    blocoOrquestracao,
    skillsHarness || null,
    identity,
    params.memoriasBloco?.trim() || null,
    params.snapshot?.trim() || null,
  ]
    .filter(Boolean)
    .join("\n\n");
}
