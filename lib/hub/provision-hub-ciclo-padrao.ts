import type { SupabaseClient } from "@supabase/supabase-js";
import { validateAndNormalizeCicloConfiguracoes } from "@/lib/hub-ciclos-configuracoes";
import { defaultTenantId } from "@/lib/tenant-default";
import {
  cicloExecucaoPadraoFromModoOperacao,
  isCicloExecucaoPadrao,
  isModoOperacaoAgente,
  type CicloExecucaoPadrao,
} from "@/lib/hub/agente-modo-operacao";

export type CicloExecucaoCliente = CicloExecucaoPadrao;

export async function provisionHubCicloPadrao(
  supabase: SupabaseClient,
  agenteSlug: string,
  nomeAgente: string,
  modo: CicloExecucaoCliente,
  agendaIntervalMinutes: number,
  tenantId: string,
  opts?: { cronExpressao?: string | null }
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
    const cronFixo = String(opts?.cronExpressao ?? "").trim();
    if (cronFixo) {
      intervalo = null;
      baseCfg.cron_origem = "wizard_hora_local_br";
    } else {
      intervalo = agendaIntervalMinutes;
    }
    ativo = false;
    baseCfg.ciclo_origem_provisionamento = "wizard_agente_v1";
    baseCfg.dispatch_pendente = true;
    baseCfg.dispatch = { api: "agente", ciclo: "briefing_programado" };
    baseCfg.brief_padrao =
      `Rotina programada de «${rotulo}»: consulte dados operacionais da empresa (hub_dados_empresa) e produza resumo útil para a equipa conforme cargo e playbook.`;
    baseCfg.dica =
      "Ciclo interno: dispatch api=agente. Active o ciclo e o motor de ferramentas no agente.";
  }

  const cronExpressao =
    modo === "agenda" ? String(opts?.cronExpressao ?? "").trim() || null : null;

  const descricao =
    modo === "interacao"
      ? "Dispara com interação no canal (mensagem do utilizador / webhook)."
      : modo === "tempo_real"
        ? "Atrelado ao motor em tempo real (sem ciclo cron dedicado)."
        : cronExpressao
          ? `Execução diária programada (cron UTC no ciclo; hora local definida no wizard).`
          : `Cadência definida ao criar o agente (≈ cada ${intervalo} min após dispatch e ativação).`;

  const parsedCfg = validateAndNormalizeCicloConfiguracoes(baseCfg);
  if (!parsedCfg.ok) {
    return { erro: parsedCfg.error };
  }

  const row: Record<string, unknown> = {
    agente_slug: agenteSlug,
    nome: nomeLinha,
    descricao: `${descricao} — Agente «${rotulo}»`,
    tipo,
    cron_expressao: cronExpressao,
    intervalo_minutos: intervalo,
    ativo,
    configuracoes: parsedCfg.value,
    tenant_id: tenantId || defaultTenantId(),
  };

  let { error } = await supabase.from("hub_ciclos_ia").insert(row);
  if (error && /tenant_id/i.test(error.message) && /column|schema cache|could not find/i.test(error.message)) {
    const { tenant_id: _omit, ...semTenant } = row;
    ({ error } = await supabase.from("hub_ciclos_ia").insert(semTenant));
  }
  if (error) return { erro: error.message };

  const aviso =
    modo === "agenda"
      ? "Criámos uma linha em hub_ciclos_ia tipo programado em pausa: configure configuracoes.dispatch e ative antes de o dispatcher usar este ciclo para este agente."
      : modo === "tempo_real"
        ? "Ciclo contínuo registado só para operações no CRM; o cron /api/cron/dispatch-ciclos só trata tipo programado."
        : undefined;

  return { aviso };
}

