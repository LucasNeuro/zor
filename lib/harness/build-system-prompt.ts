import { copilotoInternoPreamble } from "@/lib/agente-briefing-chat";
import { blocoEscopoFuncaoCopilotoInterno } from "@/lib/hub/copiloto-interno-escopo";
import {
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

export const BLOCO_SUPERAGENTE = `### SUPERAGENTE (canvas Waje)
- **hub_superagente_artefato** — relatório dashboard tema **claro**, cores **Waje** (verde #3f9848, lima #92ff00).
- Consulte dados reais (CRM) **antes** de publicar. Responda **só** com \`url_publica\`.

**Estrutura obrigatória (financeiro / CRM):**
1. \`kpi_row\` — 4–6 KPIs (cor: verde|azul|laranja|teal|roxo|rosa)
2. \`grafico\` — bar ou doughnut com dados reais
3. \`tabela\` — **mesmos registos do gráfico**, colunas + **linhas preenchidas** (array de arrays OU objetos por coluna)
4. \`texto\` — insights em markdown (**negrito** em números críticos)

Exemplo tabela (preferido):
\`{tipo:"tabela", titulo:"Negócios abertos", colunas:["Código","Lead","Valor","Status"], linhas:[["NEG-2026-0001","Renato","R$ 5.690","aberto"]]}\`

**Proibido:** tabela só com cabeçalho sem linhas; inventar valores; duplicar relatório no chat.`;

export const BLOCO_RELACOES_CRM = `### RELAÇÕES CRM (obrigatório)
1. Encontrar lead → **hub_int_crm_ent_lead** (filtro_texto ou obter por id) → guarde o **UUID**
2. Negócios desse lead → **hub_int_crm_ent_negocio** com acao=consultar e **filtro_lead_id** = UUID (não use nome em filtro_texto)
3. Notas/atividades/conversas/contas → **filtro_lead_id** ou **filtro_negocio_id**
4. Nunca diga «não tem negócios» sem consultar negócio com filtro_lead_id no mesmo turno`;

const ENTIDADES_CRM_RESUMO =
  "lead, negocio, pessoa, nota, atividade, conta_receber, conta_pagar, conversa, proposta, aprovacao, alerta, pipeline, briefing (+ demais via acao=listar_entidades em hub_int_crm_consultar)";

export const BLOCO_FERRAMENTAS_INTERNAS = `### FERRAMENTAS INTERNAS (function calling) — superagente operacional
Você é **funcionário operacional** do empresário: CRM, financeiro, pipelines, briefings, KPIs e demais módulos via tabelas hub_* do tenant.

- **hub_int_crm_ent_{entidade}** — principal para entidades operacionais (consultar, obter, criar, actualizar, nota).
- **hub_int_crm_consultar** — views vw_rel_* (relatórios agregados) ou listar_entidades.
- **hub_int_crm_atualizar_lead** — atalho lead quando já tem lead_id no contexto.
- Entidades CRM principais: ${ENTIDADES_CRM_RESUMO}
- **hub_int_supabase_externo_consultar** — Supabase externo opcional (só leitura).
- **hub_superagente_artefato** / **hub_metricas_escritorio** / integrações activas.

${BLOCO_RELACOES_CRM}

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

  const blocoOrquestracao = `### ORQUESTRAÇÃO (só se precisar)
- Delegar a outro agente: **harness_delegate_to_agent**
- Fluxos complexos: **harness_skills_list** / **harness_skill_view**`;

  return [
    copilotoInternoPreamble(params.agenteNome, params.cargo, escopoInterno),
    triggerLinha,
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
