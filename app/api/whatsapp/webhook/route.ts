import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { identificarMercado, identificarIntencao } from "@/lib/ia/agentes-config";
import { defaultTenantId } from "@/lib/tenant-default";
import { whatsappSendText } from "@/lib/whatsapp/whatsapp-send";
import { parseWhatsappWebhookBody } from "@/lib/whatsapp/webhook-inbound";

let warnedMissingWebhookSecret = false;

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Verifica origem do webhook quando WEBHOOK_SECRET está definido (HMAC ou segredo em header/Bearer). Exportado apenas para testes. */
export function webhookAutenticado(request: NextRequest, rawBody: string, secret: string): boolean {
  const sig =
    request.headers.get("x-hub-signature-256") ||
    request.headers.get("x-signature") ||
    request.headers.get("x-evolution-signature");

  if (sig) {
    const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
    let incoming = sig.trim();
    if (incoming.startsWith("sha256=")) incoming = incoming.slice(7);
    try {
      const a = Buffer.from(incoming, "hex");
      const b = Buffer.from(expectedHex, "hex");
      if (a.length === b.length && a.length > 0) return timingSafeEqual(a, b);
    } catch {
      /* fallthrough */
    }
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (timingSafeStringEqual(token, secret)) return true;
  }

  const headerName = (process.env.WEBHOOK_SECRET_HEADER || "x-webhook-secret").toLowerCase();
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase() === headerName && timingSafeStringEqual((value || "").trim(), secret)) {
      return true;
    }
  }

  return false;
}

const IA_ATIVA = process.env.ANTHROPIC_API_KEY ? true : false;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function encontrarOuCriarPessoa(telefone: string, nome: string, origem: string) {
  const supabase = db();

  const { data: pessoaExistente } = await supabase
    .from("hub_pessoas")
    .select("*")
    .eq("telefone", telefone)
    .maybeSingle();

  if (pessoaExistente) return pessoaExistente;

  const { count } = await supabase
    .from("hub_pessoas")
    .select("*", { count: "exact", head: true });
  const seq = String((count || 0) + 1).padStart(4, "0");
  const codigo = `PES-${new Date().getFullYear()}-${seq}`;

  const { data: novaPessoa } = await supabase
    .from("hub_pessoas")
    .insert({
      codigo,
      nome: nome || `Lead WhatsApp`,
      telefone,
      whatsapp_id: telefone,
      tipo: "lead",
      origem: origem || "whatsapp",
    })
    .select()
    .single();

  return novaPessoa;
}

async function enviarMensagemWhatsApp(telefone: string, mensagem: string) {
  const r = await whatsappSendText(telefone, mensagem);
  if (!r.ok) {
    console.error("[WEBHOOK] Erro ao enviar mensagem:", r.provider, r.error, r.status, r.body);
    return null;
  }
  return r.body ?? null;
}

