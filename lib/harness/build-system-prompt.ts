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
import { type HarnessToolsetId } from "@/lib/harness/toolsets";

function trunc(s: string, n: number): string {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

function bloco(tag: string, conteudo: string): string {
  return `<${tag}>\n${conteudo.trim()}\n</${tag}>`;
}

// ---------------------------------------------------------------------------
// Constantes exportadas (backwards compat — mantidas para outros módulos)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

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
  /** Toolsets activos nesta sessão — gera <system_capability> dinâmica (RFC §10) */
  toolsetsAtivos?: HarnessToolsetId[];
  /** Nomes dos integradores activos para <system_capability> */
  intDefNomes?: string[];
  /** Nomes das tools externas activas para <system_capability> */
  extDefNomes?: string[];
};

// ---------------------------------------------------------------------------
// gerarCapabilityBloco — <system_capability> dinâmica
// ---------------------------------------------------------------------------

/**
 * Gera o corpo de <system_capability> a partir dos toolsets activos.
 * Apenas lista o que o agente **consegue fazer** nesta sessão.
 */
export function gerarCapabilityBloco(
  toolsets: HarnessToolsetId[],
  extDefs: string[] = [],
  intDefs: string[] = []
): string {
  const linhas: string[] = [];

  if (toolsets.includes("crm_operacoes")) {
    linhas.push("- Consultar e gravar entidades CRM (leads, negócios, financeiro, notas)");
  }
  if (toolsets.includes("crm_relatorios")) {
    linhas.push("- Aceder a views agregadas e relatórios CRM (vw_rel_*)");
  }
  if (toolsets.includes("artefatos")) {
    linhas.push("- Publicar dashboards canvas com KPIs, gráficos e link público");
  }
  if (toolsets.includes("multimodal")) {
    linhas.push("- Processar imagens, áudio e documentos (OCR via Mistral Percepcao)");
  }
  if (toolsets.includes("metricas")) {
    linhas.push("- Consultar KPIs e indicadores do escritório");
  }
  if (toolsets.includes("memoria")) {
    linhas.push("- Persistir e recuperar memória entre sessões (Mem0)");
  }
  if (toolsets.includes("skills_harness")) {
    linhas.push("- Carregar runbooks L1/L2, orquestrar multi-agentes e delegar tarefas");
  }
  if (intDefs.length) {
    linhas.push(`- Integradores activos: ${intDefs.join(", ")}`);
  }
  if (extDefs.length) {
    linhas.push(`- Ferramentas externas activas: ${extDefs.join(", ")}`);
  }

  if (!linhas.length) {
    linhas.push("- Copiloto conversacional (sem ferramentas activas nesta sessão)");
  }

  return linhas.join("\n");
}

// ---------------------------------------------------------------------------
// montarSystemPromptHarness — prompt estruturado no estilo Manus
// ---------------------------------------------------------------------------

