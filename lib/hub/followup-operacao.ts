import type { SupabaseClient } from "@supabase/supabase-js";
import {
  executarFollowupParaAgente,
  type FollowupLeadDiagnostico,
  type FollowupRunResult,
} from "@/lib/hub/followup-runner";
import {
  faixaHorariaEfetiva,
  followupPermitidoNaJanela,
  horariosDisparoFollowup,
  janelaModoFollowup,
} from "@/lib/hub/followup-janela";
import { resumoJanelaFollowup } from "@/lib/hub/followup-agenda";
import { formatarResumoCadencia } from "@/lib/hub/followup-types";
import type { HubAgenteFollowupConfig, HubAgenteFollowupPasso } from "@/lib/hub/followup-types";

export type FollowupTimelineEvento = {
  id: string;
  tipo: "envio" | "tick" | "arquivado";
  em: string;
  status: "sucesso" | "erro" | "sem_acao" | "aguardando";
  titulo: string;
  detalhe?: string;
  lead_nome?: string;
  passo?: number;
  fonte?: string;
};

export type FollowupExecucaoJanela = {
  modo: "continuo" | "janela_horaria" | "faixa" | "slots";
  ativa: boolean;
  proximo_slot: string | null;
  horarios: string[];
  janela_resumo?: string;
  faixa?: { inicio: string; fim: string };
};

export type FollowupOperacaoSnapshot = {
  ativo: boolean;
  resumo_cadencia: string | null;
  execucao_janela: FollowupExecucaoJanela | null;
  janela_resumo: string | null;
  estado_atual: Pick<
    FollowupRunResult,
    "leads_elegiveis" | "enviados" | "arquivados" | "diagnosticos" | "resumo_skip" | "erros"
  > | null;
  timeline: FollowupTimelineEvento[];
  ultimo_tick_em: string | null;
  envios_24h: number;
};

