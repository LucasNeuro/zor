import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { respostaIaJaEnviadaRecente } from "@/lib/whatsapp/anti-duplicata-resposta";
import { whatsappSendText } from "@/lib/whatsapp/whatsapp-send";

type LoggerLike = {
  info: (event: string, fields?: Record<string, unknown>) => void;
  warn: (event: string, fields?: Record<string, unknown>) => void;
  error: (event: string, fields?: Record<string, unknown>) => void;
};

export type WhatsappTraceLike = {
  log: LoggerLike;
  maskTelefone: (telefone: string) => string | undefined;
};

const IA_ATIVA = Boolean(process.env.MISTRAL_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim());

async function enviarMensagemWhatsApp(
  telefone: string,
  mensagem: string,
  opts?: { instanceToken?: string | null }
) {
  const r = await whatsappSendText(telefone, mensagem, { instanceToken: opts?.instanceToken });
  if (!r.ok) {
    console.error("[WHATSAPP][PROCESSOR] Erro ao enviar mensagem:", r.provider, r.error, r.status, r.body);
    return {
      ok: false as const,
      provider: r.provider ?? null,
      status: r.status ?? null,
      error: r.error,
      body: r.body ?? null,
    };
  }
  return {
    ok: true as const,
    provider: r.provider,
    status: r.status,
    body: r.body ?? null,
  };
}

function toolResultIndicaMenuEnviado(
  toolCalls: Array<{ nome: string; ok: boolean; resultadoPreview?: string }> | undefined
): boolean {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return false;
  return toolCalls.some((t) => {
    if (t.nome !== "hub_whatsapp_menu" || !t.ok) return false;
    const prev = String(t.resultadoPreview || "");
    return prev.includes('"ok":true') && (prev.includes("/send/menu") || prev.includes("/send/carousel"));
  });
}

async function enviarFallbackIA(params: {
  supabase: SupabaseClient;
  leadId: string;
  telefone: string;
  agenteSlug?: string;
  motivo: string;
  mensagemOriginal: string;
  waSendOpts?: { instanceToken?: string | null };
}) {
  const mensagem = "Recebi sua mensagem e já encaminhei para revisão do time. Retornaremos em breve por aqui.";

  try {
    const filaRow = {
      lead_id: params.leadId,
      agente_id: params.agenteSlug || "sdr",
      canal: "whatsapp",
      direcao: "saida",
      conteudo: mensagem,
      status: "fallback_enviado",
      tenant_id: defaultTenantId(),
      metadata: { feito_por: "fallback_ia", motivo: params.motivo },
    };
    let filaIns = await params.supabase.from("hub_fila_mensagens").insert(filaRow);
    if (filaIns.error && isMissingPgColumn(filaIns.error, "tenant_id")) {
      const { tenant_id: _t, ...semTenant } = filaRow;
      filaIns = await params.supabase.from("hub_fila_mensagens").insert(semTenant);
    }
  } catch (e) {
    console.error("[WHATSAPP][PROCESSOR][FALLBACK] Erro ao gravar fila:", e);
  }

  try {
    await params.supabase.from("hub_alertas").insert({
      agente_slug: params.agenteSlug || "diretor_geral_ia",
      tipo: "importante",
      titulo: "Fallback IA acionado",
      mensagem: `Lead ${params.telefone} recebeu resposta de fallback. Motivo: ${params.motivo}`,
      lead_id: params.leadId,
      dados: { mensagem_original: params.mensagemOriginal.slice(0, 200) },
    });
  } catch (e) {
    console.error("[WHATSAPP][PROCESSOR][FALLBACK] Erro ao registrar alerta:", e);
  }

  await enviarMensagemWhatsApp(params.telefone, mensagem, params.waSendOpts);
}

