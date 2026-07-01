import { copilotoInternoPreamble } from "@/lib/agente-briefing-chat";
import {
  BLOCO_MEMORIA_CONVERSA_HARNESS,
  formatarBlocoHistoricoCopiloto,
  type HistoricoCopilotoLinha,
} from "@/lib/harness/historico-copiloto";
import { blocoEscopoFuncaoCopilotoInterno } from "@/lib/hub/copiloto-interno-escopo";
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

export const BLOCO_MODOS_HARNESS = `### MODOS DO HARNESS (sessão)
- **conversar** — explicações; sem gravar CRM nem publicar artefactos.
- **analisar** — consultas CRM e relatórios; sem escrita.
- **operar** — CRUD com aprovação humana quando necessário.
- **planear** — plano em markdown; não executa gravações.
Se uma tool devolver \`harness_policy\` / \`requer_aprovacao\`, peça ao gestor para mudar de modo ou aprovar na UI.`;

export const BLOCO_SUPERAGENTE = `### SUPERAGENTE (canvas + Mistral)
- **hub_superagente_artefato** — relatório dashboard (tema claro): KPIs, gráficos Chart.js e tabelas detalhadas. **Cores:** degradé verde Waje (verde #3f9848 → lima #92ff00).
- **Não** use hub_relatorio_html_simples — um único canvas por pedido.
- Estrutura recomendada (qualquer área):
  1. \`kpi_row\` — 3–6 indicadores (label, valor, delta opcional, cor: verde|azul|laranja|teal|roxo|rosa)
  2. \`grafico\` — bar, line ou doughnut com dados reais
  3. \`tabela\` — detalhamento completo (todas as linhas; coluna Status para badges)
  4. \`texto\` — análise e recomendações em markdown
- Depois de publicar: responda **só** com o link \`url_publica\` — sem repetir tabelas no chat.
- **hub_mistral_percepcao** — OCR/áudio/imagem quando necessário.
- Nunca invente URLs; use apenas \`url_publica\` devolvida pela ferramenta.`;

export const BLOCO_RELACOES_CRM = `### RELAÇÕES CRM (obrigatório)
1. Encontrar lead → **hub_int_crm_ent_lead** (filtro_texto ou obter por id) → guarde o **UUID**
2. Negócios desse lead → **hub_int_crm_ent_negocio** com acao=consultar e **filtro_lead_id** = UUID (não use nome em filtro_texto)
3. Notas/atividades/conversas/contas → **filtro_lead_id** ou **filtro_negocio_id**
4. Nunca diga «não tem negócios» sem consultar negócio com filtro_lead_id no mesmo turno`;

export const BLOCO_FERRAMENTAS_INTERNAS = `### FERRAMENTAS INTERNAS (function calling) — superagente operacional
Você é **funcionário operacional** do empresário: CRM, financeiro, pipelines, briefings, KPIs, configurações e demais módulos via tabelas hub_* do tenant.

- **hub_int_crm_ent_{entidade}** — **principal** para TODAS as entidades operacionais (consultar, obter, criar, actualizar, nota).
- **hub_int_crm_consultar** — views vw_rel_* (relatórios agregados).
- **hub_int_crm_atualizar_lead** — atalho lead (passe lead_id no copiloto).
- Entidades disponíveis (CRM + financeiro + operações):
${HUB_OPERACAO_EMPRESA_ENTIDADES_PROMPT}
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
  historico?: HistoricoCopilotoLinha[];
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

  const historicoBloco = params.historico?.length
    ? formatarBlocoHistoricoCopiloto(params.historico)
    : "";

  return [
    copilotoInternoPreamble(params.agenteNome, params.cargo, escopoInterno),
    BLOCO_MEMORIA_CONVERSA_HARNESS,
    BLOCO_MODOS_HARNESS,
    triggerLinha,
    BLOCO_CANAIS_SUPERAGENTE_EQUIVALENTES,
    BLOCO_FERRAMENTAS_INTERNAS,
    BLOCO_SUPERAGENTE,
    blocoOrquestracao,
    skillsHarness || null,
    identity,
    historicoBloco || null,
    params.memoriasBloco?.trim() || null,
    params.snapshot?.trim() || null,
  ]
    .filter(Boolean)
    .join("\n\n");
}