export function montarSystemPromptHarness(params: MontarSystemPromptParams): string {
  const escopoInterno = blocoEscopoFuncaoCopilotoInterno({
    cargo: params.cargo,
    area: params.area,
    bio: params.bio,
  });

  // <waje_intro> — identidade e escopo funcional
  const waje_intro = bloco(
    "waje_intro",
    copilotoInternoPreamble(params.agenteNome, params.cargo, escopoInterno)
  );

  // <language_settings>
  const language_settings = bloco(
    "language_settings",
    `Idioma padrão: Português.
Usar idioma do utilizador quando explicitamente fornecido.
Todo o raciocínio e respostas devem estar no idioma de trabalho.`
  );

  // <system_capability> — gerada dinamicamente a partir dos toolsets activos
  const capabilityCorpo = gerarCapabilityBloco(
    params.toolsetsAtivos ?? [],
    params.extDefNomes ?? [],
    params.intDefNomes ?? []
  );
  const system_capability = bloco("system_capability", capabilityCorpo);

  // <agent_loop>
  const agent_loop = bloco(
    "agent_loop",
    `1. Analisar contexto: ler evento/mensagem, histórico e memória activa
2. Seleccionar tool: escolher a tool adequada ao estado actual e ao modo da sessão
3. Aguardar observação: resultado da tool é injectado no event_stream (nunca inventar)
4. Iterar: repetir até a tarefa estar completa ou necessitar de aprovação humana
5. Entregar resultado: responder ao utilizador com os dados reais da tool`
  );

  // <harness_modes>
  const harness_modes = bloco(
    "harness_modes",
    `Modos da sessão activos:
- **conversar** — explicações e respostas em prosa; sem gravar CRM nem publicar artefactos.
- **analisar** — consultas CRM e relatórios; sem escrita.
- **operar** — CRUD com aprovação humana quando necessário.
- **planear** — plano de steps em markdown; não executa gravações.
Se uma tool devolver \`harness_policy\` / \`requer_aprovacao\`, peça ao gestor para mudar de modo ou aprovar na UI.`
  );

  // <tool_use_rules>
  const tool_use_rules = bloco(
    "tool_use_rules",
    `1. Para dados CRM/financeiro: SEMPRE usar tool no mesmo turno — nunca afirmar listas, contagens ou factos sem JSON.
2. Para criar ou actualizar: executar hub_int_crm_ent_* no mesmo turno — proibido «vou criar», «um momento» ou «aguarde» sem tool.
3. Só confirmar gravação com \`ok: true\` no JSON da ferramenta; depois obter ou consultar para confirmar o registo.
4. Se o utilizador forneceu valores exactos e autorizou gravação, executar imediatamente sem confirmação extra.
5. Nunca inventar URLs — usar apenas \`url_publica\` devolvida pela ferramenta.
6. Copiloto CRM é chat: respostas em prosa são permitidas para explicações e análises sem dados CRM.`
  );

  // <crm_rules>
  const crm_rules = bloco(
    "crm_rules",
    [
      BLOCO_RELACOES_CRM,
      "",
      BLOCO_SUPERAGENTE,
      "",
      `### ORQUESTRAÇÃO MULTI-AGENTE
- Pode delegar tarefas a outro agente do tenant com **harness_delegate_to_agent** (especialistas internos).
- Use **harness_skills_list** / **harness_skill_view** antes de fluxos complexos.
- Nunca invente resposta de outro agente — delegue e use o JSON devolvido.`,
      "",
      `### FERRAMENTAS INTERNAS DISPONÍVEIS
- **hub_int_crm_ent_{entidade}** — principal para TODAS as entidades (consultar, obter, criar, actualizar, nota).
- **hub_int_crm_consultar** — views vw_rel_* (relatórios agregados).
- **hub_int_crm_atualizar_lead** — atalho lead.
- **hub_int_supabase_externo_consultar** — Supabase externo opcional (só leitura).
- Entidades disponíveis:
${HUB_OPERACAO_EMPRESA_ENTIDADES_PROMPT}`,
    ].join("\n")
  );

  // <event_stream>
  const event_stream = bloco(
    "event_stream",
    `Tipos de evento no histórico desta sessão:
- Message: mensagem do utilizador (input humano)
- Action: chamada a tool (nome da ferramenta + argumentos)
- Observation: resultado da tool (JSON — fonte de verdade, nunca inventar)
- Plan: plano de steps em markdown (modo planear)
- Knowledge: skill L1 carregada ou memória injectada pelo harness`
  );

  // <skills_context> — L0 index + RAG + memória frozen
  const skillsHarness =
    params.skillsBloco?.trim() ||
    formatarBlocoSkillsHarness(
      gerarSkillsSuperagenteFromCargo(params.cargo, params.area)
    );

  const skillsContextParts = [
    skillsHarness
      ? `### SKILLS L0 (índice de runbooks disponíveis)\n${skillsHarness}`
      : null,
    params.memoriasBloco?.trim()
      ? `### MEMÓRIA FROZEN / SNAPSHOT\n${params.memoriasBloco.trim()}`
      : null,
    params.snapshot?.trim()
      ? `### SNAPSHOT DE SESSÃO\n${params.snapshot.trim()}`
      : null,
    BLOCO_MEMORIA_CONVERSA_HARNESS,
    BLOCO_CANAIS_SUPERAGENTE_EQUIVALENTES,
  ]
    .filter(Boolean)
    .join("\n\n");
  const skills_context = bloco("skills_context", skillsContextParts);

  // <identity_context> — nome, cargo, prompts, trigger
  const triggerLinha = linhaCanalSuperagente(params.canalInterno, params.briefCiclo);
  const identityParts = [
    `Identidade: nome=${params.agenteNome}, slug=${params.agenteSlug}`,
    params.cargo ? `Cargo: ${params.cargo}` : null,
    params.area ? `Área: ${params.area}` : null,
    params.bio ? `Bio: ${trunc(params.bio, 400)}` : null,
    params.promptBaseTrecho
      ? `Instruções base:\n${trunc(params.promptBaseTrecho, 3_200)}`
      : null,
    params.playbookTrecho
      ? `Playbook publicado:\n${trunc(params.playbookTrecho, 2_400)}`
      : null,
    triggerLinha,
  ]
    .filter(Boolean)
    .join("\n");
  const identity_context = bloco("identity_context", identityParts);

  // <history> — histórico compactado + mensagens recentes
  const historicoBloco = params.historico?.length
    ? formatarBlocoHistoricoCopiloto(params.historico)
    : "";

  return [
    waje_intro,
    language_settings,
    system_capability,
    agent_loop,
    harness_modes,
    tool_use_rules,
    crm_rules,
    event_stream,
    skills_context,
    identity_context,
    historicoBloco ? bloco("history", historicoBloco) : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}