/** Repara agentes sem linha em hub_ciclos_ia (ex.: falha de tenant_id na criação). */
export async function ensureHubCicloPadraoParaAgente(
  supabase: SupabaseClient,
  agenteSlug: string,
  agendaIntervalMinutes = 60
): Promise<{ provisionado: boolean; aviso?: string; erro?: string }> {
  const { data: existentes, error: existErr } = await supabase
    .from("hub_ciclos_ia")
    .select("id")
    .eq("agente_slug", agenteSlug)
    .limit(1);
  if (existErr) return { provisionado: false, erro: existErr.message };
  if (existentes && existentes.length > 0) return { provisionado: false };

  const { data: agente, error: agErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome, modo_operacao, ciclo_execucao_padrao, tenant_id")
    .eq("agente_slug", agenteSlug)
    .maybeSingle();
  if (agErr) return { provisionado: false, erro: agErr.message };
  if (!agente) return { provisionado: false };

  let modo: CicloExecucaoCliente | null = null;
  if (isCicloExecucaoPadrao(agente.ciclo_execucao_padrao)) {
    modo = agente.ciclo_execucao_padrao;
  } else if (isModoOperacaoAgente(agente.modo_operacao)) {
    modo = cicloExecucaoPadraoFromModoOperacao(agente.modo_operacao);
  }
  if (!modo) return { provisionado: false };

  const tenantId =
    (typeof agente.tenant_id === "string" && agente.tenant_id.trim()) || defaultTenantId();
  const nome = typeof agente.nome === "string" ? agente.nome : agenteSlug;
  const out = await provisionHubCicloPadrao(
    supabase,
    agenteSlug,
    nome,
    modo,
    agendaIntervalMinutes,
    tenantId
  );
  if (out.erro) return { provisionado: false, erro: out.erro };
  return { provisionado: true, aviso: out.aviso };
}

/** Garante linha em hub_ciclos_ia para agentes sem ciclo (ex.: falha no wizard). */
export async function repararCiclosAusentesParaAgentes(
  supabase: SupabaseClient,
  opts?: { tenantId?: string | null; maxAgentes?: number }
): Promise<{ reparados: number; erros: string[] }> {
  const maxAgentes = opts?.maxAgentes ?? 48;
  const tenantId = typeof opts?.tenantId === "string" && opts.tenantId.trim() ? opts.tenantId.trim() : null;

  const { data: ciclos, error: cErr } = await supabase.from("hub_ciclos_ia").select("agente_slug");
  if (cErr) return { reparados: 0, erros: [cErr.message] };

  const comCiclo = new Set(
    (ciclos ?? [])
      .map((c) => (typeof c.agente_slug === "string" ? c.agente_slug.trim() : ""))
      .filter(Boolean)
  );

  let agentesResult;
  if (tenantId) {
    agentesResult = await supabase
      .from("hub_agente_identidade")
      .select("agente_slug")
      .eq("tenant_id", tenantId)
      .order("nome")
      .limit(maxAgentes);
    if (
      agentesResult.error &&
      /tenant_id/i.test(agentesResult.error.message) &&
      /column|schema cache|could not find/i.test(agentesResult.error.message)
    ) {
      agentesResult = await supabase
        .from("hub_agente_identidade")
        .select("agente_slug")
        .order("nome")
        .limit(maxAgentes);
    }
  } else {
    agentesResult = await supabase
      .from("hub_agente_identidade")
      .select("agente_slug")
      .order("nome")
      .limit(maxAgentes);
  }

  const { data: agentes, error: aErr } = agentesResult;
  if (aErr) return { reparados: 0, erros: [aErr.message] };

  let reparados = 0;
  const erros: string[] = [];
  for (const row of agentes ?? []) {
    const slug = typeof row.agente_slug === "string" ? row.agente_slug.trim() : "";
    if (!slug || comCiclo.has(slug)) continue;
    const r = await ensureHubCicloPadraoParaAgente(supabase, slug);
    if (r.provisionado) {
      reparados += 1;
      comCiclo.add(slug);
    } else if (r.erro) {
      erros.push(`${slug}: ${r.erro}`);
    }
  }
  return { reparados, erros };
}

const FOLLOWUP_CICLO_NOME = "Follow-up WhatsApp";

/** Ciclo programado de follow-up proativo para leads que pararam de responder. */
export async function provisionFollowupCicloWhatsapp(
  supabase: SupabaseClient,
  agenteSlug: string,
  nomeAgente: string,
  tenantId: string
): Promise<{ criado: boolean; aviso?: string; erro?: string }> {
  const { data: existentes, error: existErr } = await supabase
    .from("hub_ciclos_ia")
    .select("id, nome, configuracoes")
    .eq("agente_slug", agenteSlug);

  if (existErr) return { criado: false, erro: existErr.message };

  const jaTemFollowup = (existentes ?? []).some((c) => {
    const cfg = c.configuracoes as Record<string, unknown> | null;
    const dispatch = cfg?.dispatch as { api?: string; ciclo?: string } | undefined;
    if (dispatch?.api === "atendente" && dispatch?.ciclo === "followup") return true;
    const nome = String(c.nome ?? "").toLowerCase();
    return nome.includes("follow");
  });

  if (jaTemFollowup) return { criado: false };

  const rotulo = nomeAgente.trim().slice(0, 80) || agenteSlug;
  const baseCfg: Record<string, unknown> = {
    ciclo_origem_provisionamento: "wa_followup_v2",
    followup_v2_telemetry: true,
  };

  const parsedCfg = validateAndNormalizeCicloConfiguracoes(baseCfg);
  if (!parsedCfg.ok) return { criado: false, erro: parsedCfg.error };

  const row: Record<string, unknown> = {
    agente_slug: agenteSlug,
    nome: FOLLOWUP_CICLO_NOME,
    descricao: `Registo de execuções do follow-up automático — Agente «${rotulo}». Configure passos em Integrações.`,
    tipo: "gatilho",
    cron_expressao: null,
    intervalo_minutos: null,
    ativo: true,
    configuracoes: parsedCfg.value,
    tenant_id: tenantId || defaultTenantId(),
  };

  let { error } = await supabase.from("hub_ciclos_ia").insert(row);
  if (error && /tenant_id/i.test(error.message) && /column|schema cache|could not find/i.test(error.message)) {
    const { tenant_id: _omit, ...semTenant } = row;
    ({ error } = await supabase.from("hub_ciclos_ia").insert(semTenant));
  }
  if (error) return { criado: false, erro: error.message };

  return {
    criado: true,
    aviso:
      "Ciclo follow-up criado em pausa. Active em CRM → Ciclos após validar dispatch atendente/followup.",
  };
}