export async function processarMensagemInboundWhatsapp(params: {
  supabase: SupabaseClient;
  trace: WhatsappTraceLike;
  lead: Record<string, unknown>;
  agente: Record<string, unknown> | null;
  mensagemFinal: string;
  telefone: string;
  pushName: string;
  messageId: string | null;
  timestamp: string;
  mercado: string;
  instanceKey: string | null;
  isNovo: boolean;
  tipoMidia: string;
  menuChoiceId?: string | null;
  waSendOpts?: { instanceToken?: string | null };
}) {
  const { supabase, trace } = params;
  const log = trace.log;
  const lead = params.lead as {
    id: string;
    pessoa_id?: string | null;
    humano_responsavel?: string | null;
    agente_responsavel?: string | null;
  };
  const agente = params.agente;
  const humanoResponsavelAtivo =
    typeof lead.humano_responsavel === "string" && lead.humano_responsavel.trim().length > 0;

  let agenteResponsavelLead =
    typeof lead.agente_responsavel === "string" && lead.agente_responsavel.trim()
      ? lead.agente_responsavel.trim()
      : "sdr";

  if (humanoResponsavelAtivo) {
    log.info("wa.processor.ia_skipped", { reason: "humano_responsavel_ativo" });
    try {
      await supabase.from("hub_atividades").insert({
        lead_id: lead.id,
        tipo: "mensagem",
        descricao: `Mensagem recebida - humano (${lead.humano_responsavel?.trim()}) a atender - IA não acionada.`,
        feito_por: "sistema",
        feito_por_tipo: "ia",
        metadata: { telefone: params.telefone, humano_responsavel: lead.humano_responsavel, skip_ia: true },
      });
    } catch (e) {
      console.error("[WHATSAPP][PROCESSOR] Erro ao registrar atividade (humano responsável):", e);
    }
    return;
  }

  if (!(IA_ATIVA && agente)) {
    const motivo = IA_ATIVA ? "agente_nao_encontrado" : "ia_api_key_ausente";
    log.warn("wa.processor.ia_skipped", { reason: motivo, ia_ativa: IA_ATIVA, tem_agente: Boolean(agente) });
    await enviarFallbackIA({
      supabase,
      leadId: lead.id,
      telefone: params.telefone,
      agenteSlug: agente?.agente_slug as string | undefined,
      motivo,
      mensagemOriginal: params.mensagemFinal,
      waSendOpts: params.waSendOpts,
    });
    log.info("wa.processor.fallback_sent", { motivo });
    return;
  }

  const agenteSlug = typeof agente.agente_slug === "string" ? agente.agente_slug : "sdr";
  const iaStarted = Date.now();
  log.info("wa.processor.ia_start", { agente_slug: agenteSlug, lead_id: lead.id });

  let menuEnviadoDeterministico = false;

  try {
    const { mensagemEhSaudacaoSimples, mensagemPedeMenuOuOpcoes, leadJaRecebeuMenuTriagem } =
      await import("@/lib/whatsapp/menu-triagem-uazapi");
    const { agenteUsaPlaybookMaria, lerEstadoPlaybook, processarPlaybookMariaInbound } = await import(
      "@/lib/whatsapp/playbook-flow-maria"
    );
    const { AGENTE_IDENTIDADE_PLAYBOOK_SELECT, resolverRoteamentoPlaybookAgente } = await import(
      "@/lib/hub/agente-playbook-routing"
    );

    const { data: leadMetaRow } = await supabase
      .from("hub_leads_crm")
      .select("metadata, nome")
      .eq("id", lead.id)
      .maybeSingle();

    const { data: agenteIdentRow } = await supabase
      .from("hub_agente_identidade")
      .select(AGENTE_IDENTIDADE_PLAYBOOK_SELECT)
      .eq("agente_slug", agenteSlug)
      .maybeSingle();

    const playbookState = lerEstadoPlaybook(leadMetaRow?.metadata);
    const playbookRouting = resolverRoteamentoPlaybookAgente({
      ident: agenteIdentRow ?? {},
      playbookActive: playbookState.active,
      playbookComplete: playbookState.complete,
    });

    let instanceToken = String(params.waSendOpts?.instanceToken || "").trim();
    if (!instanceToken) {
      const tokenDb =
        typeof agente.uazapi_instance_token === "string" ? agente.uazapi_instance_token.trim() : "";
      instanceToken = tokenDb;
    }

    if (instanceToken) {
      const playbookOut = await processarPlaybookMariaInbound({
        supabase,
        leadId: lead.id,
        telefone: params.telefone,
        mensagem: params.mensagemFinal,
        menuChoiceId: params.menuChoiceId,
        tipoMidia: params.tipoMidia,
        agenteSlug,
        instanceToken,
        isNovo: params.isNovo,
        leadNome: typeof leadMetaRow?.nome === "string" ? leadMetaRow.nome : null,
        metadata: leadMetaRow?.metadata,
      });
      if (playbookOut.handled) {
        log.info("wa.processor.playbook_dynamic_or_fallback", {
          telefone: trace.maskTelefone(params.telefone),
          agente_slug: agenteSlug,
          step: playbookOut.step ?? null,
          skip_ia: playbookOut.skipIa,
          bloquear_ia: playbookOut.bloquearIa ?? playbookRouting.bloquearIa,
          motivo: playbookOut.motivo ?? playbookRouting.motivo ?? null,
        });
        if (playbookOut.skipIa || playbookOut.bloquearIa || playbookRouting.bloquearIa) {
          return;
        }
      } else if (playbookRouting.bloquearIa) {
        log.warn("wa.processor.playbook_unhandled_blocked_ia", {
          telefone: trace.maskTelefone(params.telefone),
          agente_slug: agenteSlug,
          motivo: playbookOut.motivo ?? playbookRouting.motivo ?? "playbook_obrigatorio",
        });
        await enviarFallbackIA({
          supabase,
          leadId: lead.id,
          telefone: params.telefone,
          agenteSlug,
          motivo: playbookOut.motivo ?? "playbook_obrigatorio_sem_resposta",
          mensagemOriginal: params.mensagemFinal,
          waSendOpts: params.waSendOpts,
        });
        return;
      }
    }

    const pedeMenuAntesIa = mensagemPedeMenuOuOpcoes(params.mensagemFinal);
    if (pedeMenuAntesIa && !menuEnviadoDeterministico && !playbookRouting.temPlaybookPublicado) {
      let tokenMenu = String(params.waSendOpts?.instanceToken || "").trim();
      if (!tokenMenu) {
        tokenMenu =
          typeof agente.uazapi_instance_token === "string" ? agente.uazapi_instance_token.trim() : "";
      }
      if (tokenMenu) {
        const { enviarMenuTriagemInicialUazapi, marcarMenuTriagemEnviado } = await import(
          "@/lib/whatsapp/menu-triagem-uazapi"
        );
        const menuPre = await enviarMenuTriagemInicialUazapi({
          telefone: params.telefone,
          instanceToken: tokenMenu,
          variante: "playbook_triagem",
        });
        if (menuPre.ok) {
          await marcarMenuTriagemEnviado(supabase, lead.id);
          menuEnviadoDeterministico = true;
          log.info("wa.processor.menu_triagem_pre_ia", { motivo: "pedido_menu_texto" });
          return;
        }
        log.warn("wa.processor.menu_triagem_pre_ia_failed", {
          erro: menuPre.erro,
          detalhe: menuPre.detalhe || null,
        });
      }
    }

    const { sincronizarContatoWhatsappNoCrm } = await import("@/lib/crm/sincronizar-contato-whatsapp");
    await sincronizarContatoWhatsappNoCrm(supabase, {
      leadId: lead.id,
      pessoaId: lead.pessoa_id ?? null,
      dados: {
        telefone: params.telefone,
        pushName: params.pushName,
        messageId: params.messageId,
        tipoMidia: params.tipoMidia,
        timestamp: params.timestamp,
        mercado: params.mercado,
        instanceKey: params.instanceKey,
      },
    });
    const { processarMensagem } = await import("@/lib/ia/engine");
    const resultado = await processarMensagem({
      leadId: lead.id,
      mensagem: params.mensagemFinal,
      canal: "whatsapp",
      telefone: params.telefone,
      nome: params.pushName,
      segmento: params.mercado,
      agenteSlugHint: agenteSlug,
      tenantId: defaultTenantId(),
      pessoaId: lead.pessoa_id ?? null,
      statusFilaSaida: "pendente_envio",
      metadata: {
        telefone: params.telefone,
        pushName: params.pushName,
        messageId: params.messageId,
        timestamp: params.timestamp,
        mercado: params.mercado,
        instance: params.instanceKey,
        isNovo: params.isNovo,
        tipoMidia: params.tipoMidia,
      },
    });

    if (!resultado.sucesso || !resultado.resposta) {
      log.warn("wa.processor.ia_no_reply", {
        agente_slug: agenteSlug,
        motivo: resultado.erro || "engine_sem_resposta",
        ia_duration_ms: Date.now() - iaStarted,
      });
      await enviarFallbackIA({
        supabase,
        leadId: lead.id,
        telefone: params.telefone,
        agenteSlug,
        motivo: resultado.erro || "engine_sem_resposta",
        mensagemOriginal: params.mensagemFinal,
        waSendOpts: params.waSendOpts,
      });
      log.info("wa.processor.fallback_sent", { motivo: resultado.erro || "engine_sem_resposta" });
      return;
    }

    const menuJaEnviado =
      menuEnviadoDeterministico || toolResultIndicaMenuEnviado(resultado.toolCallsExecutadas);
    log.info("wa.processor.ia_ok", {
      agente_slug: resultado.agenteSlug || agenteSlug,
      modelo: resultado.modelo || null,
      ia_duration_ms: Date.now() - iaStarted,
      precisa_aprovacao: Boolean(resultado.precisaAprovacao),
      resposta_chars: resultado.resposta.length,
      menu_ja_enviado: menuJaEnviado,
      tool_calls: Array.isArray(resultado.toolCallsExecutadas)
        ? resultado.toolCallsExecutadas.slice(0, 8).map((t) => ({ nome: t.nome, ok: t.ok }))
        : [],
    });

    if (resultado.agenteSlug && agenteResponsavelLead !== resultado.agenteSlug) {
      await supabase.from("hub_leads_crm").update({ agente_responsavel: resultado.agenteSlug }).eq("id", lead.id);
      agenteResponsavelLead = resultado.agenteSlug;
    }

    const pedeMenuOpcoes = mensagemPedeMenuOuOpcoes(params.mensagemFinal);
    const usaPlaybookMaria = agenteUsaPlaybookMaria(agenteSlug);
    const menuTriagemNuncaEnviado = !leadJaRecebeuMenuTriagem(leadMetaRow?.metadata);
    const deveFallbackMenu =
      !playbookRouting.temPlaybookPublicado &&
      (pedeMenuOpcoes ||
        (!usaPlaybookMaria &&
          (params.isNovo || mensagemEhSaudacaoSimples(params.mensagemFinal))) ||
        (usaPlaybookMaria &&
          menuTriagemNuncaEnviado &&
          (params.isNovo || mensagemEhSaudacaoSimples(params.mensagemFinal))));

    if (!menuJaEnviado && deveFallbackMenu) {
      const { enviarMenuTriagemInicialUazapi, marcarMenuTriagemEnviado } = await import(
        "@/lib/whatsapp/menu-triagem-uazapi"
      );
      let instanceTokenFb = String(params.waSendOpts?.instanceToken || "").trim();
      if (!instanceTokenFb) {
        instanceTokenFb =
          typeof agente.uazapi_instance_token === "string" ? agente.uazapi_instance_token.trim() : "";
      }
      if (instanceTokenFb) {
        const menuFb = await enviarMenuTriagemInicialUazapi({
          telefone: params.telefone,
          instanceToken: instanceTokenFb,
          variante: "playbook_triagem",
        });
        if (menuFb.ok) {
          await marcarMenuTriagemEnviado(supabase, lead.id);
          log.info("wa.processor.menu_triagem_fallback_sent", {
            variante: "playbook_triagem",
            motivo: pedeMenuOpcoes ? "pedido_menu_texto" : "saudacao_ou_novo",
          });
          return;
        }
        log.warn("wa.processor.menu_triagem_fallback_failed", {
          erro: menuFb.erro,
          detalhe: menuFb.detalhe || null,
        });
      } else if (pedeMenuOpcoes) {
        log.warn("wa.processor.menu_triagem_sem_token", {
          agente_slug: agenteSlug,
          telefone: trace.maskTelefone(params.telefone),
        });
      }
    }

    if (!menuJaEnviado) {
      const jaEnviou = await respostaIaJaEnviadaRecente(supabase, lead.id, resultado.resposta);
      if (jaEnviou) {
        log.info("wa.processor.send_text_skip", {
          reason: "resposta_ia_duplicada_recente",
          telefone: trace.maskTelefone(params.telefone),
        });
      } else {
      const sendOut = await enviarMensagemWhatsApp(params.telefone, resultado.resposta, params.waSendOpts);
      const sendBodyPreview =
        sendOut.body && typeof sendOut.body === "object"
          ? JSON.stringify(sendOut.body).slice(0, 240)
          : typeof sendOut.body === "string"
            ? sendOut.body.slice(0, 240)
            : null;
      log.info("wa.processor.send_text", {
        ok: sendOut.ok,
        provider: sendOut.provider,
        send_status: sendOut.status,
        send_error: sendOut.ok ? null : sendOut.error,
        send_body_preview: sendBodyPreview,
        telefone: trace.maskTelefone(params.telefone),
      });
      }
    } else {
      log.info("wa.processor.send_text_skip", {
        reason: "tool_hub_whatsapp_menu_already_sent",
        telefone: trace.maskTelefone(params.telefone),
      });
    }

    if (!resultado.precisaAprovacao) {
      const slugEfetivo = resultado.agenteSlug || agenteSlug;
      const modeloUsado = resultado.modelo || "mistral-small-latest";
      const respostaTexto = resultado.resposta;
      const tokens = (resultado.tokens?.entrada ?? 0) + (resultado.tokens?.saida ?? 0);
      const custo =
        resultado.custo?.brl ??
        parseFloat(((tokens / 1000) * 0.00025 * 5.75).toFixed(4));

      let conversaId: string | null = null;
      try {
        const { data: convExist } = await supabase
          .from("hub_conversas")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("canal", "whatsapp")
          .is("encerrada_em", null)
          .maybeSingle();
        if (convExist) {
          conversaId = convExist.id;
          await supabase.from("hub_conversas").update({
            ultima_mensagem_em: new Date().toISOString(),
            ultima_mensagem_preview: respostaTexto.slice(0, 100),
          }).eq("id", conversaId);
        } else {
          const { data: convNova } = await supabase.from("hub_conversas").insert({
            lead_id: lead.id,
            canal: "whatsapp",
            status: "ativa",
            ia_ativa: true,
            ia_modelo: modeloUsado,
            total_mensagens: 2,
            ultima_mensagem_em: new Date().toISOString(),
            ultima_mensagem_preview: respostaTexto.slice(0, 100),
            aberta_em: new Date().toISOString(),
          }).select("id").single();
          if (convNova) conversaId = convNova.id;
        }
      } catch (e) {
        console.error("[WHATSAPP][PROCESSOR] hub_conversas:", e);
      }

      try {
        if (conversaId) {
          await supabase.from("hub_mensagens").insert([
            {
              conversa_id: conversaId,
              lead_id: lead.id,
              remetente: "lead",
              tipo_conteudo: params.tipoMidia,
              conteudo: params.mensagemFinal,
              whatsapp_message_id: params.messageId,
              enviada_em: params.timestamp,
            },
            {
              conversa_id: conversaId,
              lead_id: lead.id,
              remetente: "ia",
              agente_id: slugEfetivo,
              ia_modelo: modeloUsado,
              tipo_conteudo: "texto",
              conteudo: respostaTexto,
              enviada_em: new Date().toISOString(),
            },
          ]);
        }
      } catch (e) {
        console.error("[WHATSAPP][PROCESSOR] hub_mensagens:", e);
      }

      try {
        const { data: cicloRef } = await supabase
          .from("hub_ciclos_ia")
          .select("id")
          .eq("agente_slug", slugEfetivo)
          .maybeSingle();
        await supabase.from("hub_ciclos_log").insert({
          ciclo_id: cicloRef?.id ?? null,
          agente_slug: slugEfetivo,
          status: "sucesso",
          tokens_usados: tokens,
          custo_brl: custo,
          acoes_tomadas: { acao: "respondeu", lead_id: lead.id, mercado: params.mercado, isNovo: params.isNovo },
          iniciado_em: new Date().toISOString(),
          finalizado_em: new Date().toISOString(),
        });
      } catch (e) {
        console.error("[WHATSAPP][PROCESSOR] hub_ciclos_log:", e);
      }

      try {
        const { data: cicloCount } = await supabase
          .from("hub_ciclos_ia")
          .select("total_execucoes")
          .eq("agente_slug", slugEfetivo)
          .maybeSingle();
        if (cicloCount) {
          await supabase.from("hub_ciclos_ia").update({
            total_execucoes: (cicloCount.total_execucoes || 0) + 1,
            atualizado_em: new Date().toISOString(),
          }).eq("agente_slug", slugEfetivo);
        }
      } catch (e) {
        console.error("[WHATSAPP][PROCESSOR] hub_ciclos_ia:", e);
      }
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "erro_ia_desconhecido";
    log.error("wa.processor.ia_error", { error: errMsg, ia_duration_ms: Date.now() - iaStarted });
    await enviarFallbackIA({
      supabase,
      leadId: lead.id,
      telefone: params.telefone,
      agenteSlug,
      motivo: errMsg,
      mensagemOriginal: params.mensagemFinal,
      waSendOpts: params.waSendOpts,
    });
    log.info("wa.processor.fallback_sent", { motivo: errMsg });
  }
}