const MOTIVO_LABEL: Record<string, string> = {
  aguardando_espera: "Aguardando espera",
  aguardando_gatilho: "Aguardando gatilho",
  aguardando_atraso_passo: "Aguardando atraso do passo",
  aguardando_hora_disparo: "Aguardando horário",
  sem_ultimo_followup: "Sem follow-up anterior",
  sem_ultima_msg_cliente: "Sem mensagem do cliente",
  cadencia_concluida: "Cadência concluída",
  passo_ja_enviado: "Passo já enviado",
  cliente_respondeu: "Cliente respondeu",
  atendimento_encerrado: "Atendimento encerrado",
  limite_total_atingido: "Limite total atingido",
  sem_telefone: "Sem telefone",
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function eventoFromCicloLog(row: Record<string, unknown>): FollowupTimelineEvento | null {
  const acoes = asRecord(row.acoes_tomadas);
  if (!acoes) return null;
  const acao = String(acoes.acao ?? "");
  const em = String(row.iniciado_em ?? row.finalizado_em ?? "");
  if (!em) return null;
  const statusRaw = String(row.status ?? "sem_acao");
  const status =
    statusRaw === "sucesso" || statusRaw === "erro" || statusRaw === "sem_acao"
      ? statusRaw
      : "sem_acao";

  if (acao === "followup_automatico") {
    const passo = typeof acoes.passo === "number" ? acoes.passo : undefined;
    return {
      id: `log-${String(row.id)}`,
      tipo: "envio",
      em,
      status: status === "erro" ? "erro" : "sucesso",
      titulo: passo ? `Follow-up passo ${passo} enviado` : "Follow-up enviado",
      detalhe: typeof row.erro === "string" ? row.erro : undefined,
      passo,
    };
  }

  if (acao === "followup_tick") {
    const enviados = Number(acoes.enviados ?? 0);
    const arquivados = Number(acoes.arquivados ?? 0);
    const elegiveis = Number(acoes.leads_elegiveis ?? 0);
    const fonte = typeof acoes.fonte === "string" ? acoes.fonte : undefined;
    const diagnosticos = Array.isArray(acoes.diagnosticos)
      ? (acoes.diagnosticos as FollowupLeadDiagnostico[])
      : [];

    let titulo = "Tick follow-up";
    if (enviados > 0) titulo = `${enviados} follow-up(s) enviado(s)`;
    else if (arquivados > 0) titulo = `${arquivados} lead(s) arquivado(s)`;
    else if (elegiveis > 0) titulo = `${elegiveis} lead(s) elegível(is) — nenhum envio`;

    const primeiroDiag = diagnosticos[0];
    const detalhe =
      enviados === 0 && arquivados === 0 && primeiroDiag
        ? `${primeiroDiag.lead_nome}: ${MOTIVO_LABEL[primeiroDiag.motivo] ?? primeiroDiag.motivo}${primeiroDiag.detalhe ? ` — ${primeiroDiag.detalhe}` : ""}`
        : undefined;

    return {
      id: `tick-${String(row.id)}`,
      tipo: "tick",
      em,
      status,
      titulo,
      detalhe,
      fonte,
    };
  }

  return null;
}

function eventoFromFila(row: Record<string, unknown>, leadNome?: string): FollowupTimelineEvento | null {
  const meta = asRecord(row.metadata);
  if (meta?.tipo !== "followup_automatico") return null;
  const em = String(row.criado_em ?? "");
  if (!em) return null;
  const passo = typeof meta.passo === "number" ? meta.passo : undefined;
  const conteudo = typeof row.conteudo === "string" ? row.conteudo.trim() : "";
  return {
    id: `fila-${String(row.id)}`,
    tipo: "envio",
    em,
    status: String(row.status) === "erro" ? "erro" : "sucesso",
    titulo: passo ? `WhatsApp passo ${passo}` : "WhatsApp follow-up",
    detalhe: conteudo ? conteudo.slice(0, 120) : undefined,
    lead_nome: leadNome,
    passo,
  };
}

function mergeTimeline(events: FollowupTimelineEvento[]): FollowupTimelineEvento[] {
  const byKey = new Map<string, FollowupTimelineEvento>();
  for (const ev of events) {
    const key = `${ev.tipo}:${ev.em}:${ev.passo ?? ""}:${ev.titulo}`;
    if (!byKey.has(key)) byKey.set(key, ev);
  }
  return [...byKey.values()].sort((a, b) => new Date(b.em).getTime() - new Date(a.em).getTime());
}

export async function buildFollowupOperacaoSnapshot(
  supabase: SupabaseClient,
  slug: string
): Promise<FollowupOperacaoSnapshot> {
  const empty: FollowupOperacaoSnapshot = {
    ativo: false,
    resumo_cadencia: null,
    execucao_janela: null,
    janela_resumo: null,
    estado_atual: null,
    timeline: [],
    ultimo_tick_em: null,
    envios_24h: 0,
  };

  const { data: configRow } = await supabase
    .from("hub_agente_followup_config")
    .select("*")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!configRow) return empty;

  const config = configRow as HubAgenteFollowupConfig;
  const { data: passosRows } = await supabase
    .from("hub_agente_followup_passo")
    .select("*")
    .eq("config_id", config.id)
    .order("ordem");

  const passos = (passosRows || []) as HubAgenteFollowupPasso[];
  const resumo_cadencia = config.ativo ? formatarResumoCadencia(passos, config) : null;
  const janelaAgora = followupPermitidoNaJanela(config);
  const modoJanela = janelaModoFollowup(config);
  const faixaEfetiva = faixaHorariaEfetiva(config);
  const execucao_janela: FollowupExecucaoJanela = {
    modo: modoJanela === "faixa" ? "faixa" : modoJanela === "slots" ? "faixa" : "continuo",
    ativa: janelaAgora.ativa,
    proximo_slot: janelaAgora.proximo ?? null,
    horarios: horariosDisparoFollowup(config),
    janela_resumo: resumoJanelaFollowup(config),
    faixa:
      modoJanela !== "continuo"
        ? { inicio: faixaEfetiva.inicio, fim: faixaEfetiva.fim }
        : undefined,
  };
  const janela_resumo = resumoJanelaFollowup(config);

  let estado_atual: FollowupOperacaoSnapshot["estado_atual"] = null;
  if (config.ativo && passos.some((p) => p.ativo !== false)) {
    const sim = await executarFollowupParaAgente(supabase, config, passos, {
      simular: true,
      diagnostico: true,
    });
    estado_atual = {
      leads_elegiveis: sim.leads_elegiveis,
      enviados: sim.enviados,
      arquivados: sim.arquivados,
      diagnosticos: sim.diagnosticos,
      resumo_skip: sim.resumo_skip,
      erros: sim.erros,
    };
  }

  const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [logsR, filaR] = await Promise.all([
    supabase
      .from("hub_ciclos_log")
      .select("id, status, erro, iniciado_em, finalizado_em, acoes_tomadas")
      .eq("agente_slug", slug)
      .order("iniciado_em", { ascending: false })
      .limit(80),
    supabase
      .from("hub_fila_mensagens")
      .select("id, lead_id, conteudo, status, criado_em, metadata")
      .eq("agente_id", slug)
      .eq("direcao", "saida")
      .gte("criado_em", desde24h)
      .order("criado_em", { ascending: false })
      .limit(40),
  ]);

  const leadIds = [
    ...new Set(
      (filaR.data || [])
        .map((r) => (r as { lead_id?: string }).lead_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const leadNomes = new Map<string, string>();
  if (leadIds.length > 0) {
    const { data: leads } = await supabase.from("hub_leads_crm").select("id, nome").in("id", leadIds);
    for (const l of leads || []) {
      leadNomes.set(String((l as { id: string }).id), String((l as { nome?: string }).nome ?? "Lead"));
    }
  }

  const fromLogs = (logsR.data || [])
    .map((r) => eventoFromCicloLog(r as Record<string, unknown>))
    .filter((e): e is FollowupTimelineEvento => e != null);

  const fromFila = (filaR.data || [])
    .map((r) => {
      const row = r as Record<string, unknown>;
      const leadId = String((row.lead_id as string | undefined) ?? "");
      return eventoFromFila(row, leadNomes.get(leadId));
    })
    .filter((e): e is FollowupTimelineEvento => e != null);

  const timeline = mergeTimeline([...fromLogs, ...fromFila]).slice(0, 40);

  const ultimo_tick_em =
    timeline.find((e) => e.tipo === "tick" || e.tipo === "envio")?.em ?? null;

  const envios_24h = fromFila.filter((e) => e.status === "sucesso").length;

  const aguardando: FollowupTimelineEvento[] = (estado_atual?.diagnosticos ?? [])
    .filter(
      (d) =>
        (d.motivo.startsWith("aguardando") || d.motivo === "sem_ultima_msg_cliente") &&
        d.motivo !== "cadencia_concluida"
    )
    .slice(0, 5)
    .map((d) => ({
      id: `pendente-${d.lead_id}`,
      tipo: "tick" as const,
      em: new Date().toISOString(),
      status: "aguardando" as const,
      titulo: `${d.lead_nome} — ${MOTIVO_LABEL[d.motivo] ?? d.motivo}`,
      detalhe: d.detalhe,
      lead_nome: d.lead_nome,
      passo: d.proximo_passo,
    }));

  return {
    ativo: config.ativo === true,
    resumo_cadencia,
    execucao_janela,
    janela_resumo,
    estado_atual,
    timeline: [...aguardando, ...timeline],
    ultimo_tick_em,
    envios_24h,
  };
}
