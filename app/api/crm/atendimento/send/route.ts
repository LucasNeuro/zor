import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";
import { whatsappConfigured, whatsappSendText } from "@/lib/whatsapp/whatsapp-send";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Em `next dev` ou com EVOLUTION_DRY_RUN / WHATSAPP_DRY_RUN=1, grava no CRM sem chamar o WhatsApp. */
function allowWhatsappDryRun(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.EVOLUTION_DRY_RUN === "1" ||
    process.env.WHATSAPP_DRY_RUN === "1"
  );
}

export async function POST(request: NextRequest) {
  try {
    let body: { leadId?: string; texto?: string };
    try {
      body = (await request.json()) as { leadId?: string; texto?: string };
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const leadId = body.leadId?.trim();
    const texto = body.texto?.trim();
    if (!leadId || !texto) {
      return NextResponse.json({ error: "leadId e texto são obrigatórios" }, { status: 400 });
    }

    const supabase = db();
    const { data: lead, error: leadErr } = await supabase
      .from("hub_leads_crm")
      .select("id, telefone, humano_responsavel")
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr) {
      return NextResponse.json({ error: leadErr.message }, { status: 500 });
    }
    if (!lead) {
      return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
    }

    const humano = typeof lead.humano_responsavel === "string" ? lead.humano_responsavel.trim() : "";
    if (!humano) {
      return NextResponse.json(
        { error: "Atendimento humano não assumido para este lead (humano_responsavel vazio)" },
        { status: 403 }
      );
    }

    const telefone = onlyDigits(lead.telefone || "");
    if (!telefone) {
      return NextResponse.json({ error: "Lead sem telefone válido" }, { status: 400 });
    }

    let sendSkipped = false;
    let sendInfo: { skipped?: boolean; status?: number; body?: unknown; provider?: string } = {};

    if (!whatsappConfigured()) {
      if (!allowWhatsappDryRun()) {
        return NextResponse.json(
          {
            error:
              "WhatsApp não configurado: defina UAZAPI_BASE_URL + UAZAPI_INSTANCE_TOKEN ou EVOLUTION_API_URL + EVOLUTION_API_KEY",
          },
          { status: 502 }
        );
      }
      sendSkipped = true;
      sendInfo = { skipped: true };
    } else {
      const envio = await whatsappSendText(telefone, texto);
      if (!envio.ok) {
        return NextResponse.json(
          {
            error: envio.error,
            status: envio.status,
            body: envio.body,
          },
          { status: 502 }
        );
      }
      sendInfo = { status: envio.status, body: envio.body, provider: envio.provider };
    }

    const agora = new Date().toISOString();
    const tenantId = defaultTenantId();

    const filaMetadata = sendSkipped
      ? {
          origem: "crm_atendimento",
          whatsapp_skipped: true,
          motivo: "provedor_whatsapp_ausente_ou_dry_run",
        }
      : { origem: "crm_atendimento", ...(sendInfo.provider ? { whatsapp_provider: sendInfo.provider } : {}) };

    const { error: filaErr } = await supabase.from("hub_fila_mensagens").insert({
      lead_id: leadId,
      agente_id: "wendel",
      canal: "whatsapp",
      direcao: "saida",
      conteudo: texto,
      status: sendSkipped ? "pendente" : "enviado",
      tenant_id: tenantId,
      resposta_enviada: !sendSkipped,
      enviada_em: sendSkipped ? null : agora,
      metadata: filaMetadata,
    });

    if (filaErr) {
      return NextResponse.json(
        {
          error: sendSkipped
            ? `Não foi possível gravar a mensagem na fila: ${filaErr.message}`
            : `Mensagem enviada ao WhatsApp, mas falha ao gravar fila: ${filaErr.message}`,
        },
        { status: 500 }
      );
    }

    await supabase.from("hub_atividades").insert({
      lead_id: leadId,
      tipo: "mensagem",
      descricao: texto.slice(0, 500),
      feito_por: "wendel",
      feito_por_tipo: "humano",
      metadata: { origem: "crm_atendimento" },
    });

    await supabase
      .from("hub_leads_crm")
      .update({ ultimo_contato: agora, atualizado_em: agora })
      .eq("id", leadId);

    return NextResponse.json({
      ok: true,
      evolutionSkipped: sendSkipped,
      whatsappSkipped: sendSkipped,
      evolution: sendInfo,
      whatsapp: sendInfo,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