async function encontrarOuCriarLead(telefone: string, nome: string, mercado: string, mensagem: string) {
  const supabase = db();

  const pessoa = await encontrarOuCriarPessoa(telefone, nome, "whatsapp");

  const { data: leadExistente } = await supabase
    .from("hub_leads_crm")
    .select("*")
    .eq("telefone", telefone)
    .maybeSingle();

  if (leadExistente) {
    await supabase
      .from("hub_leads_crm")
      .update({
        atualizado_em: new Date().toISOString(),
        pessoa_id: pessoa?.id ?? leadExistente.pessoa_id,
        tenant_id: leadExistente.tenant_id || defaultTenantId(),
      })
      .eq("id", leadExistente.id);

    await supabase.from("hub_memorias_lead").insert({
      lead_id: leadExistente.id,
      chave: "retorno_wa",
      valor: mensagem.slice(0, 100),
      confianca: 0.8,
      criado_por: "whatsapp",
    });

    return { lead: leadExistente, isNovo: false };
  }

  const agenteResponsavel = mercado === "imobiliario" || mercado === "arquitetura" ? "atendente" : "sdr";

  const { data: novoLead, error } = await supabase
    .from("hub_leads_crm")
    .insert({
      nome: nome || `Lead ${telefone.slice(-4)}`,
      telefone,
      origem: "whatsapp",
      estagio: "novo",
      score: 10,
      valor_estimado: 0,
      agente_responsavel: agenteResponsavel,
      pessoa_id: pessoa?.id ?? null,
      tenant_id: defaultTenantId(),
      metadata: { mercado, primeira_mensagem: mensagem.slice(0, 200) },
    })
    .select()
    .single();

  if (error || !novoLead) {
    console.error("[WEBHOOK] Erro ao criar lead:", error);
    return { lead: null, isNovo: false };
  }

  await Promise.all([
    // TABELA 1: hub_memorias_lead — memórias do lead
    supabase.from("hub_memorias_lead").insert([
      {
        lead_id: novoLead.id,
        chave: "telefone",
        valor: telefone,
        confianca: 1.0,
        criado_por: "sistema",
      },
      {
        lead_id: novoLead.id,
        chave: "mercado",
        valor: mercado,
        confianca: 0.9,
        criado_por: "analise",
      },
      {
        lead_id: novoLead.id,
        chave: "nome",
        valor: nome || `Lead ${telefone.slice(-4)}`,
        confianca: 0.9,
        criado_por: "whatsapp",
      },
    ]),

    // TABELA 2: hub_atividades — timeline do lead
    supabase.from("hub_atividades").insert({
      lead_id: novoLead.id,
      tipo: "mensagem",
      descricao: `Novo lead via WhatsApp — mercado: ${mercado} — mensagem: ${mensagem.slice(0, 100)}`,
      feito_por: "sistema",
      feito_por_tipo: "ia",
      metadata: { telefone, mercado, primeira_mensagem: true },
    }),
  ]);

  return { lead: novoLead, isNovo: true };
}

async function buscarAgente(mercado: string) {
  const supabase = db();
  const tenantId = defaultTenantId();

  if (mercado === "imobiliario" || mercado === "arquitetura") {
    let data: Record<string, unknown> | null = null;
    {
      const r = await supabase
        .from("hub_agente_identidade")
        .select("*")
        .eq("agente_slug", "atendente")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .is("arquivado_em", null)
        .maybeSingle();
      data = (r.data as Record<string, unknown> | null) ?? null;
      if (!data && r.error?.message?.includes("tenant_id")) {
        const fallback = await supabase
          .from("hub_agente_identidade")
          .select("*")
          .eq("agente_slug", "atendente")
          .eq("ativo", true)
          .is("arquivado_em", null)
          .maybeSingle();
        data = (fallback.data as Record<string, unknown> | null) ?? null;
      }
    }
    if (data) return data;
  }

  let agente: Record<string, unknown> | null = null;
  let agenteErr: { message?: string } | null = null;
  {
    const r = await supabase
      .from("hub_agente_identidade")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .is("arquivado_em", null)
      .ilike("prefixo_mercado", `%${mercado.toUpperCase().slice(0, 3)}%`)
      .neq("agente_slug", "atendente")
      .maybeSingle();
    agente = (r.data as Record<string, unknown> | null) ?? null;
    agenteErr = r.error as { message?: string } | null;
  }

  if (agenteErr?.message?.includes("tenant_id")) {
    const r = await supabase
      .from("hub_agente_identidade")
      .select("*")
      .eq("ativo", true)
      .is("arquivado_em", null)
      .ilike("prefixo_mercado", `%${mercado.toUpperCase().slice(0, 3)}%`)
      .neq("agente_slug", "atendente")
      .maybeSingle();
    agente = (r.data as Record<string, unknown> | null) ?? null;
  }

  if (agente) return agente;

  let sdr: Record<string, unknown> | null = null;
  {
    const r = await supabase
      .from("hub_agente_identidade")
      .select("*")
      .eq("agente_slug", "sdr")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .is("arquivado_em", null)
      .maybeSingle();
    sdr = (r.data as Record<string, unknown> | null) ?? null;
    if (!sdr && r.error?.message?.includes("tenant_id")) {
      const fallback = await supabase
        .from("hub_agente_identidade")
        .select("*")
        .eq("agente_slug", "sdr")
        .eq("ativo", true)
        .is("arquivado_em", null)
        .maybeSingle();
      sdr = (fallback.data as Record<string, unknown> | null) ?? null;
    }
  }

  return sdr;
}

