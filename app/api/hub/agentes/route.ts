import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse, after } from "next/server";
import { runPlaybookPipeline } from "@/lib/playbook/orchestrate";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";
import { validateAndNormalizeCicloConfiguracoes } from "@/lib/hub-ciclos-configuracoes";
import {
  forceMistralModeloTripleForDb,
  isChkModeloValidoConstraintMessage,
  modeloColumnsForAgenteIdentidadeInsert,
} from "@/lib/ia/hub-model-defaults";
import {
  CONHECIMENTO_TITULO_INSERT,
  isConhecimentoSecaoId,
  ordemConhecimentoSecao,
} from "@/lib/hub/conhecimento-secoes";
import {
  cicloExecucaoPadraoFromModoOperacao,
  isCicloExecucaoPadrao,
  isModoOperacaoAgente,
  modoOperacaoFromCicloExecucao,
  type CicloExecucaoPadrao,
  type ModoOperacaoAgente,
} from "@/lib/hub/agente-modo-operacao";
import { serializarUsoFerramentasParaDb, syncHubAgenteParaMistral } from "@/lib/mistral/sync-hub-agent";
import {
  isHubAgenteFerramentasColumnsMissing,
  omitHubAgenteFerramentasMigrationKeys,
} from "@/lib/hub/hub-agente-ferramentas-columns";
import { sanitizarAgenteHubParaCliente } from "@/lib/hub/sanitize-agente-hub-public";
import { slugifyCargoSlug } from "@/lib/hub/cargo-slug";

function parseBoolFerr(v: unknown, defaultVal: boolean): boolean {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return defaultVal;
}

const CICLO_EXECUCAO_OPCOES = ["interacao", "tempo_real", "agenda"] as const;
type CicloExecucaoCliente = (typeof CICLO_EXECUCAO_OPCOES)[number];

function normCicloExecucao(v: unknown): CicloExecucaoCliente | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if ((CICLO_EXECUCAO_OPCOES as readonly string[]).includes(s)) return s as CicloExecucaoCliente;
  return null;
}

async function provisionHubCicloPadrao(
  supabase: SupabaseClient,
  agenteSlug: string,
  nomeAgente: string,
  modo: CicloExecucaoCliente,
  agendaIntervalMinutes: number
): Promise<{ aviso?: string; erro?: string }> {
  const rotulo = nomeAgente.trim().slice(0, 80) || agenteSlug;
  let nomeLinha = "Operação do agente";
  let tipo: string;
  let intervalo: number | null = null;
  let ativo = true;
  const baseCfg: Record<string, unknown> = {};

  if (modo === "interacao") {
    nomeLinha = "Sob interação";
    tipo = "gatilho";
    ativo = true;
    baseCfg.ciclo_origem_provisionamento = "wizard_agente_v1";
  } else if (modo === "tempo_real") {
    nomeLinha = "Automático contínuo";
    tipo = "continuo";
    ativo = true;
    baseCfg.ciclo_origem_provisionamento = "wizard_agente_v1";
  } else {
    nomeLinha = "Cadência na agenda";
    tipo = "programado";
    intervalo = agendaIntervalMinutes;
    ativo = false;
    baseCfg.ciclo_origem_provisionamento = "wizard_agente_v1";
    baseCfg.dispatch_pendente = true;
    baseCfg.dica =
      "Defina configuracoes.dispatch { api: diretor|gerente, ciclo: <chave do runner> } antes de ativar.";
  }

  const descricao =
    modo === "interacao"
      ? "Dispara com interação no canal (mensagem do utilizador / webhook)."
      : modo === "tempo_real"
        ? "Atrelado ao motor em tempo real (sem ciclo cron dedicado)."
        : `Cadência definida ao criar o agente (≈ cada ${intervalo} min após dispatch e ativação).`;

  const parsedCfg = validateAndNormalizeCicloConfiguracoes(baseCfg);
  if (!parsedCfg.ok) {
    return { erro: parsedCfg.error };
  }

  const row = {
    agente_slug: agenteSlug,
    nome: nomeLinha,
    descricao: `${descricao} — Agente «${rotulo}»`,
    tipo,
    cron_expressao: null,
    intervalo_minutos: intervalo,
    ativo,
    configuracoes: parsedCfg.value,
  };

  const { error } = await supabase.from("hub_ciclos_ia").insert(row as Record<string, unknown>);
  if (error) return { erro: error.message };

  const aviso =
    modo === "agenda"
      ? "Criámos uma linha em hub_ciclos_ia tipo programado em pausa: configure configuracoes.dispatch e ative antes de o dispatcher usar este ciclo para este agente."
      : modo === "tempo_real"
        ? "Ciclo contínuo registado só para operações no CRM; o cron /api/cron/dispatch-ciclos só trata tipo programado."
        : undefined;

  return { aviso };
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isTenantColumnMissing(message?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  if (!m.includes("tenant_id") || !m.includes("hub_agente_identidade")) {
    return false;
  }
  // Postgres: "column ... does not exist"; PostgREST: "schema cache"
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find")
  );
}

function linhasArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function montarPromptBaseDoCargo(params: {
  nomeAgente: string;
  tituloCargo: string;
  promptTemplate?: unknown;
  descricao?: unknown;
  saudacaoCliente?: unknown;
  usarPerguntasEssenciais?: unknown;
  ordemPerguntasEssenciais?: unknown;
  perguntasEssenciais?: unknown;
  comprimentoPadrao?: unknown;
}): string {
  const promptTemplate = String(params.promptTemplate ?? "").trim();
  const descricao = String(params.descricao ?? "").trim();
  const saudacaoCliente = String(params.saudacaoCliente ?? "").trim();
  const comprimentoPadrao = String(params.comprimentoPadrao ?? "").trim();
  const ordemPerguntas = params.ordemPerguntasEssenciais === "final" ? "final" : "inicio";
  const perguntasEssenciais = linhasArray(params.perguntasEssenciais);
  const usarPerguntas = params.usarPerguntasEssenciais === true && perguntasEssenciais.length > 0;

  const secoes: string[] = [];
  secoes.push(
    `Agente ${params.nomeAgente} em atendimento externo. Use o cargo ${params.tituloCargo} apenas como guia interno de operação.`
  );

  if (promptTemplate) {
    secoes.push(`## Operação base do cargo\n${promptTemplate}`);
  } else if (descricao) {
    secoes.push(`## Operação base do cargo\n${descricao}`);
  }

  if (saudacaoCliente || comprimentoPadrao || usarPerguntas) {
    const blocoAtendimento: string[] = [];
    blocoAtendimento.push("## Regras de atendimento em canal externo");
    blocoAtendimento.push(
      "- Nunca diga ao cliente o nome do cargo/função interna (ex.: qualificadora, SDR, closer)."
    );
    blocoAtendimento.push("- Faça perguntas de qualificação naturalmente, sem anunciar processo interno.");
    if (saudacaoCliente) blocoAtendimento.push(`- Saudação padrão: "${saudacaoCliente}"`);
    if (comprimentoPadrao) blocoAtendimento.push(`- Comprimento padrão: ${comprimentoPadrao}`);
    if (usarPerguntas) {
      blocoAtendimento.push(
        `- Aplicar perguntas essenciais no ${ordemPerguntas === "final" ? "final" : "início"} da conversa.`
      );
      blocoAtendimento.push("- Sequência de perguntas essenciais (ordem preferencial):");
      for (const [idx, pergunta] of perguntasEssenciais.entries()) {
        blocoAtendimento.push(`  ${idx + 1}. ${pergunta}`);
      }
    }
    secoes.push(blocoAtendimento.join("\n"));
  }

  if (!promptTemplate && !descricao) {
    secoes.push(
      "Siga as regras do Obra10+, responda com clareza, sem inventar informações, e escale decisões críticas para humano."
    );
  }

  return secoes.join("\n\n").trim();
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const { searchParams } = new URL(request.url);
  const ativo = searchParams.get("ativo");
  const todos = searchParams.get("todos") === "true";
  /** `somente` = linhas com arquivado_em preenchido (exclui ativos/inativos “de produção”). */
  const arquivados = searchParams.get("arquivados");
  const tenantId = tenantIdFromRequest(request.headers);

  async function executarConsulta(aplicarTenant: boolean) {
    let query = supabase
      .from("hub_agente_identidade")
      .select("*")
      .order("nivel")
      .order("nome");

    if (aplicarTenant) {
      query = query.eq("tenant_id", tenantId);
    }

    if (todos) {
      // Inclui ativos, inativos e arquivados.
    } else if (arquivados === "somente") {
      query = query.not("arquivado_em", "is", null);
    } else {
      query = query.is("arquivado_em", null);
      if (ativo === "false") {
        query = query.eq("ativo", false);
      } else {
        query = query.eq("ativo", true);
      }
    }

    return await query;
  }

  let { data, error } = await executarConsulta(true);

  // Compatibilidade com bases antigas que ainda não têm tenant_id.
  if (error && isTenantColumnMissing(error.message)) {
    ({ data, error } = await executarConsulta(false));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map((row) => sanitizarAgenteHubParaCliente(row as Record<string, unknown>)));
}

