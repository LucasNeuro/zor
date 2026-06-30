/**
 * Motor unificado para agentes internos (copiloto CRM, ciclos programados).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { completarChatPreferindoMistral } from "@/lib/ia/llm-completion";
import { completarChatComFerramentasMistral } from "@/lib/ia/llm-completion-tools";
import { resolveInferenceModelId, isMistralFamilyModelId } from "@/lib/ia/hub-model-defaults";
import {
  agenteRaciocinioAvancadoAtivo,
  ferramentasMistralListaParaAgente,
  mergeUsoFerramentasComPadraoPreservandoCustom,
  mergeUsoFerramentasJobsInternos,
} from "@/lib/hub/agente-ferramentas-registry";
import { executarFerramentaHub } from "@/lib/hub/executar-ferramenta-ia";
import {
  fetchFerramentasCustomAtivas,
  rowParaMistralDef,
  type FerramentaCustomParaMistral,
} from "@/lib/hub/ferramentas-custom-db";
import {
  fetchFerramentasExternasAtivas,
  rowParaMistralDefExterna,
  type FerramentaExternaParaMistral,
} from "@/lib/hub/ferramentas-externas-db";
import { ferramentasIntegradorAtivasParaTenant } from "@/lib/hub/integradores-runtime";
import type { FerramentaIntegradorDefMistral } from "@/lib/hub/agente-ferramentas-registry";
import { defaultTenantId } from "@/lib/tenant-default";
import { agenteEhCopilotoInterno, isModoOperacaoAgente } from "@/lib/hub/agente-modo-operacao";
import {
  formatarBlocoSkillsHarness,
  gerarSkillsSuperagenteFromCargo,
} from "@/lib/hub/superagente/skills-from-cargo";
import {
  BLOCO_CANAIS_SUPERAGENTE_EQUIVALENTES,
  linhaCanalSuperagente,
  type SuperagenteCanalInterno,
} from "@/lib/hub/superagente/canais-internos";
import {
  montarBlocoMemoriaSuperagenteInterno,
  persistirMemoriaSuperagenteInterno,
} from "@/lib/hub/superagente/memoria-superagente";
import { blocoEscopoFuncaoCopilotoInterno } from "@/lib/hub/copiloto-interno-escopo";
import { copilotoInternoPreamble } from "@/lib/agente-briefing-chat";
import type { BriefingChatReplyResult, BriefingMensagemLinha } from "@/lib/agente-briefing-chat";
import { HUB_DADOS_EMPRESA_VIEWS_PROMPT } from "@/lib/hub/hub-dados-empresa";
import { HUB_OPERACAO_EMPRESA_ENTIDADES_PROMPT } from "@/lib/hub/hub-operacao-empresa";

function calcularCustoBrl(modelo: string, input: number, output: number): { brl: number; usd: number } {
  const inM = input / 1_000_000;
  const outM = output / 1_000_000;
  let usd = 0;
  const m = modelo.toLowerCase();
  if (m.includes("mistral") || m.includes("mixtral") || m.includes("ministral")) {
    usd = inM * 0.2 + outM * 0.6;
    return { usd, brl: usd * 5.5 };
  }
  if (m.includes("haiku")) usd = inM * 1 + outM * 5;
  else if (m.includes("sonnet")) usd = inM * 3 + outM * 15;
  else if (m.includes("opus")) usd = inM * 15 + outM * 75;
  else usd = inM * 3 + outM * 15;
  return { usd, brl: usd * 5.5 };
}

export type AgenteInternoTrigger = "copiloto" | "ciclo";

/** @deprecated Preferir `canalInterno`. */
export type AgenteInternoTriggerLegacy = AgenteInternoTrigger;

