import type { SupabaseClient } from "@supabase/supabase-js";
import { insertFilaMensagemCompat } from "@/lib/crm/insert-fila-mensagem-compat";
import { resolverTokenInstanciaWhatsapp } from "@/lib/crm/resolver-token-whatsapp";
import {
  indiceProximoPasso,
  interpolarTemplateFollowup,
  corpoTemplateFollowupPasso,
  textoExibicaoFollowupPasso,
  esperaMinutosDoPasso,
  passosAtivosOrdenados,
  passosEnviadosCount,
  type HubAgenteFollowupConfig,
  type HubAgenteFollowupPasso,
} from "@/lib/hub/followup-types";
import { followupPermitidoNaJanela, horariosDisparoFollowup, janelaModoFollowup } from "@/lib/hub/followup-janela";
import { avaliarDisparoPasso, type MotivoFollowupSkip } from "@/lib/hub/followup-schedule";
import {
  calcularProximoFollowupEm,
  followupAgendadoParaAgora,
  formatarProximoFollowup,
} from "@/lib/hub/followup-agenda";
import {
  contarEnviosFollowupHoje,
  followupPassoJaEnviado,
  limparLedgerCadenciaLead,
  registrarFollowupEnvio,
} from "@/lib/hub/followup-ledger";
import {
  clienteRespondeuAposUltimoFollowup,
  followupLeadBloqueadoPorEnvioRecente,
  followupPassoEnviadoRecentemente,
  janelaAntiduplicataMinutos,
  minutosSilencioDesdeUltimaMsgCliente,
} from "@/lib/hub/followup-relogio";
import { defaultTenantId } from "@/lib/tenant-default";
import { whatsappConfigured, whatsappSendMedia, whatsappSendText } from "@/lib/whatsapp/whatsapp-send";

