import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { identificarMercado } from "@/lib/ia/agentes-config";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function encontrarOuCriarLead(telefone: string, nome: string, mercado: string, mensagem: string) {
  const supabase = db();

  const { data: leadExistente } = await supabase
    .from("hub_leads_crm")
    .select("*")
    .eq("telefone", telefone)
    .maybeSingle();

  if (leadExistente) {
    await supabase
      .from("hub_leads_crm")
      .update({ atualizado_em: new Date().toISOString() })
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

  const agenteResponsavel = mercado === "imobiliario" || mercado === "arquitetura" ? "mari" : "sdr";

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
      .eq("agente_slug", "mari")
      .single();
    if (data) return data;
  }

  const { data: agente } = await supabase
    .from("hub_agente_identidade")
    .select("*")
    .eq("ativo", true)
    .ilike("prefixo_mercado", `%${mercado.toUpperCase().slice(0, 3)}%`)
    .neq("agente_slug", "mari")
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

    const mercado = identificarMercado(mensagemFinal);

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

    return NextResponse.json({
      status:        "ok",
      lead_id:       lead.id,
      mercado,
      agente:        agente?.agente_slug,
      isNovo,
      tabelasSalvas: ["hub_leads_crm", "hub_memorias_lead", "hub_fila_mensagens", "hub_acoes_ia"],
    });

  } catch (erro) {
    const errMsg = erro instanceof Error ? erro.message : "Erro desconhecido";
    console.error("[WEBHOOK] Erro:", errMsg);
    return NextResponse.json({ status: "erro", erro: errMsg }, { status: 500 });
  }
}
