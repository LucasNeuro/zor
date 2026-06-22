import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse, after } from "next/server";
import { runPlaybookPipeline } from "@/lib/playbook/orchestrate";
import { isTenantFkError } from "@/lib/tenant-default";
import { resolveValidatedTenantId } from "@/lib/crm/resolve-tenant-from-caller";
import {
  provisionHubCicloPadrao,
  type CicloExecucaoCliente,
} from "@/lib/hub/provision-hub-ciclo-padrao";
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
import { insertHubAgenteIdentidadeCompat } from "@/lib/hub/hub-agente-schema-compat";
import { sanitizarAgenteHubParaCliente } from "@/lib/hub/sanitize-agente-hub-public";
import { PROMPT_BASE_PLAYBOOK_ONLY, CARGO_LABEL_PLAYBOOK_ONLY } from "@/lib/hub/agente-instrucao-modo";
import { slugifyCargoSlug } from "@/lib/hub/cargo-slug";
import { MERCADO_PREFIXO_PADRAO } from "@/lib/crm/negocio-cadastro";
import { gerarAvatarAgenteUrl } from "@/lib/crm/agente-avatar-gen";
import {
  applyWaConversacaoPreset,
  isWaPresetId,
  waPresetHintsParaCriacao,
  type WaPresetId,
} from "@/lib/hub/presets/wa-conversacao-preset";
import { mergeUsoFerramentasWhatsappCanal } from "@/lib/hub/agente-ferramentas-registry";
import { applyCargoTenantFilter } from "@/lib/hub/cargo-catalogo-tenant";
import {
  EMAIL_CHANNEL_DISABLED_CODE,
  EMAIL_CHANNEL_DISABLED_MESSAGE,
  isEmailChannelEnabled,
} from "@/lib/feature-flags";

function parseBoolFerr(v: unknown, defaultVal: boolean): boolean {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return defaultVal;
}

const CICLO_EXECUCAO_OPCOES = ["interacao", "tempo_real", "agenda"] as const;

function normCicloExecucao(v: unknown): CicloExecucaoCliente | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  if ((CICLO_EXECUCAO_OPCOES as readonly string[]).includes(s)) return s as CicloExecucaoCliente;
  return null;
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isInstrucaoModoColumnMissing(message?: string): boolean {
  const msg = String(message ?? "").toLowerCase();
  return msg.includes("instrucao_modo") && (msg.includes("column") || msg.includes("does not exist"));
}

function isCargoCatalogoValidationError(message?: string): boolean {
  return /catalogo ativo|hub_cargos_catalogo/i.test(String(message ?? ""));
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

function isArquivadoColumnMissing(message?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  if (!m.includes("arquivado_em") || !m.includes("hub_agente_identidade")) return false;
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
      "Siga as regras da operação Waje, responda com clareza, sem inventar informações, e escale decisões críticas para humano."
    );
  }

  return secoes.join("\n\n").trim();
}

function montarBioDoCargo(params: {
  tituloCargo: string;
  descricaoCurta?: unknown;
  saudacaoCliente?: unknown;
}): string {
  const titulo = String(params.tituloCargo ?? "").trim();
  const descricaoCurta = String(params.descricaoCurta ?? "").trim();
  const saudacao = String(params.saudacaoCliente ?? "").trim();
  if (descricaoCurta) return descricaoCurta.slice(0, 200);
  if (saudacao) return saudacao.slice(0, 200);
  return (titulo ? `Atendimento orientado pelo cargo ${titulo}.` : "Atendimento orientado por cargo.").slice(0, 200);
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const { searchParams } = new URL(request.url);
  const ativo = searchParams.get("ativo");
  const todos = searchParams.get("todos") === "true";
  /** `somente` = linhas com arquivado_em preenchido (exclui ativos/inativos “de produção”). */
  const arquivados = searchParams.get("arquivados");
  const tenantResolved = await resolveValidatedTenantId(request);
  if (!tenantResolved.ok) {
    return NextResponse.json([]);
  }
  const tenantId = tenantResolved.tenantId;

  async function executarConsulta(aplicarTenant: boolean, filtrarArquivados: boolean) {
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
    } else if (filtrarArquivados && arquivados === "somente") {
      query = query.not("arquivado_em", "is", null);
    } else if (filtrarArquivados) {
      query = query.is("arquivado_em", null);
      if (ativo === "false") {
        query = query.eq("ativo", false);
      } else {
        query = query.eq("ativo", true);
      }
    } else if (arquivados === "somente") {
      // Sem coluna arquivado_em: nenhum agente “só arquivados”.
      query = query.eq("agente_slug", "__nenhum_arquivado__");
    } else if (ativo === "false") {
      query = query.eq("ativo", false);
    } else {
      query = query.eq("ativo", true);
    }

    return await query;
  }

  let aplicarTenant = true;
  let filtrarArquivados = true;
  let { data, error } = await executarConsulta(aplicarTenant, filtrarArquivados);

  if (error && isArquivadoColumnMissing(error.message)) {
    filtrarArquivados = false;
    ({ data, error } = await executarConsulta(aplicarTenant, filtrarArquivados));
  }

  if (error && isTenantColumnMissing(error.message)) {
    aplicarTenant = false;
    ({ data, error } = await executarConsulta(aplicarTenant, filtrarArquivados));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map((row) => sanitizarAgenteHubParaCliente(row as Record<string, unknown>)));
}