function trunc(s: string, n: number): string {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

const BLOCO_SUPERAGENTE = `### SUPERAGENTE (canvas + Mistral)
- **hub_superagente_dados** — catálogo vw_rel_* e consultas em views (complementar às tabelas hub_int_crm_ent_*).
- **hub_superagente_artefato** — relatório canvas com UI Synkron.IA, avatar e nome do agente, tabelas e gráficos Chart.js (inclua seções tipo grafico; tabelas numéricas geram gráfico automático).
- **hub_mistral_percepcao** — OCR, transcrição de áudio, visão de imagens (Mistral).
- Para relatório visual: **sempre** chame hub_superagente_artefato e cite **apenas** a url_publica devolvida pela ferramenta.
- **Nunca** invente URLs (ex.: artefato.waje.com.br, ficheiros .html fictícios). Sem url_publica da ferramenta, diga que o relatório não foi publicado.
- **Memória de dias**: use o bloco MEMÓRIAS DO AGENTE e SUPER MEMÓRIA (Mem0) no prompt; grave preferências e decisões importantes para os próximos dias.`;

function extrairUrlsPublicasDeResultadoFerramenta(result: string): string[] {
  try {
    const p = JSON.parse(result) as Record<string, unknown>;
    const urls: string[] = [];
    if (typeof p.url_publica === "string" && p.url_publica.trim()) urls.push(p.url_publica.trim());
    if (typeof p.url === "string" && p.url.trim()) urls.push(p.url.trim());
    return urls;
  } catch {
    return [];
  }
}

const BLOCO_FERRAMENTAS_INTERNAS = `### FERRAMENTAS INTERNAS (function calling)
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

export async function executarAgenteInterno(params: {
  supabase: SupabaseClient;
  modelo: string;
  agenteNome: string;
  agenteSlug: string;
  tenantId?: string | null;
  cargo?: string;
  area?: string;
  bio?: string;
  promptBaseTrecho?: string;
  playbookTrecho?: string;
  snapshot?: string;
  historico: BriefingMensagemLinha[];
  mensagemUsuario: string;
  memoriasAgenteBloco?: string;
  trigger: AgenteInternoTrigger;
  /** Canal concreto — alinha copiloto, gestor WA e ciclo. */
  canalInterno?: SuperagenteCanalInterno;
  /** Telefone do gestor (WhatsApp) — metadata em artefactos. */
  telefoneSessao?: string | null;
  /** Utilizador CRM (copiloto) — memória Mem0 por pessoa. */
  usuarioCrmId?: string | null;
  briefCiclo?: string;
}): Promise<BriefingChatReplyResult> {
  const tenantForTools = (params.tenantId && params.tenantId.trim()) || defaultTenantId();

  const { data: ferrIaRow } = await params.supabase
    .from("hub_agente_identidade")
    .select("motor_ferramentas_habilitado, uso_ferramentas_ia, modo_operacao")
    .eq("agente_slug", params.agenteSlug)
    .maybeSingle();

  const motorFerramentas =
    ferrIaRow?.motor_ferramentas_habilitado !== false &&
    (ferrIaRow?.motor_ferramentas_habilitado === true ||
      ferrIaRow?.modo_operacao === "jobs_internos" ||
      !ferrIaRow?.modo_operacao);
  const usoMap = mergeUsoFerramentasJobsInternos(
    mergeUsoFerramentasComPadraoPreservandoCustom(ferrIaRow?.uso_ferramentas_ia ?? {}),
    "jobs_internos"
  );
  const agentReasoningEnabled = agenteRaciocinioAvancadoAtivo(usoMap);

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

  const canalInterno: SuperagenteCanalInterno =
    params.canalInterno ??
    (params.trigger === "ciclo" ? "ciclo_programado" : "copiloto_crm");

  const triggerLinha = linhaCanalSuperagente(canalInterno, params.briefCiclo);

  let blocoMemoria = params.memoriasAgenteBloco?.trim() || "";
  try {
    const montado = await montarBlocoMemoriaSuperagenteInterno(params.supabase, {
      tenantId: tenantForTools,
      agenteSlug: params.agenteSlug,
      mensagemUsuario: params.mensagemUsuario,
      telefoneSessao: params.telefoneSessao,
      usuarioCrmId: params.usuarioCrmId,
      usoFerramentas: usoMap,
    });
    if (montado) {
      blocoMemoria = blocoMemoria ? `${blocoMemoria}\n\n${montado}` : montado;
    }
  } catch {
    /* memória opcional */
  }

  const preamble = copilotoInternoPreamble(params.agenteNome, params.cargo, escopoInterno);

  const skillsHarness = formatarBlocoSkillsHarness(
    gerarSkillsSuperagenteFromCargo(params.cargo, params.area)
  );

  const system = [
    preamble,
    triggerLinha,
    BLOCO_CANAIS_SUPERAGENTE_EQUIVALENTES,
    BLOCO_FERRAMENTAS_INTERNAS,
    BLOCO_SUPERAGENTE,
    skillsHarness || null,
    identity,
    params.memoriasAgenteBloco?.trim() || blocoMemoria || null,
    params.snapshot?.trim() || null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const mensagens: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of params.historico) {
    if (m.papel === "user") mensagens.push({ role: "user", content: m.conteudo });
    else mensagens.push({ role: "assistant", content: m.conteudo });
  }
  mensagens.push({ role: "user", content: params.mensagemUsuario });

  let customDefs: FerramentaCustomParaMistral[] = [];
  try {
    const rows = await fetchFerramentasCustomAtivas(params.supabase, tenantForTools);
    customDefs = rows.map(rowParaMistralDef);
  } catch {
    customDefs = [];
  }

  let extDefs: FerramentaExternaParaMistral[] = [];
  try {
    const extRows = await fetchFerramentasExternasAtivas(params.supabase, tenantForTools);
    extDefs = extRows.map(rowParaMistralDefExterna);
  } catch {
    extDefs = [];
  }

  let intDefs: FerramentaIntegradorDefMistral[] = [];
  try {
    const rows = await ferramentasIntegradorAtivasParaTenant(params.supabase, tenantForTools);
    intDefs = rows.map((r) => ({
      ferramenta_key: r.ferramenta_key,
      descricao_modelo: r.descricao_modelo,
      parametros_schema: r.parametros_schema,
    }));
  } catch {
    intDefs = [];
  }

  const mistralTools = ferramentasMistralListaParaAgente(usoMap, customDefs, extDefs, intDefs);
  const modeloResolved = resolveInferenceModelId(params.modelo);
  const temMistralKey = Boolean(process.env.MISTRAL_API_KEY?.trim());
  const podeToolsMistral =
    temMistralKey &&
    motorFerramentas &&
    mistralTools.length > 0 &&
    isMistralFamilyModelId(modeloResolved);

  let out:
    | Awaited<ReturnType<typeof completarChatComFerramentasMistral>>
    | Awaited<ReturnType<typeof completarChatPreferindoMistral>>
    | null = null;

  let urlsPublicasColetadas: string[] = [];

  if (podeToolsMistral) {
    out = await completarChatComFerramentasMistral({
      systemPrompt: system,
      mensagens,
      modeloFromDb: params.modelo,
      tools: mistralTools,
      maxTokens: 2048,
      agentReasoningEnabled,
      executarTool: async (nome, argumentosSerializados) => {
        const result = await executarFerramentaHub(nome, argumentosSerializados, {
          agenteSlug: params.agenteSlug,
          tenantId: tenantForTools,
          modoOperacao: "jobs_internos",
          agenteInterno: true,
          telefoneSessao: params.telefoneSessao ?? null,
          usuarioCrmId: params.usuarioCrmId ?? null,
        });
        if (
          nome === "hub_superagente_artefato" ||
          nome === "hub_relatorio_html_simples"
        ) {
          urlsPublicasColetadas.push(...extrairUrlsPublicasDeResultadoFerramenta(result));
        }
        return result;
      },
    });
  }

  if (!out?.ok) {
    const semTools = await completarChatPreferindoMistral({
      systemPrompt: system,
      mensagens,
      modeloFromDb: params.modelo,
      maxTokens: 2048,
      agentReasoningEnabled,
    });
    if (semTools.ok) out = semTools;
    else if (!out) out = semTools;
  }

  if (!out?.ok) throw new Error(out?.erro || "Falha ao gerar resposta do agente interno");

  try {
    await persistirMemoriaSuperagenteInterno(params.supabase, {
      tenantId: tenantForTools,
      agenteSlug: params.agenteSlug,
      mensagemUsuario: params.mensagemUsuario,
      respostaIA: out.texto,
      telefoneSessao: params.telefoneSessao,
      usuarioCrmId: params.usuarioCrmId,
      canalInterno,
      usoFerramentas: usoMap,
    });
  } catch {
    /* memória opcional */
  }

  const { brl } = calcularCustoBrl(out.modeloLog, out.tokensEntrada, out.tokensSaida);

  return {
    texto: out.texto,
    modelo: out.modeloLog,
    tokens_input: out.tokensEntrada,
    tokens_output: out.tokensSaida,
    custo_brl: brl,
    motor: params.trigger === "ciclo" ? "briefing_interno" : "briefing_interno",
    urls_publicas: urlsPublicasColetadas.length
      ? [...new Set(urlsPublicasColetadas)]
      : undefined,
  };
}

export function agenteInternoMotorDisponivel(
  ferrIaRow: { motor_ferramentas_habilitado?: boolean | null } | null | undefined
): boolean {
  return ferrIaRow?.motor_ferramentas_habilitado === true;
}

export function ehAgenteInternoOperacao(modoOperacao?: string | null): boolean {
  return agenteEhCopilotoInterno(
    isModoOperacaoAgente(modoOperacao) ? modoOperacao : null
  );
}
