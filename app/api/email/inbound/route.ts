import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { parseResendInboundWebhook } from "@/lib/email/inbound-parser";
import { processInboundEmail } from "@/lib/email/inbound-processor";
import {
  emailInboundWebhookAutenticado,
  resolveEmailInboundWebhookSecret,
} from "@/lib/email/webhook-auth";

let warnedMissingEmailWebhookSecret = false;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET() {
  return NextResponse.json({ status: "ok", service: "escritorio-virtual-email-inbound", version: "1.0" });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    const skipVerify =
      process.env.NODE_ENV !== "production" && process.env.EMAIL_WEBHOOK_SKIP_VERIFY === "true";
    const secret = resolveEmailInboundWebhookSecret();

    if (process.env.NODE_ENV === "production" && !secret) {
      return NextResponse.json({ error: "Webhook e-mail não configurado" }, { status: 500 });
    }

    if (secret && !skipVerify) {
      if (!emailInboundWebhookAutenticado(request, rawBody, secret)) {
        return NextResponse.json(
          {
            error: "Não autorizado",
            code: "EMAIL_WEBHOOK_AUTH_FAILED",
            message:
              "Falha na verificação do webhook (credencial Bearer/cabeçalho/query não confere com EMAIL_INBOUND_WEBHOOK_SECRET).",
          },
          { status: 401 }
        );
      }
    } else if (!secret && !skipVerify) {
      if (!warnedMissingEmailWebhookSecret) {
        warnedMissingEmailWebhookSecret = true;
        console.warn(
          "[email/webhook] EMAIL_INBOUND_WEBHOOK_SECRET ausente; webhook aceita qualquer POST (não recomendado em produção)."
        );
      }
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const parsed = parseResendInboundWebhook(body);
    if (!parsed.ok) {
      return NextResponse.json({ status: "ignored", reason: parsed.reason }, { status: 200 });
    }

    const supabase = db();

    void processInboundEmail(supabase, parsed.value).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[email/webhook] processamento assíncrono falhou:", msg);
    });

    return NextResponse.json({ status: "accepted", queue: "inline_async" }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("[email/webhook] unhandled:", msg);
    return NextResponse.json({ status: "erro", erro: msg, code: "UNHANDLED" }, { status: 500 });
  }
}
