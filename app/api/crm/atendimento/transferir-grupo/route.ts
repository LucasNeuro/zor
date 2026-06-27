import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { cancelarJobsIaPendentesTelefone } from "@/lib/whatsapp/human-handoff-from-device";
import { leadMetadataRecord } from "@/lib/whatsapp/lead-group-routing";
import { resolverTokenInstanciaWhatsapp } from "@/lib/crm/resolver-token-whatsapp";
import { uazapiCreateGroup, uazapiSendTextToGroup } from "@/lib/whatsapp/uazapi-group";
import { whatsappConfigured } from "@/lib/whatsapp/whatsapp-send";

import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import { normalizarTelefoneAtendente } from "@/lib/crm/atendentes-crm";

type TransferirGrupoBody = {
  leadId?: string;
  atendenteId?: string;
  vendedorTelefone?: string;
  vendedorNome?: string;
  vendedorSlug?: string;
  mensagemBoasVindas?: string;
};

function slugFromText(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? slug.slice(0, 80) : null;
}

async function resolverSlugUsuarioLogado(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<string | null> {
  const authId = request.headers.get("x-caller-auth-id")?.trim();
  if (!authId) return null;

  const { data: user } = await supabase
    .from("users")
    .select("name, email")
    .eq("auth_id", authId)
    .maybeSingle();

  if (!user) return null;

  const emailLocal = typeof user.email === "string" ? user.email.split("@")[0] : "";
  const fromEmail = slugFromText(emailLocal);
  if (fromEmail) return fromEmail;
  const fromName = slugFromText(typeof user.name === "string" ? user.name : "");
  if (fromName) return fromName;
  return null;
}

function slugHumanoFallback(): string {
  const fromEnv = process.env.WHATSAPP_DEVICE_HUMAN_SLUG?.trim();
  if (fromEnv) return fromEnv.slice(0, 80);
  return "operador";
}

function resolverHumanoResponsavel(body: TransferirGrupoBody): string {
  const fromSlug = slugFromText(body.vendedorSlug);
  if (fromSlug) return fromSlug;
  const fromNome = slugFromText(body.vendedorNome);
  if (fromNome) return fromNome;
  return slugHumanoFallback();
}

function mensagemBoasVindasPadrao(leadNome: string, vendedorNome?: string): string {
  const vendedor = vendedorNome?.trim();
  if (vendedor) {
    return `Olá! Este grupo foi criado para o atendimento de ${leadNome}. ${vendedor} irá acompanhar a conversa a partir de agora.`;
  }
  return `Olá! Este grupo foi criado para o atendimento de ${leadNome}. Um consultor irá acompanhar a conversa a partir de agora.`;
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) {
    return NextResponse.json({ error: configErr }, { status: 503 });
  }

  let body: TransferirGrupoBody;
  try {
    body = (await request.json()) as TransferirGrupoBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const leadId = body.leadId?.trim();
  if (!leadId) {
    return NextResponse.json({ error: "leadId é obrigatório" }, { status: 400 });
  }

  const supabase = crmDb();
  const tenantId = await resolveTenantIdFromCaller(request);

  let vendedorTelefone = normalizarTelefoneAtendente(body.vendedorTelefone ?? "");
  let vendedorNome = body.vendedorNome?.trim() || undefined;
  let vendedorSlugBody = body.vendedorSlug?.trim() || undefined;
  let atendenteId: string | undefined;

  const atendenteIdRaw = body.atendenteId?.trim();
  if (atendenteIdRaw) {
    const { data: atendente, error: atErr } = await supabase
      .from("hub_atendentes_crm")
      .select("id, nome, telefone, slug, agente_slug, ativo")
      .eq("id", atendenteIdRaw)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (atErr) {
      return NextResponse.json({ error: atErr.message }, { status: 500 });
    }
    if (!atendente || atendente.ativo === false) {
      return NextResponse.json({ error: "Atendente não encontrado ou inativo." }, { status: 404 });
    }

    atendenteId = String(atendente.id);
    vendedorTelefone = normalizarTelefoneAtendente(String(atendente.telefone ?? ""));
    vendedorNome = vendedorNome || String(atendente.nome ?? "").trim() || undefined;
    vendedorSlugBody =
      vendedorSlugBody || (typeof atendente.slug === "string" ? atendente.slug.trim() : "") || undefined;
  }

  if (vendedorTelefone.length < 10) {
    return NextResponse.json({ error: "vendedorTelefone inválido ou atendente sem telefone" }, { status: 400 });
  }

  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, metadata, agente_responsavel, humano_responsavel")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) {
    return NextResponse.json({ error: leadErr.message }, { status: 500 });
  }
  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const leadTelefone = telefoneConversaId(lead.telefone ?? "");
  if (leadTelefone.length < 10) {
    return NextResponse.json({ error: "Lead sem telefone válido" }, { status: 400 });
  }

  const metaBase = leadMetadataRecord(lead.metadata);
  const jidExistente =
    typeof metaBase.whatsapp_group_jid === "string" ? metaBase.whatsapp_group_jid.trim() : "";
  if (metaBase.canal_ativo === "group" && jidExistente) {
    return NextResponse.json(
      {
        error: "Lead já transferido para grupo WhatsApp",
        groupJid: jidExistente,
      },
      { status: 409 }
    );
  }

  const { token: instanceToken, origem: tokenOrigem } = await resolverTokenInstanciaWhatsapp(
    supabase,
    lead.agente_responsavel
  );

  if (!whatsappConfigured({ instanceToken })) {
    return NextResponse.json(
      {
        error: "WhatsApp não configurado. Reconecte o canal em Agentes → Canais.",
        tokenOrigem,
      },
      { status: 502 }
    );
  }

  const leadNome = (typeof lead.nome === "string" && lead.nome.trim()) || "Lead";
  const groupName = `Atendimento · ${leadNome}`.slice(0, 100);
  const humanoSlug = resolverHumanoResponsavel({
    ...body,
    vendedorNome,
    vendedorSlug: vendedorSlugBody,
  });
  const transferidoPor =
    (await resolverSlugUsuarioLogado(supabase, request)) ?? slugHumanoFallback();
  const agora = new Date().toISOString();

  const criacao = await uazapiCreateGroup(
    groupName,
    [leadTelefone, vendedorTelefone],
    instanceToken
  );

  if (!criacao.ok) {
    const is401 = criacao.status === 401;
    const errorDetail = is401
      ? `${criacao.error} Reconecte o WhatsApp em Agentes → Canais.`
      : criacao.error;
    return NextResponse.json(
      {
        error: errorDetail,
        status: criacao.status,
        body: criacao.body,
        tokenOrigem,
      },
      { status: is401 ? 401 : 502 }
    );
  }

  const leadPatch = {
    humano_responsavel: humanoSlug,
    atualizado_em: agora,
    ultimo_contato: agora,
    metadata: {
      ...metaBase,
      canal_ativo: "group",
      whatsapp_group_jid: criacao.groupJid,
      transferido_em: agora,
      transferido_por: transferidoPor,
      vendedor_telefone: vendedorTelefone,
      ...(vendedorNome ? { vendedor_nome: vendedorNome } : {}),
      ...(atendenteId ? { atendente_id: atendenteId } : {}),
      fase_atendimento: "atendimento_humano",
      token_whatsapp_origem: tokenOrigem,
    },
  };

  let upd = await supabase.from("hub_leads_crm").update(leadPatch).eq("id", leadId);
  if (upd.error && isMissingPgColumn(upd.error, "ultimo_contato")) {
    const { ultimo_contato: _u, ...semUltimo } = leadPatch;
    upd = await supabase.from("hub_leads_crm").update(semUltimo).eq("id", leadId);
  }
  if (upd.error) {
    return NextResponse.json(
      {
        error: `Grupo criado (${criacao.groupJid}) mas falha ao atualizar lead: ${upd.error.message}`,
        groupJid: criacao.groupJid,
        groupName: criacao.groupName,
      },
      { status: 500 }
    );
  }

  const jobsCancelados = await cancelarJobsIaPendentesTelefone(supabase, leadTelefone);

  const boasVindas =
    body.mensagemBoasVindas?.trim() || mensagemBoasVindasPadrao(leadNome, vendedorNome);

  let welcomeSent = false;
  let welcomeError: string | undefined;
  if (boasVindas) {
    const envio = await uazapiSendTextToGroup(criacao.groupJid, boasVindas, instanceToken);
    welcomeSent = envio.ok;
    if (!envio.ok) {
      welcomeError = envio.error;
      console.warn("[TRANSFERIR-GRUPO] boas-vindas:", envio.error);
    }
  }

  try {
    await supabase.from("hub_atividades").insert({
      lead_id: leadId,
      tipo: "ia_acao",
      descricao: `Conversa transferida para grupo WhatsApp (${criacao.groupName}).`,
      feito_por: transferidoPor,
      feito_por_tipo: "humano",
      metadata: {
        canal_ativo: "group",
        whatsapp_group_jid: criacao.groupJid,
        group_name: criacao.groupName,
        vendedor_telefone: vendedorTelefone,
        vendedor_slug: humanoSlug,
        ...(atendenteId ? { atendente_id: atendenteId } : {}),
        jobs_cancelados: jobsCancelados,
        welcome_sent: welcomeSent,
        ...(welcomeError ? { welcome_error: welcomeError } : {}),
        token_origem: tokenOrigem,
      },
    });
  } catch (e) {
    console.error("[TRANSFERIR-GRUPO] hub_atividades:", e);
  }

  return NextResponse.json({
    ok: true,
    groupJid: criacao.groupJid,
    groupName: criacao.groupName,
    humanoSlug,
    humano_responsavel: humanoSlug,
    metadata: leadPatch.metadata,
    jobsCancelados,
    welcomeSent,
    ...(welcomeError ? { welcomeError } : {}),
  });
}