export async function POST(request: NextRequest) {
  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const {
    cargo_slug,
    nome,
    personalidade,
    prefixo_mercado,
    bio,
    horario_inicio,
    horario_fim,
    dias_semana,
    system_prompt_base,
    tom_voz,
    estilo_comunicacao,
    avatar_url,
  } = body as {
    cargo_slug?: string;
    nome?: string;
    personalidade?: string;
    prefixo_mercado?: string;
    bio?: string;
    horario_inicio?: string;
    horario_fim?: string;
    dias_semana?: unknown;
    system_prompt_base?: string;
    tom_voz?: string;
    estilo_comunicacao?: string;
    avatar_url?: string;
  };

  if (!cargo_slug || !nome) {
    return NextResponse.json(
      { error: "cargo_slug e nome são obrigatórios." },
      { status: 400 }
    );
  }

  const { data: cat, error: catErr } = await supabase
    .from("hub_cargos_catalogo")
    .select(
      "slug, titulo, area, nivel, modelo_padrao, modelo_critico, modelo_alto_valor, supervisor_slug, pode_fazer_padrao, nao_pode_fazer_padrao, prompt_template, descricao, saudacao_cliente, usar_perguntas_essenciais, ordem_perguntas_essenciais, perguntas_essenciais, comprimento_padrao"
    )
    .eq("slug", cargo_slug)
    .eq("ativo", true)
    .maybeSingle();

  if (catErr) {
    return NextResponse.json({ error: catErr.message }, { status: 500 });
  }
  if (!cat) {
    return NextResponse.json(
      { error: `Cargo "${cargo_slug}" não encontrado em hub_cargos_catalogo (ativo).` },
      { status: 400 }
    );
  }

  const nivel = typeof cat.nivel === "number" ? cat.nivel : Number(cat.nivel) || 3;
  const promptBase =
    (system_prompt_base && String(system_prompt_base).trim()) ||
    montarPromptBaseDoCargo({
      nomeAgente: String(nome).trim(),
      tituloCargo: String(cat.titulo ?? "").trim(),
      promptTemplate: cat.prompt_template,
      descricao: cat.descricao,
      saudacaoCliente: cat.saudacao_cliente,
      usarPerguntasEssenciais: cat.usar_perguntas_essenciais,
      ordemPerguntasEssenciais: cat.ordem_perguntas_essenciais,
      perguntasEssenciais: cat.perguntas_essenciais,
      comprimentoPadrao: cat.comprimento_padrao,
    });

  // Gerar slug único
  const baseSlug = slugifyCargoSlug(nome);
  let agente_slug = baseSlug;
  let sufixo = 2;

  while (true) {
    const { data: existing } = await supabase
      .from("hub_agente_identidade")
      .select("agente_slug")
      .eq("agente_slug", agente_slug)
      .maybeSingle();

    if (!existing) break;

    agente_slug = `${baseSlug.slice(0, 37)}_${sufixo}`;
    sufixo++;
  }

  const podeFazer = Array.isArray(cat.pode_fazer_padrao) ? cat.pode_fazer_padrao : [];
  const naoPode = Array.isArray(cat.nao_pode_fazer_padrao) ? cat.nao_pode_fazer_padrao : [];

  const diaLabels = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  const rawDias = Array.isArray(dias_semana) ? (dias_semana as unknown[]) : [0, 1, 2, 3, 4, 5, 6];
  const diasParsed = rawDias
    .map((d) => {
      const n = typeof d === "number" ? d : parseInt(String(d), 10);
      return Number.isFinite(n) && n >= 0 && n <= 6 ? diaLabels[n] : null;
    })
    .filter((x): x is string => x != null);
  const diasTexto = [...new Set(diasParsed)];

  const modeloCols = modeloColumnsForAgenteIdentidadeInsert(cat as Record<string, unknown>);

  const row: Record<string, unknown> = {
    agente_slug,
    nome: nome.trim(),
    cargo: cat.titulo as string,
    area: (cat.area as string) || "geral",
    nivel,
    personalidade: (personalidade && String(personalidade).trim()) || "## Tom\n\nTom alinhado ao cargo.",
    tom_voz: (tom_voz && String(tom_voz).trim()) || "profissional e cordial",
    estilo_comunicacao: (estilo_comunicacao && String(estilo_comunicacao).trim()) || "Direto",
    system_prompt_base: promptBase,
    ...modeloCols,
    pode_fazer: podeFazer,
    nao_pode_fazer: naoPode,
    sempre_dizer: [],
    nunca_dizer: [],
    prefixo_mercado: (prefixo_mercado && String(prefixo_mercado).trim()) || "GRL",
    bio: (bio && String(bio).trim()) || null,
    horario_inicio: horario_inicio || "08:00:00",
    horario_fim: horario_fim || "22:00:00",
    dias_semana: diasTexto.length > 0 ? diasTexto : ["seg", "ter", "qua", "qui", "sex"],
    ativo: true,
    tenant_id: tenantId || defaultTenantId(),
  };

  const ciclo_modoCliente = normCicloExecucao(body.ciclo_execucao);
  const modoOperacaoBody = isModoOperacaoAgente(body.modo_operacao)
    ? (body.modo_operacao as ModoOperacaoAgente)
    : ciclo_modoCliente != null
      ? modoOperacaoFromCicloExecucao(ciclo_modoCliente)
      : null;
  const cicloExecPadrao: CicloExecucaoPadrao | null =
    ciclo_modoCliente ??
    (modoOperacaoBody != null ? cicloExecucaoPadraoFromModoOperacao(modoOperacaoBody) : null);
  if (modoOperacaoBody != null) {
    row.modo_operacao = modoOperacaoBody;
  }
  if (cicloExecPadrao != null) {
    row.ciclo_execucao_padrao = cicloExecPadrao;
  } else if (isCicloExecucaoPadrao(body.ciclo_execucao_padrao)) {
    row.ciclo_execucao_padrao = body.ciclo_execucao_padrao;
    if (modoOperacaoBody == null) {
      row.modo_operacao = modoOperacaoFromCicloExecucao(body.ciclo_execucao_padrao);
    }
  }
  let agendaMinutes = Number.parseInt(String(body.ciclo_intervalo_minutos ?? ""), 10);
  if (!Number.isFinite(agendaMinutes) || agendaMinutes <= 0) agendaMinutes = 60;
  if (agendaMinutes > 10080) agendaMinutes = 10080;

  const motorFerramentasHub = parseBoolFerr(body.motor_ferramentas_habilitado, false);
  const mistralAgentSyncHabilitado = parseBoolFerr(body.mistral_agent_sync_habilitado, false);

  const avatarTrim = avatar_url != null ? String(avatar_url).trim() : "";
  if (avatarTrim.length > 600_000) {
    return NextResponse.json(
      { error: "avatar_url excede o tamanho máximo permitido." },
      { status: 400 }
    );
  }
  if (avatarTrim.length > 0) {
    row.avatar_url = avatarTrim;
  }

  row.motor_ferramentas_habilitado = motorFerramentasHub;
  row.mistral_agent_sync_habilitado = mistralAgentSyncHabilitado;
  row.uso_ferramentas_ia = serializarUsoFerramentasParaDb(body.uso_ferramentas_ia);

  let rowInsert: Record<string, unknown> = row;
  let { data, error } = await supabase
    .from("hub_agente_identidade")
    .insert(rowInsert)
    .select()
    .single();

  // Compatibilidade com bases antigas que ainda não têm tenant_id.
  if (error && isTenantColumnMissing(error.message)) {
    const { tenant_id, ...rowWithoutTenant } = rowInsert;
    rowInsert = rowWithoutTenant;
    ({ data, error } = await supabase
      .from("hub_agente_identidade")
      .insert(rowInsert)
      .select()
      .single());
  }

  if (error && isHubAgenteFerramentasColumnsMissing(error.message)) {
    console.warn(
      "[hub/agentes] hub_agente_identidade sem colunas ferramentas/Mistral; aplicar 20260516120000_hub_agente_ferramentas_mistral. Retrying insert."
    );
    rowInsert = omitHubAgenteFerramentasMigrationKeys(rowInsert);
    ({ data, error } = await supabase
      .from("hub_agente_identidade")
      .insert(rowInsert)
      .select()
      .single());
  }

  if (error && isChkModeloValidoConstraintMessage(error.message)) {
    console.warn(
      "[hub/agentes] chk_modelo_valido no insert — a forçar mistral nos três campos e a repetir (catálogo com formato estranho ou CHECK desalinhado)."
    );
    rowInsert = { ...rowInsert, ...forceMistralModeloTripleForDb() };
    ({ data, error } = await supabase
      .from("hub_agente_identidade")
      .insert(rowInsert)
      .select()
      .single());

    if (error && isTenantColumnMissing(error.message)) {
      const { tenant_id, ...rowWithoutTenant } = rowInsert;
      rowInsert = rowWithoutTenant;
      ({ data, error } = await supabase
        .from("hub_agente_identidade")
        .insert(rowInsert)
        .select()
        .single());
    }
    if (error && isHubAgenteFerramentasColumnsMissing(error.message)) {
      rowInsert = omitHubAgenteFerramentasMigrationKeys(rowInsert);
      ({ data, error } = await supabase
        .from("hub_agente_identidade")
        .insert(rowInsert)
        .select()
        .single());
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const created = data as { agente_slug: string };

  const rawConhecimento = body.conhecimento_secoes;
  if (rawConhecimento && typeof rawConhecimento === "object" && !Array.isArray(rawConhecimento)) {
    const rows: Array<Record<string, unknown>> = [];
    for (const [key, val] of Object.entries(rawConhecimento as Record<string, unknown>)) {
      if (!isConhecimentoSecaoId(key)) continue;
      const conteudo = String(val ?? "").trim();
      if (!conteudo) continue;
      rows.push({
        agente_slug: created.agente_slug,
        secao: key,
        titulo: CONHECIMENTO_TITULO_INSERT[key],
        conteudo,
        ordem: ordemConhecimentoSecao(key),
        ativo: true,
      });
    }
    if (rows.length > 0) {
      const { error: kcErr } = await supabase.from("hub_agente_conhecimento").insert(rows);
      if (kcErr) {
        console.error(
          "[crm] hub_agente_conhecimento ao criar agente:",
          created.agente_slug,
          kcErr.message
        );
      }
    }
  }

  after(async () => {
    try {
      const out = await runPlaybookPipeline(supabase, created.agente_slug);
      if (!out.ok) {
        console.error("[playbook] pós-criação agente:", created.agente_slug, out.error);
      }
      if (mistralAgentSyncHabilitado) {
        const syn = await syncHubAgenteParaMistral(supabase, created.agente_slug);
        if (!syn.ok) {
          console.warn("[mistral-agents] pós-criação sync:", created.agente_slug, syn.error);
        }
      }
    } catch (e) {
      console.error("[playbook/mistral] pós-criação agente (exceção):", created.agente_slug, e);
    }
  });

  let ciclo_aviso: string | undefined;
  let ciclo_erro: string | undefined;

  const rawVincular = body.ciclos_vincular_ids;
  const ciclosVincular =
    Array.isArray(rawVincular)
      ? rawVincular
          .map((x) => (typeof x === "string" ? x.trim() : ""))
          .filter((id) => id.length > 0)
      : [];

  if (ciclo_modoCliente != null && body.omit_hub_ciclo_padrao !== true) {
    const out = await provisionHubCicloPadrao(
      supabase,
      created.agente_slug,
      String(body.nome || "").trim() || created.agente_slug,
      ciclo_modoCliente,
      agendaMinutes
    );
    ciclo_aviso = out.aviso;
    ciclo_erro = out.erro;
    if (ciclo_erro) console.error("[crm] ciclo provisionado após criar agente:", created.agente_slug, ciclo_erro);
    if (ciclo_aviso) console.info("[crm] ciclo nota:", created.agente_slug, ciclo_aviso);
  }

  if (ciclosVincular.length > 0) {
    const { error: vErr } = await supabase
      .from("hub_ciclos_ia")
      .update({ agente_slug: created.agente_slug })
      .in("id", ciclosVincular);
    if (vErr) {
      ciclo_erro = ciclo_erro ? `${ciclo_erro}; ${vErr.message}` : vErr.message;
      console.error("[crm] falha ao vincular ciclos ao agente:", created.agente_slug, vErr.message);
    } else {
      const msg = `${ciclosVincular.length} ciclo(s) em hub_ciclos_ia passaram a usar o slug deste agente.`;
      ciclo_aviso = ciclo_aviso ? `${ciclo_aviso} ${msg}` : msg;
    }
  }

  return NextResponse.json(
    {
      ...sanitizarAgenteHubParaCliente(data as Record<string, unknown>),
      ...(ciclo_aviso ? { ciclo_aviso } : {}),
      ...(ciclo_erro ? { ciclo_erro } : {}),
    },
    { status: 201 }
  );
}
