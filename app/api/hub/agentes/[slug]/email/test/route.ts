import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import { selectHubAgenteIdentidadeCompat } from "@/lib/hub/hub-agente-schema-compat";
import { sendEmail } from "@/lib/email/resend-send";
import { sendGmailEmail } from "@/lib/email/gmail-send";
import { getValidGoogleAccessToken } from "@/lib/email/oauth-google";
import { emailFromPermitidoParaResend, resendConfigured } from "@/lib/email/resend-config";
import { resolveEmailProviderForAgente } from "@/lib/email/resolve-email-provider";
import { normalizarEnderecoEmail } from "@/lib/email/inbound-parser";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function agentePertenceAoTenant(row: Record<string, unknown>, tenantId: string): boolean {
  const rowTenant = typeof row.tenant_id === "string" ? row.tenant_id.trim() : "";
  if (!rowTenant) return true;
  return rowTenant === tenantId;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const tenantId = await resolveTenantIdFromCaller(request);

  let body: { to?: string; subject?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const to = normalizarEnderecoEmail(body.to || "");
  if (!to) {
    return NextResponse.json({ error: "Informe to (e-mail válido)." }, { status: 400 });
  }

  const supabase = db();
  const { data: agente, error: loadErr } = await selectHubAgenteIdentidadeCompat(supabase, slug, [
    "agente_slug",
    "nome",
    "tenant_id",
    "modo_operacao",
    "email_from",
    "email_from_name",
    "email_ativo",
    "email_provider",
    "email_integracao_id",
    "ativo",
    "arquivado_em",
  ]);

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!agente || !agentePertenceAoTenant(agente, tenantId)) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  if (agente.modo_operacao !== "canal_email") {
    return NextResponse.json(
      { error: "Este agente não está no modo canal e-mail." },
      { status: 409 }
    );
  }
  if (agente.email_ativo === false || agente.ativo === false) {
    return NextResponse.json({ error: "Canal e-mail inativo para este agente." }, { status: 409 });
  }

  const provider = resolveEmailProviderForAgente({
    email_provider: typeof agente.email_provider === "string" ? agente.email_provider : null,
    email_integracao_id:
      typeof agente.email_integracao_id === "string" ? agente.email_integracao_id : null,
  });

  const emailFrom =
    typeof agente.email_from === "string" && agente.email_from.trim() ? agente.email_from.trim() : "";
  if (!emailFrom) {
    return NextResponse.json({ error: "Defina email_from no agente ou ligue OAuth Google." }, { status: 400 });
  }

  const nomeAgente = typeof agente.nome === "string" ? agente.nome.trim() : slug;
  const subject =
    (typeof body.subject === "string" && body.subject.trim()) ||
    `[Teste] Canal e-mail — ${nomeAgente}`;
  const text =
    (typeof body.text === "string" && body.text.trim()) ||
    (provider === "oauth_google"
      ? `Olá!\n\nEste é um e-mail de teste do agente «${nomeAgente}» via Gmail (OAuth).\n\nSe recebeu esta mensagem, o envio pela caixa ligada está a funcionar.`
      : `Olá!\n\nEste é um e-mail de teste do agente «${nomeAgente}» no Escritório Virtual.\n\nSe recebeu esta mensagem, o envio via Resend está configurado.`);

  if (provider === "oauth_google") {
    const integracaoId =
      typeof agente.email_integracao_id === "string" ? agente.email_integracao_id.trim() : "";
    if (!integracaoId) {
      return NextResponse.json({ error: "Agente OAuth sem email_integracao_id." }, { status: 409 });
    }

    const { data: credRow } = await supabase
      .from("hub_integracao_credenciais")
      .select("*")
      .eq("integracao_id", integracaoId)
      .maybeSingle();

    const token = await getValidGoogleAccessToken(
      supabase,
      tenantId,
      credRow,
      integracaoId
    );
    if (!token) {
      return NextResponse.json(
        { error: "Token Gmail indisponível. Volte a ligar a conta Google." },
        { status: 409 }
      );
    }

    const gmailResult = await sendGmailEmail({
      bearerToken: token,
      to,
      subject,
      text,
      from: emailFrom,
      fromName: typeof agente.email_from_name === "string" ? agente.email_from_name : nomeAgente,
    });

    if (!gmailResult.ok) {
      return NextResponse.json(
        { ok: false, error: gmailResult.error, provider: "oauth_google" },
        { status: gmailResult.status && gmailResult.status >= 400 ? gmailResult.status : 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      to,
      subject,
      provider: "oauth_google",
      gmail_id: gmailResult.id ?? null,
    });
  }

  if (!resendConfigured()) {
    return NextResponse.json(
      {
        error:
          "Resend não configurado: defina RESEND_API_KEY no .env (local) ou no Render → Environment e reinicie o servidor.",
      },
      { status: 503 }
    );
  }

  const fromCheck = emailFromPermitidoParaResend(emailFrom);
  if (!fromCheck.ok) {
    return NextResponse.json({ error: fromCheck.error }, { status: 400 });
  }

  const result = await sendEmail({
    to,
    subject,
    text,
    from: emailFrom || null,
    fromName:
      typeof agente.email_from_name === "string"
        ? agente.email_from_name
        : nomeAgente,
  });

  if (!result.ok) {
    const domainNaoVerificado = /domain is not verified|resend\.com\/domains/i.test(result.error);
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        detail: domainNaoVerificado
          ? "Verifique o domínio em https://resend.com/domains (DNS + status Verified). Render só hospeda a app; o e-mail é do Resend."
          : undefined,
        resend: result.body ?? null,
      },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    to,
    subject,
    provider: "resend",
    resend_id: result.id ?? null,
    resend: result.body ?? null,
  });
}
