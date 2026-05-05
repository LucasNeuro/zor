import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { identificarMercado, identificarIntencao } from "@/lib/ia/agentes-config";

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
  const url = process.env.EVOLUTION_API_URL;
  const key = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE || "obra10plus";

  if (!url || !key) {
    console.log("[WEBHOOK] EVOLUTION_API_URL ou KEY não configurados");
    return null;
  }

  try {
    const response = await fetch(`${url}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": key },
      body: JSON.stringify({ number: telefone, text: mensagem }),
    });
    return await response.json();
  } catch (error) {
    console.error("[WEBHOOK] Erro ao enviar mensagem:", error);
    return null;
  }
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
      .update({ atualizado_em: new Date().toISOString(), pessoa_id: pessoa?.id ?? leadExistente.pessoa_id })
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

  if (mercado === "imobiliario" || mercado === "arquitetura") {
    const { data } = await supabase
      .from("hub_agente_identidade")
      .select("*")
      .eq("agente_slug", "atendente")
      .single();
    if (data) return data;
  }

  const { data: agente } = await supabase
    .from("hub_agente_identidade")
    .select("*")
    .eq("ativo", true)
    .ilike("prefixo_mercado", `%${mercado.toUpperCase().slice(0, 3)}%`)
    .neq("agente_slug", "atendente")
    .maybeSingle();

  if (agente) return agente;

  const { data: sdr } = await supabase
    .from("hub_agente_identidade")
    .select("*")
    .eq("agente_slug", "sdr")
    .single();

  return sdr;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hub_mode      = searchParams.get("hub.mode");
  const hub_token     = searchParams.get("hub.verify_token");
  const hub_challenge = searchParams.get("hub.challenge");

  if (hub_mode === "subscribe" && hub_token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(hub_challenge, { status: 200 });
  }

  return NextResponse.json({ status: "ok", service: "obra10plus-webhook", version: "2.0" });
}

export async function POST(request: NextRequest) {
  const supabase = db();

  try {
    const body = await request.json();

    const event    = body.event as string | undefined;
    const data     = body.data as Record<string, unknown> | undefined;
    const instance = body.instance as string | undefined;

    if (event !== "messages.upsert") {
      return NextResponse.json({ status: "ignored", event });
    }

    if (!data) return NextResponse.json({ status: "no_data" });

    const msg       = data.message as Record<string, unknown> | undefined;
    const key       = data.key    as Record<string, unknown> | undefined;
    const fromMe    = (key?.fromMe as boolean) || false;
    const remoteJid = (key?.remoteJid as string) || "";
    const telefone  = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "").replace(/\D/g, "");
    const pushName  = (data.pushName as string) || "";
    const messageId = (key?.id as string) || "";
    const tsRaw     = data.messageTimestamp as number | undefined;
    const timestamp = tsRaw ? new Date(tsRaw * 1000).toISOString() : new Date().toISOString();

    const imageMsg  = msg?.imageMessage  as Record<string, unknown> | undefined;
    const videoMsg  = msg?.videoMessage  as Record<string, unknown> | undefined;
    const tipoMidia = imageMsg ? "imagem" : videoMsg ? "video"
      : msg?.audioMessage ? "audio" : msg?.documentMessage ? "documento" : "texto";

    const texto = (msg?.conversation as string)
      || ((msg?.extendedTextMessage as Record<string, unknown>)?.text as string)
      || (imageMsg?.caption as string)
      || (videoMsg?.caption as string)
      || "";

    if (fromMe) return NextResponse.json({ status: "outgoing_ignored" });
    if (!telefone || remoteJid.endsWith("@g.us")) return NextResponse.json({ status: "group_ignored" });
    if (!texto && tipoMidia === "texto") return NextResponse.json({ status: "empty_message" });

    const mensagemFinal = texto || `[${tipoMidia} recebido]`;

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

          if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) {
            const boas_vindas = `Olá${pushName ? `, ${pushName.split(" ")[0]}` : ""}! 👋\n\nQue ótimo que você tem interesse em ser parceiro da Obra10+!\n\nVou te enviar o link de cadastro em instantes. Um de nossos consultores também vai entrar em contato para explicar como funciona o programa.\n\nAté já! 🏆`;
            await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/obra10plus`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": process.env.EVOLUTION_API_KEY },
              body: JSON.stringify({ number: telefone, text: boas_vindas }),
            }).catch(() => {});
          }
        }
      }

      await supabase.from("hub_alertas").insert({
        agente_slug: "diretor",
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

        if (contatos && contatos.length > 0 && process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) {
          const msg = `🔔 *Novo lead recebido!*\n\n*Nome:* ${pushName || telefone}\n*Mercado:* ${mercado}\n*Mensagem:* ${mensagemFinal.slice(0, 100)}\n\nAcesse o CRM para acompanhar.`;
          await Promise.allSettled(
            contatos
              .filter(c => c.canal === "whatsapp" || c.canal === "ambos")
              .map(c =>
                fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/obra10plus`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "apikey": process.env.EVOLUTION_API_KEY! },
                  body: JSON.stringify({ number: c.telefone, text: msg }),
                })
              )
          );
        }
      } catch (e) { console.error("[WEBHOOK] Erro notificação:", e); }
    }

    if (IA_ATIVA && agente) {
      try {
        const { construirPrompt } = await import("@/lib/ia/prompt-builder");
        const promptData = await construirPrompt({
          agenteSlug: agente.agente_slug,
          leadId: lead.id,
          mercado,
          mensagemAtual: mensagemFinal,
        });

        if (promptData) {
          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

          const response = await client.messages.create({
            model: promptData.modelo,
            max_tokens: 1024,
            system: promptData.systemPrompt,
            messages: [{ role: "user", content: mensagemFinal }],
          });

          const respostaTexto = response.content[0].type === "text" ? response.content[0].text : "";

          await supabase.from("hub_fila_mensagens").insert({
            lead_id: lead.id,
            agente_id: agente.agente_slug,
            canal: "whatsapp",
            direcao: "saida",
            conteudo: respostaTexto,
            status: "pendente_envio",
            metadata: { feito_por: "ia", modelo: promptData.modelo, tokens: response.usage },
          });

          await enviarMensagemWhatsApp(telefone, respostaTexto);
        }
      } catch (e) {
        console.error("[WEBHOOK] Erro IA:", e);
      }
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