type LeadFollowupRow = {
  id: string;
  nome: string;
  telefone: string | null;
  tenant_id: string | null;
  estagio: string | null;
  followup_passo: number | null;
  followup_pausado: boolean | null;
  ultima_msg_cliente_em: string | null;
  ultimo_contato: string | null;
  ultimo_followup: string | null;
  proximo_followup: string | null;
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
  /** Avalia sem enviar mensagens nem gravar estado de follow-up. */
  simular?: boolean;
  /** Grava tick em hub_ciclos_log (cron/worker). */
  registrarTick?: boolean;
  fonteTick?: "cron" | "worker" | "manual";
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

async function registrarTickFollowup(
  supabase: SupabaseClient,
  slug: string,
  result: FollowupRunResult,
  fonte: FollowupRunOptions["fonteTick"]
): Promise<void> {
  const agoraIso = new Date().toISOString();
  const status =
    result.erros.length > 0 ? "erro" : result.enviados > 0 || result.arquivados > 0 ? "sucesso" : "sem_acao";

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
      status,
      erro: result.erros[0] ?? null,
      acoes_tomadas: {
        acao: "followup_tick",
        fonte: fonte ?? "manual",
        enviados: result.enviados,
        arquivados: result.arquivados,
        leads_elegiveis: result.leads_elegiveis,
        diagnosticos: (result.diagnosticos ?? []).slice(0, 25),
        resumo_skip: result.resumo_skip ?? {},
        erros: result.erros.slice(0, 5),
      },
      iniciado_em: agoraIso,
      finalizado_em: agoraIso,
    });

    if (ciclo?.id) {
      await supabase
        .from("hub_ciclos_ia")
        .update({
          ultimo_ciclo: agoraIso,
          ultimo_status: status,
        })
        .eq("id", ciclo.id);
    }
  } catch {
    /* telemetria opcional */
  }
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
    const caption = (texto || (passo.legenda_imagem || "").trim() || undefined)?.trim() || undefined;
    const r = await whatsappSendMedia(telefone, {
      type: "image",
      file: img,
      caption,
      instanceToken,
    });
    if (!r.ok) return { ok: false, erro: r.error };
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

  const coletarDiagnostico =
    options?.diagnostico === true || options?.registrarTick === true || options?.simular === true;
  if (coletarDiagnostico) {
    result.diagnosticos = [];
    result.resumo_skip = {};
  }

  if (!config.ativo || passos.length === 0) {
    if (options?.registrarTick) {
      await registrarTickFollowup(supabase, slug, result, options.fonteTick ?? "manual");
    }
    return result;
  }

  const passosAtivos = passosAtivosOrdenados(passos);
  if (passosAtivos.length === 0) {
    if (options?.registrarTick) {
      await registrarTickFollowup(supabase, slug, result, options.fonteTick ?? "manual");
    }
    return result;
  }

  const janela = followupPermitidoNaJanela(config);
  if (!janela.ativa && !options?.simular) {
    const modo = janelaModoFollowup(config);
    const detalhe =
      modo === "faixa" && janela.faixa
        ? janela.proximo
          ? `fora da faixa ${janela.faixa.inicio}–${janela.faixa.fim} — próximo ~${janela.proximo}`
          : `fora da faixa ${janela.faixa.inicio}–${janela.faixa.fim}`
        : janela.proximo
          ? `fora da janela — próximo slot ${janela.proximo} (${horariosDisparoFollowup(config).join(", ")})`
          : `fora da janela horária (${horariosDisparoFollowup(config).join(", ")})`;
    if (coletarDiagnostico) {
      result.diagnosticos!.push({
        lead_id: "_config",
        lead_nome: "(agente)",
        motivo: "aguardando_hora_disparo",
        detalhe,
      });
      result.resumo_skip!.aguardando_hora_disparo =
        (result.resumo_skip!.aguardando_hora_disparo ?? 0) + 1;
    }
    if (options?.registrarTick) {
      await registrarTickFollowup(supabase, slug, result, options.fonteTick ?? "manual");
    }
    return result;
  }

  const foraDaJanela = !janela.ativa;
  const modoJanela = janelaModoFollowup(config);
  const detalheJanelaFechada = foraDaJanela
    ? modoJanela === "faixa" && janela.faixa
      ? janela.proximo
        ? `fora da faixa ${janela.faixa.inicio}–${janela.faixa.fim} — próximo ~${janela.proximo}`
        : `fora da faixa ${janela.faixa.inicio}–${janela.faixa.fim}`
      : janela.proximo
        ? `fora da janela — próximo slot ${janela.proximo} (${horariosDisparoFollowup(config).join(", ")})`
        : `fora da janela horária (${horariosDisparoFollowup(config).join(", ")})`
    : null;

  const { token: instanceToken } = await resolverTokenInstanciaWhatsapp(supabase, slug);
  if (!whatsappConfigured({ instanceToken })) {
    result.erros.push(
      instanceToken
        ? `${slug}: UAZAPI_BASE_URL não configurado no servidor.`
        : `${slug}: sem token UAZAPI — configure a instância WhatsApp do agente em Integrações.`
    );
    if (options?.registrarTick) {
      await registrarTickFollowup(supabase, slug, result, options.fonteTick ?? "manual");
    }
    return result;
  }

  const arquivarHoras = config.arquivar_apos_dias * 24;

  const { data: leads, error } = await supabase
    .from("hub_leads_crm")
    .select(
      "id, nome, telefone, tenant_id, estagio, followup_passo, followup_pausado, ultima_msg_cliente_em, ultimo_contato, ultimo_followup, proximo_followup, criado_em, atualizado_em, metadata, agente_responsavel, humano_responsavel"
    )
    .eq("agente_responsavel", slug)
    .eq("followup_pausado", false)
    .is("humano_responsavel", null)
    .not("estagio", "in", '("ganho","perdido","arquivado")')
    .not("telefone", "is", null);

  if (error) {
    result.erros.push(error.message);
    if (options?.registrarTick) {
      await registrarTickFollowup(supabase, slug, result, options.fonteTick ?? "manual");
    }
    return result;
  }

  const agora = Date.now();
  const listaLeads = (leads || []) as LeadFollowupRow[];
  result.leads_elegiveis = listaLeads.length;

  for (const lead of listaLeads) {
    const tel = (lead.telefone || "").trim();
    if (!tel) {
      if (coletarDiagnostico) {
        registrarSkip(result, {
          lead_id: lead.id,
          lead_nome: lead.nome,
          motivo: "sem_telefone",
        });
      }
      continue;
    }

    if (foraDaJanela) {
      if (coletarDiagnostico) {
        registrarSkip(result, {
          lead_id: lead.id,
          lead_nome: lead.nome,
          motivo: "aguardando_hora_disparo",
          detalhe: detalheJanelaFechada ?? undefined,
        });
      }
      continue;
    }

    let enviadosCount = passosEnviadosCount(lead.followup_passo, passosAtivos);
    let indicePasso = indiceProximoPasso(lead.followup_passo, passosAtivos);
    let passo = passosAtivos[indicePasso];

    // Só mensagem inbound registrada pelo webhook — sem backfill (evita msg antiga na fila).
    const ultimaMsgClienteEm = lead.ultima_msg_cliente_em?.trim() || null;

    const minutosSilencio = minutosSilencioDesdeUltimaMsgCliente(ultimaMsgClienteEm, agora);
    const horasSilencio = minutosSilencio != null ? minutosSilencio / 60 : null;
    const minutosDesdeUltimoFollowup = minutosDesde(lead.ultimo_followup, agora);
    const clienteRespondeuDepois = clienteRespondeuAposUltimoFollowup(
      ultimaMsgClienteEm,
      lead.ultimo_followup
    );

    if (!options?.simular && clienteRespondeuDepois && enviadosCount > 0) {
      await limparLedgerCadenciaLead(supabase, lead.id, slug);
      await supabase
        .from("hub_leads_crm")
        .update({
          followup_passo: 0,
          ultimo_followup: null,
          proximo_followup: null,
        })
        .eq("id", lead.id);
      enviadosCount = 0;
      indicePasso = 0;
      passo = passosAtivos[0];
      lead.followup_passo = 0;
      lead.ultimo_followup = null;
    }

    if (!options?.simular && enviadosCount === 0 && lead.ultimo_followup?.trim()) {
      const esperaP1 = esperaMinutosDoPasso(passosAtivos[0]!, config, 0);
      const janelaP1 = janelaAntiduplicataMinutos(esperaP1, 0);
      const minsFu = minutosDesdeUltimoFollowup;

      if (minsFu != null && minsFu < janelaP1) {
        const { error: syncErr } = await supabase
          .from("hub_leads_crm")
          .update({ followup_passo: 1 })
          .eq("id", lead.id);
        if (!syncErr) {
          enviadosCount = 1;
          indicePasso = indiceProximoPasso(1, passosAtivos);
          passo = passosAtivos[indicePasso];
          lead.followup_passo = 1;
        }
      } else {
        const { error: repErr } = await supabase
          .from("hub_leads_crm")
          .update({ followup_passo: 1 })
          .eq("id", lead.id);
        if (!repErr) {
          enviadosCount = 1;
          indicePasso = indiceProximoPasso(1, passosAtivos);
          passo = passosAtivos[indicePasso];
          lead.followup_passo = 1;
        }
      }
    }

    if (minutosSilencio == null) {
      if (coletarDiagnostico) {
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
      if (!options?.simular) {
        await supabase
          .from("hub_leads_crm")
          .update({ estagio: "arquivado", followup_pausado: true })
          .eq("id", lead.id);
      }
      result.arquivados += 1;
      result.acoes.push(`Arquivado ${lead.nome} após ${config.arquivar_apos_dias}d sem resposta`);
      continue;
    }

    if (!passo) {
      if (coletarDiagnostico) {
        registrarSkip(result, {
          lead_id: lead.id,
          lead_nome: lead.nome,
          motivo: "cadencia_concluida",
          detalhe: `${enviadosCount}/${passosAtivos.length} passos enviados`,
        });
      }
      continue;
    }

    // Ledger: avança se o passo actual já foi enviado (anti-duplicata forte).
    if (!options?.simular) {
      let guard = 0;
      while (passo && guard < passosAtivos.length) {
        const jaEnviado = await followupPassoJaEnviado(supabase, lead.id, passo.id);
        if (!jaEnviado) break;
        enviadosCount += 1;
        indicePasso = enviadosCount;
        passo = passosAtivos[indicePasso];
        guard += 1;
      }
      if (!passo) {
        if (coletarDiagnostico) {
          registrarSkip(result, {
            lead_id: lead.id,
            lead_nome: lead.nome,
            motivo: "cadencia_concluida",
            detalhe: "todos os passos já constam no ledger",
          });
        }
        continue;
      }
    }

    const agoraDate = new Date(agora);
    if (!followupAgendadoParaAgora(lead.proximo_followup, agoraDate)) {
      const fmt = formatarProximoFollowup(lead.proximo_followup);
      if (coletarDiagnostico) {
        registrarSkip(result, {
          lead_id: lead.id,
          lead_nome: lead.nome,
          motivo: "aguardando_espera",
          detalhe: fmt ? `próximo envio agendado: ${fmt}` : "aguardando proximo_followup",
          proximo_passo: indicePasso + 1,
        });
      }
      continue;
    }

    const maxPorDia = Math.max(1, config.max_envios_por_dia ?? 1);
    if (!options?.simular) {
      const enviosHoje = await contarEnviosFollowupHoje(supabase, lead.id, slug, config.timezone);
      if (enviosHoje >= maxPorDia) {
        if (coletarDiagnostico) {
          registrarSkip(result, {
            lead_id: lead.id,
            lead_nome: lead.nome,
            motivo: "aguardando_espera",
            detalhe: `limite diário (${maxPorDia}) atingido — ${enviosHoje} envio(s) hoje`,
            proximo_passo: indicePasso + 1,
          });
        }
        continue;
      }
    }

    const posicaoPasso = indicePasso + 1;
    const avaliacao = avaliarDisparoPasso({
      indicePasso,
      passo,
      config,
      minutosSilencio,
      minutosDesdeUltimoFollowup,
      enviadosCount,
      clienteRespondeuAposUltimoFollowup: clienteRespondeuDepois,
    });

    if (!avaliacao.permitido) {
      if (coletarDiagnostico && avaliacao.motivo) {
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

    if (!options?.simular) {
      const jaNoLedger = await followupPassoJaEnviado(supabase, lead.id, passo.id);
      if (jaNoLedger) {
        if (coletarDiagnostico) {
          registrarSkip(result, {
            lead_id: lead.id,
            lead_nome: lead.nome,
            motivo: "passo_ja_enviado",
            detalhe: `passo ${posicaoPasso} já registrado no ledger`,
            proximo_passo: posicaoPasso,
          });
        }
        continue;
      }

      const esperaPasso = esperaMinutosDoPasso(passo, config, indicePasso);
      const janelaDuplicata = janelaAntiduplicataMinutos(esperaPasso, indicePasso);

      const bloqueioLead = followupLeadBloqueadoPorEnvioRecente({
        minutosDesdeUltimoFollowup,
        enviadosCount,
        indicePasso,
        esperaPasso,
      });
      if (bloqueioLead.bloqueado) {
        if (coletarDiagnostico) {
          registrarSkip(result, {
            lead_id: lead.id,
            lead_nome: lead.nome,
            motivo: "passo_ja_enviado",
            detalhe: bloqueioLead.detalhe,
            proximo_passo: posicaoPasso,
          });
        }
        continue;
      }

      const duplicadoFila = await followupPassoEnviadoRecentemente(
        supabase,
        lead.id,
        passo.id,
        janelaDuplicata
      );
      if (duplicadoFila) {
        if (coletarDiagnostico) {
          registrarSkip(result, {
            lead_id: lead.id,
            lead_nome: lead.nome,
            motivo: "passo_ja_enviado",
            detalhe: `passo ${posicaoPasso} já enviado recentemente (fila CRM)`,
            proximo_passo: posicaoPasso,
          });
        }
        continue;
      }
    }

    const mercado =
      (lead.metadata && typeof lead.metadata.mercado === "string"
        ? lead.metadata.mercado
        : "geral") || "geral";
    const texto = interpolarTemplateFollowup(corpoTemplateFollowupPasso(passo), {
      nome: lead.nome,
      mercado,
    });

    if (options?.simular) {
      result.enviados += 1;
      result.acoes.push(`[simulado] Passo ${posicaoPasso} → ${lead.nome}`);
      continue;
    }

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
    const proximoPasso = passosAtivos[novoEnviadosCount];
    const proximoFollowup = proximoPasso
      ? calcularProximoFollowupEm(
          new Date(agoraIso),
          esperaMinutosDoPasso(proximoPasso, config, novoEnviadosCount),
          config
        )
      : null;

    const ledger = await registrarFollowupEnvio(supabase, {
      lead_id: lead.id,
      passo_id: passo.id,
      agente_slug: slug,
      passo_ordem: passo.ordem,
      tenant_id: lead.tenant_id ?? config.tenant_id,
      enviado_em: agoraIso,
    });

    if (!ledger.ok) {
      result.erros.push(`${lead.nome}: falha ao gravar ledger (${ledger.erro})`);
      continue;
    }

    const { error: leadErr } = await supabase
      .from("hub_leads_crm")
      .update({
        followup_passo: novoEnviadosCount,
        ultimo_followup: agoraIso,
        proximo_followup: proximoFollowup,
      })
      .eq("id", lead.id);

    if (leadErr) {
      result.erros.push(
        `${lead.nome}: mensagem enviada mas falha ao gravar estado (${leadErr.message})`
      );
      continue;
    }

    const tenantId =
      lead.tenant_id?.trim() ||
      config.tenant_id?.trim() ||
      defaultTenantId();

    const { error: filaErr } = await insertFilaMensagemCompat(supabase, {
      lead_id: lead.id,
      tenant_id: tenantId,
      agente_id: slug,
      canal: "whatsapp",
      direcao: "saida",
      conteudo: texto || textoExibicaoFollowupPasso(passo) || "[imagem follow-up]",
      status: "enviado",
      metadata: {
        tipo: "followup_automatico",
        feito_por_tipo: "ia",
        feito_por: slug,
        passo: posicaoPasso,
        passo_id: passo.id,
        passo_ordem: passo.ordem,
        agente_slug: slug,
        imagem_url: passo.imagem_url,
      },
    });

    if (filaErr) {
      result.erros.push(
        `${lead.nome}: follow-up enviado; falha ao registrar na fila CRM (${filaErr.message})`
      );
    }

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

  if (options?.registrarTick) {
    await registrarTickFollowup(supabase, slug, result, options.fonteTick ?? "manual");
  }

  return result;
}

export async function executarFollowupTodosAgentesAtivos(
  supabase: SupabaseClient,
  options?: FollowupRunOptions
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
      (passos || []) as HubAgenteFollowupPasso[],
      options
    );
    resultados.push(r);
  }

  const erros = resultados.flatMap((r) => r.erros);
  return { resultados, erros };
}