export async function POST(request: NextRequest) {
  const supabase = db();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const bodyTenantId =
    typeof body.tenant_id === "string" ? body.tenant_id : undefined;
  const tenantResolved = await resolveValidatedTenantId(request, { bodyTenantId });
  if (!tenantResolved.ok) {
    return NextResponse.json({ error: tenantResolved.error }, { status: tenantResolved.status });
  }
  const tenantId = tenantResolved.tenantId;

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
    playbook_only,
    modo_instrucao,
    playbook_object_path,
    playbook_public_url,
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
    playbook_only?: boolean;
    modo_instrucao?: string;
    playbook_object_path?: string;
    playbook_public_url?: string;
  };

  const waPresetRaw = body.wa_preset ?? body.preset_wa;
  const waPresetAtivo =
    waPresetRaw === true ||
    waPresetRaw === "true" ||
    (typeof waPresetRaw === "string" && isWaPresetId(waPresetRaw));
  const waPresetId: WaPresetId =
    typeof waPresetRaw === "string" && isWaPresetId(waPresetRaw)
      ? waPresetRaw
      : "conversacao_universal";
  const waHints = waPresetAtivo ? waPresetHintsParaCriacao() : null;

  const playbookOnly =
    playbook_only === true ||
    modo_instrucao === "playbook_only" ||
    modo_instrucao === "playbook-only";
  const cargoSlugTrim =
    cargo_slug != null
      ? String(cargo_slug).trim()
      : waHints?.cargo_slug ?? "";
  const nomeTrim = nome != null ? String(nome).trim() : "";

  if (!nomeTrim) {
    return NextResponse.json({ error: "nome é obrigatório." }, { status: 400 });
  }
  if (playbookOnly && cargoSlugTrim) {
    return NextResponse.json(
      { error: "Modo playbook-only: não envie cargo_slug." },
      { status: 400 }
    );
  }
  if (!playbookOnly && !cargoSlugTrim) {
    return NextResponse.json(
      { error: "cargo_slug é obrigatório (ou envie playbook_only: true)." },
      { status: 400 }
    );
  }

  const diaLabels = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  const rawDias = Array.isArray(dias_semana) ? (dias_semana as unknown[]) : [0, 1, 2, 3, 4, 5, 6];
  const diasParsed = rawDias
    .map((d) => {
      const n = typeof d === "number" ? d : parseInt(String(d), 10);
      return Number.isFinite(n) && n >= 0 && n <= 6 ? diaLabels[n] : null;
    })
    .filter((x): x is string => x != null);
  const diasTexto = [...new Set(diasParsed)];

  const baseSlug = slugifyCargoSlug(nomeTrim);
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

  let row: Record<string, unknown>;

  if (playbookOnly) {
    const playbookPath =
      playbook_object_path != null ? String(playbook_object_path).trim() : "";
    const playbookUrl =
      playbook_public_url != null ? String(playbook_public_url).trim() : "";
    const promptBasePlaybook =
      (system_prompt_base && String(system_prompt_base).trim()) || PROMPT_BASE_PLAYBOOK_ONLY;

    row = {
      agente_slug,
      nome: nomeTrim,
      cargo: CARGO_LABEL_PLAYBOOK_ONLY,
      area: "playbook",
      instrucao_modo: "playbook_only",
      nivel: 3,
      personalidade:
        (personalidade && String(personalidade).trim()) ||
        "## Tom\n\nTom alinhado ao playbook publicado no bucket.",
      tom_voz: (tom_voz && String(tom_voz).trim()) || "profissional e cordial",
      estilo_comunicacao: (estilo_comunicacao && String(estilo_comunicacao).trim()) || "Direto",
      system_prompt_base: promptBasePlaybook,
      ...forceMistralModeloTripleForDb(),
      pode_fazer: [],
      nao_pode_fazer: [],
      sempre_dizer: [],
      nunca_dizer: [],
      prefixo_mercado: (prefixo_mercado && String(prefixo_mercado).trim()) || MERCADO_PREFIXO_PADRAO,
      bio:
        (bio && String(bio).trim()) ||
        "Agente operado pelo playbook publicado em hub-agent-playbooks (sem catálogo de cargo).",
      horario_inicio: horario_inicio || "08:00:00",
      horario_fim: horario_fim || "22:00:00",
      dias_semana: diasTexto.length > 0 ? diasTexto : ["seg", "ter", "qua", "qui", "sex"],
      ativo: true,
      tenant_id: tenantId,
    };
    if (playbookPath) row.playbook_object_path = playbookPath;
    if (playbookUrl) row.playbook_public_url = playbookUrl;
  } else {
  const { data: cat, error: catErr } = await applyCargoTenantFilter(
    supabase
      .from("hub_cargos_catalogo")
      .select(
        "slug, titulo, descricao_curta, area, nivel, modelo_padrao, modelo_critico, modelo_alto_valor, supervisor_slug, pode_fazer_padrao, nao_pode_fazer_padrao, prompt_template, descricao, saudacao_cliente, usar_perguntas_essenciais, ordem_perguntas_essenciais, perguntas_essenciais, comprimento_padrao"
      )
      .eq("slug", cargoSlugTrim)
      .eq("ativo", true),
    tenantId
  ).maybeSingle();

  if (catErr) {
    return NextResponse.json({ error: catErr.message }, { status: 500 });
  }
  if (!cat) {
    return NextResponse.json(
      { error: `Cargo "${cargoSlugTrim}" não encontrado em hub_cargos_catalogo (ativo).` },
      { status: 400 }
    );
  }

  const nivel = typeof cat.nivel === "number" ? cat.nivel : Number(cat.nivel) || 3;
  const promptBase =
    (system_prompt_base && String(system_prompt_base).trim()) ||
    montarPromptBaseDoCargo({
      nomeAgente: nomeTrim,
      tituloCargo: String(cat.titulo ?? "").trim(),
      promptTemplate: cat.prompt_template,
      descricao: cat.descricao,
      saudacaoCliente: cat.saudacao_cliente,
      usarPerguntasEssenciais: cat.usar_perguntas_essenciais,
      ordemPerguntasEssenciais: cat.ordem_perguntas_essenciais,
      perguntasEssenciais: cat.perguntas_essenciais,
      comprimentoPadrao: cat.comprimento_padrao,
    });

  const podeFazer = Array.isArray(cat.pode_fazer_padrao) ? cat.pode_fazer_padrao : [];
  const naoPode = Array.isArray(cat.nao_pode_fazer_padrao) ? cat.nao_pode_fazer_padrao : [];

  const modeloCols = modeloColumnsForAgenteIdentidadeInsert(cat as Record<string, unknown>);

  row = {
    agente_slug,
    nome: nomeTrim,
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
    prefixo_mercado: (prefixo_mercado && String(prefixo_mercado).trim()) || MERCADO_PREFIXO_PADRAO,
    bio:
      (bio && String(bio).trim()) ||
      montarBioDoCargo({
        tituloCargo: String(cat.titulo ?? "").trim(),
        descricaoCurta: cat.descricao_curta,
        saudacaoCliente: cat.saudacao_cliente,
      }),
    horario_inicio: horario_inicio || "08:00:00",
    horario_fim: horario_fim || "22:00:00",
    dias_semana: diasTexto.length > 0 ? diasTexto : ["seg", "ter", "qua", "qui", "sex"],
    ativo: true,
    tenant_id: tenantId,
  };
  }

  const ciclo_modoCliente = normCicloExecucao(
    body.ciclo_execucao ?? (waHints ? waHints.ciclo_execucao : undefined)
  );
  const modoOperacaoBody = isModoOperacaoAgente(body.modo_operacao)
    ? (body.modo_operacao as ModoOperacaoAgente)
    : waHints
      ? waHints.modo_operacao
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

  const modoFinal = typeof row.modo_operacao === "string" ? row.modo_operacao : null;
  if (modoFinal === "canal_email" && !isEmailChannelEnabled()) {
    return NextResponse.json(
      { error: EMAIL_CHANNEL_DISABLED_MESSAGE, code: EMAIL_CHANNEL_DISABLED_CODE },
      { status: 403 }
    );
  }

  let agendaMinutes = Number.parseInt(String(body.ciclo_intervalo_minutos ?? ""), 10);
  if (!Number.isFinite(agendaMinutes) || agendaMinutes <= 0) agendaMinutes = 60;
  if (agendaMinutes > 10080) agendaMinutes = 10080;

  const motorFerramentasHub = parseBoolFerr(
    body.motor_ferramentas_habilitado,
    waHints?.motor_ferramentas_habilitado ?? false
  );
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
  } else if (typeof row.nome === "string" && row.nome.trim() && typeof row.agente_slug === "string") {
    row.avatar_url = gerarAvatarAgenteUrl(row.nome.trim(), row.agente_slug);
  }

  row.motor_ferramentas_habilitado = motorFerramentasHub;
  row.mistral_agent_sync_habilitado = mistralAgentSyncHabilitado;
  const usoFerramentasMerged = waHints
    ? mergeUsoFerramentasWhatsappCanal(
        {
          ...(waHints.uso_ferramentas_ia as Record<string, boolean>),
          ...((body.uso_ferramentas_ia as Record<string, boolean> | undefined) ?? {}),
        },
        waHints.modo_operacao
      )
    : body.uso_ferramentas_ia;
  row.uso_ferramentas_ia = serializarUsoFerramentasParaDb(usoFerramentasMerged);

  let modeloForcado = false;
  const { data, error } = await insertHubAgenteIdentidadeCompat(supabase, row, {
    onBeforeRetry: (rowInsert, reason) => {
      if (!modeloForcado && isChkModeloValidoConstraintMessage(reason)) {
        modeloForcado = true;
        console.warn(
          "[hub/agentes] chk_modelo_valido no insert — a forçar mistral nos três campos e a repetir."
        );
        return { ...rowInsert, ...forceMistralModeloTripleForDb() };
      }
      return rowInsert;
    },
  });

  if (error && isCargoCatalogoValidationError(error.message) && playbookOnly) {
    return NextResponse.json(
      {
        error:
          "Modo «só playbook» ainda não está liberado no Supabase. Execute a migração supabase/migrations/20260601180000_hub_agente_playbook_only_cargo.sql no SQL Editor e tente novamente.",
      },
      { status: 400 }
    );
  }

  if (error) {
    if (isTenantFkError(error)) {
      return NextResponse.json(
        {
          error:
            "Tenant inválido para criar o agente. Verifique o cadastro da empresa ou as variáveis DEFAULT_TENANT_ID / NEXT_PUBLIC_TENANT_ID no servidor.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const created = data as { agente_slug: string; tenant_id?: string | null };
  const tenantCiclo =
    (typeof created.tenant_id === "string" && created.tenant_id.trim()) || tenantId;

  const rawConhecimentoBase =
    body.conhecimento_secoes && typeof body.conhecimento_secoes === "object" && !Array.isArray(body.conhecimento_secoes)
      ? (body.conhecimento_secoes as Record<string, unknown>)
      : {};
  const rawConhecimento =
    waHints?.conhecimento_secoes != null
      ? { ...waHints.conhecimento_secoes, ...rawConhecimentoBase }
      : Object.keys(rawConhecimentoBase).length > 0
        ? rawConhecimentoBase
        : null;
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
      if (!waPresetAtivo) {
        const out = await runPlaybookPipeline(supabase, created.agente_slug);
        if (!out.ok) {
          console.error("[playbook] pós-criação agente:", created.agente_slug, out.error);
        }
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

  const modoProvisionar: CicloExecucaoCliente | null =
    ciclo_modoCliente ??
    cicloExecPadrao ??
    (modoOperacaoBody != null ? cicloExecucaoPadraoFromModoOperacao(modoOperacaoBody) : null);

  if (modoProvisionar != null && body.omit_hub_ciclo_padrao !== true) {
    const out = await provisionHubCicloPadrao(
      supabase,
      created.agente_slug,
      String(body.nome || "").trim() || created.agente_slug,
      modoProvisionar,
      agendaMinutes,
      tenantCiclo
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

  let wa_preset_result: Awaited<ReturnType<typeof applyWaConversacaoPreset>> | undefined;
  if (waPresetAtivo && modoOperacaoBody === "canal_whatsapp") {
    wa_preset_result = await applyWaConversacaoPreset(supabase, created.agente_slug, {
      presetId: waPresetId,
      publicarPlaybook: body.wa_preset_publicar_playbook !== false,
      sincronizarCargo: false,
    });
    if (!wa_preset_result.ok) {
      ciclo_erro = ciclo_erro
        ? `${ciclo_erro}; preset WA: ${wa_preset_result.error}`
        : `preset WA: ${wa_preset_result.error}`;
    } else if (wa_preset_result.ciclo_followup_criado) {
      const msg = "Preset WA: ciclo follow-up criado (activar em CRM → Ciclos).";
      ciclo_aviso = ciclo_aviso ? `${ciclo_aviso} ${msg}` : msg;
    }
  }

  return NextResponse.json(
    {
      ...sanitizarAgenteHubParaCliente(data as Record<string, unknown>),
      ...(ciclo_aviso ? { ciclo_aviso } : {}),
      ...(ciclo_erro ? { ciclo_erro } : {}),
      ...(wa_preset_result?.ok
        ? {
            wa_preset_aplicado: true,
            wa_preset_id: wa_preset_result.preset_id,
            wa_preset_passos: wa_preset_result.passos,
          }
        : {}),
    },
    { status: 201 }
  );
}
