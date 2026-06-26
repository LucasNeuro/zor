import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverTokenInstanciaWhatsapp } from "@/lib/crm/resolver-token-whatsapp";
import {
  indiceProximoPasso,
  interpolarTemplateFollowup,
  passosAtivosOrdenados,
  passosEnviadosCount,
  type HubAgenteFollowupConfig,
  type HubAgenteFollowupPasso,
} from "@/lib/hub/followup-types";
import { avaliarDisparoPasso, type MotivoFollowupSkip } from "@/lib/hub/followup-schedule";
import {
  backfillUltimaMsgClienteEm,
  minutosSilencioDesdeUltimaMsgCliente,
} from "@/lib/hub/followup-relogio";
import { whatsappConfigured, whatsappSendMedia, whatsappSendText } from "@/lib/whatsapp/whatsapp-send";

type LeadFollowupRow = {
  id: string;
  nome: string;
  telefone: string | null;
  estagio: string | null;
  followup_passo: number | null;
  followup_pausado: boolean | null;
  ultima_msg_cliente_em: string | null;
  ultimo_contato: string | null;
  ultimo_followup: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  metadata: Record<string, unknown> | null;
  agente_responsavel: string | null;
  humano_responsavel: string | null;
};

export type FollowupLeadDiagnostico = {
  lead_id: string;
  lead_nome: string;
  motivo: MotivoFollowupSkip | "sem_passo" | "sem_telefone";
  detalhe?: string;
  proximo_passo?: number;
};

export type FollowupRunResult = {
  agente_slug: string;
  enviados: number;
  arquivados: number;
  leads_elegiveis: number;
  erros: string[];
  acoes: string[];
  diagnosticos?: FollowupLeadDiagnostico[];
  resumo_skip?: Partial<Record<MotivoFollowupSkip | "sem_passo" | "sem_telefone", number>>;
};

export type FollowupRunOptions = {
  /** Inclui motivos de skip por lead (útil no botão "Testar envio"). */
  diagnostico?: boolean;
};

function minutosDesde(iso: string | null | undefined, agoraMs: number): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (agoraMs - d.getTime()) / 60_000;
}

function registrarSkip(
  result: FollowupRunResult,
  diag: FollowupLeadDiagnostico
): void {
  if (!result.diagnosticos) result.diagnosticos = [];
  if (!result.resumo_skip) result.resumo_skip = {};
  result.diagnosticos.push(diag);
  result.resumo_skip[diag.motivo] = (result.resumo_skip[diag.motivo] ?? 0) + 1;
}

async function enviarPassoFollowup(params: {
  telefone: string;
  passo: HubAgenteFollowupPasso;
  texto: string;
  instanceToken: string | null;
}): Promise<{ ok: boolean; erro?: string }> {
  const { passo, telefone, texto, instanceToken } = params;
  const tipo = passo.tipo_conteudo;
  const img = (passo.imagem_url || "").trim();
  const opts = { instanceToken };

  if ((tipo === "imagem" || tipo === "texto_imagem") && img) {
    const caption =
      tipo === "texto_imagem"
        ? texto || (passo.legenda_imagem || "").trim() || undefined
        : (passo.legenda_imagem || texto || "").trim() || undefined;
    const r = await whatsappSendMedia(telefone, {
      type: "image",
      file: img,
      caption,
      instanceToken,
    });
    if (!r.ok) return { ok: false, erro: r.error };
    if (tipo === "texto_imagem" && texto && caption !== texto) {
      const r2 = await whatsappSendText(telefone, texto, opts);
      if (!r2.ok) return { ok: false, erro: r2.error };
    }
    return { ok: true };
  }

  if (!texto.trim()) return { ok: false, erro: "Passo sem texto." };
  const r = await whatsappSendText(telefone, texto, opts);
  return r.ok ? { ok: true } : { ok: false, erro: r.error };
}

