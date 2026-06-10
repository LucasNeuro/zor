import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import { selectHubAgenteIdentidadeCompat } from "@/lib/hub/hub-agente-schema-compat";
import { sendEmail } from "@/lib/email/resend-send";
import { resendConfigured } from "@/lib/email/resend-config";
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

  if (!resendConfigured()) {
    return NextResponse.json(
      { error: "Resend não configurado: defina RESEND_API_KEY no servidor." },
      { status: 503 }
    );
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

  const nomeAgente = typeof agente.nome === "string" ? agente.nome.trim() : slug;
  const subject =
    (typeof body.subject === "string" && body.subject.trim()) ||
    `[Teste] Canal e-mail — ${nomeAgente}`;
  const text =
    (typeof body.text === "string" && body.text.trim()) ||
    `Olá!\n\nEste é um e-mail de teste do agente «${nomeAgente}» no Escritório Virtual.\n\nSe recebeu esta mensagem, o envio via Resend está configurado.`;

  const result = await sendEmail({
    to,
    subject,
    text,
    from: typeof agente.email_from === "string" ? agente.email_from : null,
    fromName:
      typeof agente.email_from_name === "string"
        ? agente.email_from_name
        : nomeAgente,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, resend: result.body ?? null },
      { status: result.status && result.status >= 400 ? result.status : 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    to,
    subject,
    resend_id: result.id ?? null,
    resend: result.body ?? null,
  });
}