async function enviarFallbackIA(params: {
  supabase: ReturnType<typeof db>;
  leadId: string;
  telefone: string;
  agenteSlug?: string;
  motivo: string;
  mensagemOriginal: string;
}) {
  const mensagem = "Recebi sua mensagem e já encaminhei para revisão do time. Retornaremos em breve por aqui.";

  try {
    await params.supabase.from("hub_fila_mensagens").insert({
      lead_id: params.leadId,
      agente_id: params.agenteSlug || "sdr",
      canal: "whatsapp",
      direcao: "saida",
      conteudo: mensagem,
      status: "fallback_enviado",
      tenant_id: defaultTenantId(),
      metadata: { feito_por: "fallback_ia", motivo: params.motivo },
    });
  } catch (e) {
    console.error("[WEBHOOK][FALLBACK] Erro ao gravar fila:", e);
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
    console.error("[WEBHOOK][FALLBACK] Erro ao registrar alerta:", e);
  }

  await enviarMensagemWhatsApp(params.telefone, mensagem);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hub_mode      = searchParams.get("hub.mode");
  const hub_token     = searchParams.get("hub.verify_token");
  const hub_challenge = searchParams.get("hub.challenge");

  if (hub_mode === "subscribe") {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (expected && hub_token === expected && hub_challenge) {
      return new NextResponse(hub_challenge, { status: 200 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ status: "ok", service: "obra10plus-webhook", version: "2.0" });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    const skipVerify = process.env.NODE_ENV !== "production" && process.env.WEBHOOK_SKIP_SIGNATURE_VERIFY === "true";
    const secret = process.env.WEBHOOK_SECRET?.trim();

    if (process.env.NODE_ENV === "production" && !secret) {
      console.error("[WEBHOOK] WEBHOOK_SECRET obrigatório em produção.");
      return NextResponse.json({ error: "Webhook não configurado" }, { status: 500 });
    }

    if (secret && !skipVerify) {
      if (!webhookAutenticado(request, rawBody, secret)) {
        console.warn("[WEBHOOK] Falha na verificação (HMAC ou header/Bearer)");
        return NextResponse.json(
          {
            error: "Não autorizado",
            code: "WEBHOOK_AUTH_FAILED",
            message:
              "Falha na verificação do webhook (HMAC SHA-256 ou credencial Bearer/cabeçalho não confere com WEBHOOK_SECRET).",
          },
          { status: 401 }
        );
      }
    } else if (!secret && !skipVerify) {
      if (!warnedMissingWebhookSecret) {
        warnedMissingWebhookSecret = true;
        console.warn(
          "[WEBHOOK] WEBHOOK_SECRET não definido — webhook aceita qualquer origem. Defina WEBHOOK_SECRET e alinhe Evolution/UAZAPI (header ou HMAC). Em urgência local: WEBHOOK_SKIP_SIGNATURE_VERIFY=true"
        );
      }
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const supabase = db();

    const inbound = parseWhatsappWebhookBody(body);
    if (inbound.kind === "ignored") {
      return NextResponse.json({ status: inbound.status });
    }
    if (inbound.kind === "unknown_event") {
      return NextResponse.json({ status: "ignored", event: inbound.event });
    }

    const {
      telefone,
      pushName,
      messageId,
      timestamp,
      tipoMidia,
      mensagemFinal,
      instance,
    } = inbound.value;

    console.log(`[WEBHOOK] ${pushName || telefone}: ${mensagemFinal.slice(0, 80)}`);

    const intencao = identificarIntencao(mensagemFinal);
    const mercado = identificarMercado(mensagemFinal);

    // Roteamento para parceiro
    if (intencao === "parceiro") {
      const telLimpo = telefone.replace(/\D/g, "");
      const { data: parceiroExistente } = await supabase
        .from("hub_parceiros")
        .select("id, nome, status, modulo_atual")
        .eq("telefone", telLimpo)
        .maybeSingle();

      if (!parceiroExistente) {
        const { data: novoParceiro } = await supabase.from("hub_parceiros").insert({
          nome: pushName || `Parceiro ${telLimpo.slice(-4)}`,
          telefone: telLimpo,
          status: "captacao",
          tenant_id: defaultTenantId(),
        }).select("id").single();

        if (novoParceiro) {
          await supabase.from("hub_parceiros_captacao").insert({
            parceiro_id: novoParceiro.id,
            estagio: "interessado",
            origem: "whatsapp",
            canal: "whatsapp",
          });
          await supabase.from("hub_parceiros_log").insert({
            parceiro_id: novoParceiro.id,
            evento: "captado_via_whatsapp",
            descricao: `Parceiro captado via WhatsApp — mensagem: "${mensagemFinal.slice(0, 100)}"`,
            feito_por: "webhook",
            feito_por_tipo: "sistema",
            dados: { telefone: telLimpo, pushName, mensagem: mensagemFinal.slice(0, 200) },
          });

          const boas_vindas = `Olá${pushName ? `, ${pushName.split(" ")[0]}` : ""}! 👋\n\nQue ótimo que você tem interesse em ser parceiro da Obra10+!\n\nVou te enviar o link de cadastro em instantes. Um de nossos consultores também vai entrar em contato para explicar como funciona o programa.\n\nAté já! 🏆`;
          await enviarMensagemWhatsApp(telefone, boas_vindas);
        }
      }

      await supabase.from("hub_alertas").insert({
        agente_slug: "diretor_geral_ia",
        tipo: "importante",
        titulo: "Novo interesse de parceiro via WhatsApp",
        mensagem: `${pushName || telefone} perguntou sobre parceria: "${mensagemFinal.slice(0, 80)}"`,
        lead_id: null,
        dados: { telefone, pushName, mensagem: mensagemFinal },
      });

      return NextResponse.json({ status: "ok", intencao: "parceiro", telefone });
    }

    const { lead, isNovo } = await encontrarOuCriarLead(telefone, pushName, mercado, mensagemFinal);

    if (!lead) {
      return NextResponse.json({ status: "erro", erro: "Falha ao criar lead" }, { status: 500 });
    }

    // TABELA 3: hub_fila_mensagens
    await supabase.from("hub_fila_mensagens").insert({
      lead_id:   lead.id,
      agente_id: lead.agente_responsavel || "sdr",
      canal:     "whatsapp",
      direcao:   "entrada",
      conteudo:  mensagemFinal,
      status:    "pendente",
      tenant_id: defaultTenantId(),
      metadata:  { telefone, pushName, messageId, timestamp, mercado, instance, isNovo, tipoMidia },
    });

    // TABELA 4: hub_acoes_ia
    const agente = await buscarAgente(mercado);

    await supabase.from("hub_acoes_ia").insert({
      agente_slug: agente?.agente_slug || "sdr",
      tipo:        isNovo ? "novo_lead" : "lead_retornou",
      descricao:   `${isNovo ? "Novo lead" : "Lead retornou"} — mercado: ${mercado} — "${mensagemFinal.slice(0, 50)}"`,
      lead_id:     lead.id,
      sucesso:     true,
      metadata:    { telefone, mercado, isNovo, agente: agente?.agente_slug },
    });

    if (agente && lead.agente_responsavel !== agente.agente_slug) {
      await supabase
        .from("hub_leads_crm")
        .update({ agente_responsavel: agente.agente_slug })
        .eq("id", lead.id);
    }

    if (isNovo) {
      try {
        const { data: contatos } = await supabase
          .from("hub_contatos_notificacao")
          .select("telefone, receber_novo_lead, canal")
          .eq("ativo", true)
          .eq("receber_novo_lead", true);

        if (contatos && contatos.length > 0) {
          const msg = `🔔 *Novo lead recebido!*\n\n*Nome:* ${pushName || telefone}\n*Mercado:* ${mercado}\n*Mensagem:* ${mensagemFinal.slice(0, 100)}\n\nAcesse o CRM para acompanhar.`;
          await Promise.allSettled(
            contatos
              .filter(c => c.canal === "whatsapp" || c.canal === "ambos")
              .map((c) => enviarMensagemWhatsApp(c.telefone, msg))
          );
        }
      } catch (e) { console.error("[WEBHOOK] Erro notificação:", e); }
    }

    const humanoResponsavelAtivo =
      typeof lead.humano_responsavel === "string" && lead.humano_responsavel.trim().length > 0;

    if (humanoResponsavelAtivo) {
      try {
        await supabase.from("hub_atividades").insert({
          lead_id: lead.id,
          tipo: "mensagem",
          descricao: `Mensagem recebida — humano (${lead.humano_responsavel.trim()}) a atender — IA não acionada.`,
          feito_por: "sistema",
          feito_por_tipo: "ia",
          metadata: { telefone, humano_responsavel: lead.humano_responsavel, skip_ia: true },
        });
      } catch (e) {
        console.error("[WEBHOOK] Erro ao registrar atividade (humano responsável):", e);
      }
    } else if (IA_ATIVA && agente) {
      const agenteSlug =
        typeof agente.agente_slug === "string" ? agente.agente_slug : "sdr";
      try {
        const { processarMensagem } = await import("@/lib/ia/engine");
        const resultado = await processarMensagem({
          leadId: lead.id,
          mensagem: mensagemFinal,
          canal: "whatsapp",
          telefone,
          nome: pushName,
          segmento: mercado,
          agenteSlugHint: agenteSlug,
          tenantId: defaultTenantId(),
          statusFilaSaida: "pendente_envio",
          metadata: {
            telefone,
            pushName,
            messageId,
            timestamp,
            mercado,
            instance,
            isNovo,
            tipoMidia,
          },
        });

        if (!resultado.sucesso || !resultado.resposta) {
          await enviarFallbackIA({
            supabase,
            leadId: lead.id,
            telefone,
            agenteSlug,
            motivo: resultado.erro || "engine_sem_resposta",
            mensagemOriginal: mensagemFinal,
          });
        } else {
          if (resultado.agenteSlug && lead.agente_responsavel !== resultado.agenteSlug) {
            await supabase
              .from("hub_leads_crm")
              .update({ agente_responsavel: resultado.agenteSlug })
              .eq("id", lead.id);
          }

          await enviarMensagemWhatsApp(telefone, resultado.resposta);

          if (!resultado.precisaAprovacao) {
            const slugEfetivo = resultado.agenteSlug || agenteSlug;
            const modeloUsado = resultado.modelo || "claude-haiku-4-5";
            const respostaTexto = resultado.resposta;
            const _obsTokens =
              (resultado.tokens?.entrada ?? 0) + (resultado.tokens?.saida ?? 0);
            const _obsCusto =
              resultado.custo?.brl ??
              parseFloat(((_obsTokens / 1000) * 0.00025 * 5.75).toFixed(4));

            // === OBSERVABILIDADE (hub_prompt_logs fica no engine) ===
            // 1. hub_conversas — reusar conversa aberta ou criar nova
            let _obsConversaId: string | null = null;
            try {
              const { data: _convExist } = await supabase
                .from("hub_conversas")
                .select("id")
                .eq("lead_id", lead.id)
                .eq("canal", "whatsapp")
                .is("encerrada_em", null)
                .maybeSingle();
              if (_convExist) {
                _obsConversaId = _convExist.id;
                await supabase.from("hub_conversas").update({
                  ultima_mensagem_em:      new Date().toISOString(),
                  ultima_mensagem_preview: respostaTexto.slice(0, 100),
                }).eq("id", _obsConversaId);
              } else {
                const { data: _convNova } = await supabase.from("hub_conversas").insert({
                  lead_id:                 lead.id,
                  canal:                   "whatsapp",
                  status:                  "ativa",
                  ia_ativa:                true,
                  ia_modelo:               modeloUsado,
                  total_mensagens:         2,
                  ultima_mensagem_em:      new Date().toISOString(),
                  ultima_mensagem_preview: respostaTexto.slice(0, 100),
                  aberta_em:               new Date().toISOString(),
                }).select("id").single();
                if (_convNova) _obsConversaId = _convNova.id;
              }
            } catch (e) { console.error("[OBS] hub_conversas:", e); }

            // 2. hub_mensagens x2 — mensagem do lead + resposta da IA
            try {
              if (_obsConversaId) {
                await supabase.from("hub_mensagens").insert([
                  {
                    conversa_id:         _obsConversaId,
                    lead_id:             lead.id,
                    remetente:           "lead",
                    tipo_conteudo:       tipoMidia,
                    conteudo:            mensagemFinal,
                    whatsapp_message_id: messageId,
                    enviada_em:          timestamp,
                  },
                  {
                    conversa_id:   _obsConversaId,
                    lead_id:       lead.id,
                    remetente:     "ia",
                    agente_id:     slugEfetivo,
                    ia_modelo:     modeloUsado,
                    tipo_conteudo: "texto",
                    conteudo:      respostaTexto,
                    enviada_em:    new Date().toISOString(),
                  },
                ]);
              }
            } catch (e) { console.error("[OBS] hub_mensagens:", e); }

            // 3. hub_ciclos_log
            try {
              const { data: _cicloRef } = await supabase
                .from("hub_ciclos_ia")
                .select("id")
                .eq("agente_slug", slugEfetivo)
                .maybeSingle();
              await supabase.from("hub_ciclos_log").insert({
                ciclo_id:      _cicloRef?.id ?? null,
                agente_slug:   slugEfetivo,
                status:        "sucesso",
                tokens_usados: _obsTokens,
                custo_brl:     _obsCusto,
                acoes_tomadas: { acao: "respondeu", lead_id: lead.id, mercado, isNovo },
                iniciado_em:   new Date().toISOString(),
                finalizado_em: new Date().toISOString(),
              });
            } catch (e) { console.error("[OBS] hub_ciclos_log:", e); }

            // 4. hub_ciclos_ia — incrementa total_execucoes
            try {
              const { data: _cicloCount } = await supabase
                .from("hub_ciclos_ia")
                .select("total_execucoes")
                .eq("agente_slug", slugEfetivo)
                .maybeSingle();
              if (_cicloCount) {
                await supabase.from("hub_ciclos_ia").update({
                  total_execucoes: (_cicloCount.total_execucoes || 0) + 1,
                  atualizado_em:   new Date().toISOString(),
                }).eq("agente_slug", slugEfetivo);
              }
            } catch (e) { console.error("[OBS] hub_ciclos_ia:", e); }
          }
        }
      } catch (e) {
        console.error("[WEBHOOK] Erro IA:", e);
        await enviarFallbackIA({
          supabase,
          leadId: lead.id,
          telefone,
          agenteSlug,
          motivo: e instanceof Error ? e.message : "erro_ia_desconhecido",
          mensagemOriginal: mensagemFinal,
        });
      }
    } else if (!humanoResponsavelAtivo) {
      await enviarFallbackIA({
        supabase,
        leadId: lead.id,
        telefone,
        agenteSlug: agente?.agente_slug as string | undefined,
        motivo: IA_ATIVA ? "agente_nao_encontrado" : "anthropic_api_key_ausente",
        mensagemOriginal: mensagemFinal,
      });
    }

    return NextResponse.json({
      status:        "ok",
      lead_id:       lead.id,
      mercado,
      agente:        agente?.agente_slug,
      isNovo,
      tabelasSalvas: ["hub_pessoas", "hub_leads_crm", "hub_memorias_lead", "hub_fila_mensagens", "hub_acoes_ia", "hub_contatos_notificacao"],
    });

  } catch (erro) {
    const errMsg = erro instanceof Error ? erro.message : "Erro desconhecido";
    console.error("[WEBHOOK] Erro:", errMsg);
    return NextResponse.json({ status: "erro", erro: errMsg }, { status: 500 });
  }
}