export async function executarFollowupParaAgente(
  supabase: SupabaseClient,
  config: HubAgenteFollowupConfig,
  passos: HubAgenteFollowupPasso[],
  options?: FollowupRunOptions
): Promise<FollowupRunResult> {
  const slug = config.agente_slug;
  const result: FollowupRunResult = {
    agente_slug: slug,
    enviados: 0,
    arquivados: 0,
    leads_elegiveis: 0,
    erros: [],
    acoes: [],
  };

  if (options?.diagnostico) {
    result.diagnosticos = [];
    result.resumo_skip = {};
  }

  if (!config.ativo || passos.length === 0) return result;

  const passosAtivos = passosAtivosOrdenados(passos);
  if (passosAtivos.length === 0) return result;

  const { token: instanceToken } = await resolverTokenInstanciaWhatsapp(supabase, slug);
  if (!whatsappConfigured({ instanceToken })) {
    result.erros.push(
      instanceToken
        ? `${slug}: UAZAPI_BASE_URL não configurado no servidor.`
        : `${slug}: sem token UAZAPI — configure a instância WhatsApp do agente em Integrações.`
    );
    return result;
  }

  const arquivarHoras = config.arquivar_apos_dias * 24;

  const { data: leads, error } = await supabase
    .from("hub_leads_crm")
    .select(
      "id, nome, telefone, estagio, followup_passo, followup_pausado, ultima_msg_cliente_em, ultimo_contato, ultimo_followup, criado_em, atualizado_em, metadata, agente_responsavel, humano_responsavel"
    )
    .eq("agente_responsavel", slug)
    .eq("followup_pausado", false)
    .is("humano_responsavel", null)
    .not("estagio", "in", '("ganho","perdido","arquivado")')
    .not("telefone", "is", null);

  if (error) {
    result.erros.push(error.message);
    return result;
  }

  const agora = Date.now();
  const listaLeads = (leads || []) as LeadFollowupRow[];
  result.leads_elegiveis = listaLeads.length;

  for (const lead of listaLeads) {
    const tel = (lead.telefone || "").trim();
    if (!tel) {
      if (options?.diagnostico) {
        registrarSkip(result, {
          lead_id: lead.id,
          lead_nome: lead.nome,
          motivo: "sem_telefone",
        });
      }
      continue;
    }

    const enviadosCount = passosEnviadosCount(lead.followup_passo, passosAtivos);
    const indicePasso = indiceProximoPasso(lead.followup_passo, passosAtivos);
    const passo = passosAtivos[indicePasso];

    let ultimaMsgClienteEm = lead.ultima_msg_cliente_em?.trim() || null;
    if (!ultimaMsgClienteEm) {
      ultimaMsgClienteEm = await backfillUltimaMsgClienteEm(supabase, lead.id);
      if (ultimaMsgClienteEm) lead.ultima_msg_cliente_em = ultimaMsgClienteEm;
    }

    const minutosSilencio = minutosSilencioDesdeUltimaMsgCliente(ultimaMsgClienteEm, agora);
    const horasSilencio = minutosSilencio != null ? minutosSilencio / 60 : null;
    const minutosDesdeUltimoFollowup = minutosDesde(lead.ultimo_followup, agora);

    if (minutosSilencio == null) {
      if (options?.diagnostico) {
        registrarSkip(result, {
          lead_id: lead.id,
          lead_nome: lead.nome,
          motivo: "sem_ultima_msg_cliente",
          detalhe: "sem última msg do cliente — aguardando primeira mensagem inbound",
        });
      }
      continue;
    }

    if (!passo && enviadosCount >= passosAtivos.length && horasSilencio != null && horasSilencio >= arquivarHoras) {
      await supabase
        .from("hub_leads_crm")
        .update({ estagio: "arquivado", followup_pausado: true })
        .eq("id", lead.id);
      result.arquivados += 1;
      result.acoes.push(`Arquivado ${lead.nome} após ${config.arquivar_apos_dias}d sem resposta`);
      continue;
    }

    if (!passo) {
      if (options?.diagnostico) {
        registrarSkip(result, {
          lead_id: lead.id,
          lead_nome: lead.nome,
          motivo: "cadencia_concluida",
          detalhe: `${enviadosCount}/${passosAtivos.length} passos enviados`,
        });
      }
      continue;
    }

    const posicaoPasso = indicePasso + 1;
    const avaliacao = avaliarDisparoPasso({
      indicePasso,
      passo,
      gatilho_tipo: config.gatilho_tipo ?? "silencio",
      gatilho_dias: config.gatilho_dias,
      gatilho_horas: config.gatilho_horas,
      gatilho_minutos: config.gatilho_minutos,
      gatilho_hora_dia: config.gatilho_hora_dia,
      minutosSilencio,
      minutosDesdeUltimoFollowup,
    });

    if (!avaliacao.permitido) {
      if (options?.diagnostico && avaliacao.motivo) {
        registrarSkip(result, {
          lead_id: lead.id,
          lead_nome: lead.nome,
          motivo: avaliacao.motivo,
          detalhe: avaliacao.detalhe,
          proximo_passo: posicaoPasso,
        });
      }
      continue;
    }

    const mercado =
      (lead.metadata && typeof lead.metadata.mercado === "string"
        ? lead.metadata.mercado
        : "geral") || "geral";
    const texto = interpolarTemplateFollowup(passo.texto_template || "", {
      nome: lead.nome,
      mercado,
    });

    const envio = await enviarPassoFollowup({
      telefone: tel,
      passo,
      texto,
      instanceToken,
    });

    if (!envio.ok) {
      result.erros.push(`${lead.nome}: ${envio.erro || "falha envio"}`);
      continue;
    }

    const agoraIso = new Date().toISOString();
    const novoEnviadosCount = enviadosCount + 1;

    await supabase.from("hub_fila_mensagens").insert({
      lead_id: lead.id,
      agente_id: slug,
      canal: "whatsapp",
      direcao: "saida",
      conteudo: texto || passo.legenda_imagem || "[imagem follow-up]",
      status: "enviado",
      metadata: {
        tipo: "followup_automatico",
        passo: posicaoPasso,
        passo_id: passo.id,
        passo_ordem: passo.ordem,
        agente_slug: slug,
        imagem_url: passo.imagem_url,
      },
    });

    await supabase
      .from("hub_leads_crm")
      .update({
        followup_passo: novoEnviadosCount,
        ultimo_followup: agoraIso,
        proximo_followup: null,
      })
      .eq("id", lead.id);

    try {
      const { data: ciclo } = await supabase
        .from("hub_ciclos_ia")
        .select("id, total_execucoes")
        .eq("agente_slug", slug)
        .ilike("nome", "%follow%")
        .maybeSingle();

      await supabase.from("hub_ciclos_log").insert({
        ciclo_id: ciclo?.id ?? null,
        agente_slug: slug,
        status: "sucesso",
        acoes_tomadas: {
          acao: "followup_automatico",
          lead_id: lead.id,
          passo: posicaoPasso,
          passo_id: passo.id,
        },
        iniciado_em: agoraIso,
        finalizado_em: agoraIso,
      });

      if (ciclo?.id) {
        await supabase
          .from("hub_ciclos_ia")
          .update({
            ultimo_ciclo: agoraIso,
            ultimo_status: "sucesso",
            total_execucoes: (ciclo.total_execucoes ?? 0) + 1,
          })
          .eq("id", ciclo.id);
      }
    } catch {
      /* telemetria opcional */
    }

    result.enviados += 1;
    result.acoes.push(`Passo ${posicaoPasso} → ${lead.nome}`);
  }

  return result;
}

export async function executarFollowupTodosAgentesAtivos(
  supabase: SupabaseClient
): Promise<{ resultados: FollowupRunResult[]; erros: string[] }> {
  const { data: configs, error } = await supabase
    .from("hub_agente_followup_config")
    .select("*")
    .eq("ativo", true);

  if (error) return { resultados: [], erros: [error.message] };

  const resultados: FollowupRunResult[] = [];

  for (const cfg of (configs || []) as HubAgenteFollowupConfig[]) {
    const { data: passos, error: pErr } = await supabase
      .from("hub_agente_followup_passo")
      .select("*")
      .eq("config_id", cfg.id)
      .eq("ativo", true)
      .order("ordem");

    if (pErr) {
      resultados.push({
        agente_slug: cfg.agente_slug,
        enviados: 0,
        arquivados: 0,
        leads_elegiveis: 0,
        erros: [pErr.message],
        acoes: [],
      });
      continue;
    }

    const r = await executarFollowupParaAgente(
      supabase,
      cfg,
      (passos || []) as HubAgenteFollowupPasso[]
    );
    resultados.push(r);
  }

  const erros = resultados.flatMap((r) => r.erros);
  return { resultados, erros };
}
