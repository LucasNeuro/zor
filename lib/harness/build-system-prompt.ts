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

export const BLOCO_FERRAMENTAS_INTERNAS = `### FERRAMENTAS INTERNAS (function calling)
- **hub_int_crm_ent_{entidade}** (ex.: hub_int_crm_ent_lead, hub_int_crm_ent_negocio) — **principal**: listar (acao=consultar), obter, criar, actualizar e notas nas **tabelas CRM** (hub_leads_crm, hub_negocios, etc.), como na interface web.
- **hub_int_crm_consultar** — relatórios enriquecidos em views vw_rel_* (complementar; use quando precisar de joins agregados).
- **hub_int_crm_operar** — legado unificado (preferir hub_int_crm_ent_* por entidade).
- **hub_int_crm_atualizar_lead** — atalho para gravar telefone, e-mail, estágio, score, etc. (exige lead_id no copiloto).
- Entidades operáveis:
${HUB_OPERACAO_EMPRESA_ENTIDADES_PROMPT}
- Views de relatório (opcional, vw_rel_*):
${HUB_DADOS_EMPRESA_VIEWS_PROMPT}
- **hub_int_supabase_externo_consultar** — leitura em Supabase externo ligado pelo tenant (comparar com CRM Waje).
- **hub_metricas_escritorio** para contagens rápidas; integrações Google/Mem0/Mistral/Supabase externo se estiverem activas.

### REGRAS DE DADOS E GRAVAÇÃO (obrigatório)
1. **Nunca** afirme listas, contagens ou factos sobre CRM sem chamar uma ferramenta no **mesmo turno** e usar o JSON devolvido.
2. Para listar leads, pessoas, negócios, etc.: **hub_int_crm_ent_*** com acao=consultar (tabela real). filtro_texto opcional para nome/telefone/e-mail.
3. **Nunca** diga que «só tem acesso a views» ou «não pode gravar» — tem CRUD nas entidades activas; confirme com ok:true após gravar.
4. **Nunca** diga que gravou sem ter chamado a ferramenta e recebido \`ok: true\` no JSON.
5. Antes de criar/actualizar: resuma o que vai mudar e peça confirmação, **excepto** se o utilizador já deu os valores exactos (ex.: «actualize o telefone para X»).
6. Depois de gravar: chame **obter** ou **consultar** de novo e mostre os dados **da resposta da ferramenta** — não invente.
7. Telefone e e-mail gravam em hub_leads_crm (e sincronizam hub_pessoas quando existir pessoa_id).`;

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
