import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import {
  selectHubAgenteIdentidadeCompat,
  updateHubAgenteIdentidadeCompat,
} from "@/lib/hub/hub-agente-schema-compat";
import {
  emailFromPermitidoParaResend,
  resendConfigured,
  resendDefaultFromAddress,
  resendDefaultFromEmail,
  resendDomainHint,
} from "@/lib/email/resend-config";
import { buildPublicEmailInboundWebhookUrl } from "@/lib/email/webhook-auth";
import { normalizarEnderecoEmail } from "@/lib/email/inbound-parser";

const EMAIL_SELECT_COLS = [
  "agente_slug",
  "nome",
  "tenant_id",
  "modo_operacao",
  "email_from",
  "email_from_name",
  "email_inbound",
  "email_ativo",
  "email_configured_at",
  "ativo",
  "arquivado_em",
] as const;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function parseBoolPatch(v: unknown): boolean | undefined {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return undefined;
}

function agentePertenceAoTenant(
  row: Record<string, unknown>,
  tenantId: string
): boolean {
  const rowTenant = typeof row.tenant_id === "string" ? row.tenant_id.trim() : "";
  if (!rowTenant) return true;
  return rowTenant === tenantId;
}

function serializarEmailConfig(row: Record<string, unknown>, request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
  const webhookSecret = process.env.EMAIL_INBOUND_WEBHOOK_SECRET?.trim();

  return {
    agente_slug: row.agente_slug,
    modo_operacao: row.modo_operacao ?? null,
    email_from: row.email_from ?? null,
    email_from_name: row.email_from_name ?? null,
    email_inbound: row.email_inbound ?? null,
    email_ativo: row.email_ativo !== false,
    email_configured_at: row.email_configured_at ?? null,
    resend_configured: resendConfigured(),
    default_from_email: resendDefaultFromAddress(),
    default_from_label: resendDefaultFromEmail(),
    domain_hint: resendDomainHint(),
    resend_setup_hint: resendConfigured()
      ? null
      : "Defina RESEND_API_KEY no .env (local) ou no Render → Environment, guarde o ficheiro e reinicie o servidor (npm run dev).",
    inbound_webhook_url: buildPublicEmailInboundWebhookUrl(origin, webhookSecret || null),
  };
}

async function carregarAgenteEmail(
  supabase: ReturnType<typeof db>,
  slug: string,
  tenantId: string
) {
  const { data, error } = await selectHubAgenteIdentidadeCompat(supabase, slug, [...EMAIL_SELECT_COLS]);
  if (error) {
    return { error: error.message, status: 500 as const };
  }
  if (!data) {
    return { error: "Agente não encontrado", status: 404 as const };
  }
  if (!agentePertenceAoTenant(data, tenantId)) {
    return { error: "Agente não encontrado", status: 404 as const };
  }
  return { data };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();

  const loaded = await carregarAgenteEmail(supabase, slug, tenantId);
  if ("error" in loaded && !("data" in loaded)) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  return NextResponse.json(serializarEmailConfig(loaded.data!, request));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const tenantId = await resolveTenantIdFromCaller(request);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const supabase = db();
  const loaded = await carregarAgenteEmail(supabase, slug, tenantId);
  if ("error" in loaded && !("data" in loaded)) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const current = loaded.data!;
  const arquivado = current.arquivado_em != null && current.arquivado_em !== "";
  if (arquivado) {
    return NextResponse.json({ error: "Agente arquivado não pode alterar canal e-mail." }, { status: 409 });
  }

  const patch: Record<string, unknown> = {};
  const wantsModoEmail = body.modo_operacao === "canal_email";
  const patchingEmailFields =
    "email_from" in body ||
    "email_from_name" in body ||
    "email_inbound" in body ||
    "email_ativo" in body;

  const modoAtual = typeof current.modo_operacao === "string" ? current.modo_operacao : null;

  if (patchingEmailFields || wantsModoEmail) {
    if (modoAtual && modoAtual !== "canal_email" && !wantsModoEmail) {
      return NextResponse.json(
        {
          error:
            "Defina o modo de operação «E-mail» neste agente antes de configurar o canal (modo_operacao: canal_email).",
        },
        { status: 409 }
      );
    }
    if (wantsModoEmail || modoAtual === "canal_email" || !modoAtual) {
      patch.modo_operacao = "canal_email";
    }
  }

  if ("email_from" in body) {
    const v = body.email_from;
    if (v === null || v === "") {
      patch.email_from = null;
    } else if (typeof v === "string") {
      const addr = normalizarEnderecoEmail(v);
      if (!addr) {
        return NextResponse.json({ error: "email_from inválido" }, { status: 400 });
      }
      const fromCheck = emailFromPermitidoParaResend(addr);
      if (!fromCheck.ok) {
        return NextResponse.json({ error: fromCheck.error }, { status: 400 });
      }
      patch.email_from = addr;
    } else {
      return NextResponse.json({ error: "email_from inválido" }, { status: 400 });
    }
  }

  if ("email_from_name" in body) {
    const v = body.email_from_name;
    if (v === null || v === "") {
      patch.email_from_name = null;
    } else if (typeof v === "string") {
      patch.email_from_name = v.trim().slice(0, 120) || null;
    } else {
      return NextResponse.json({ error: "email_from_name inválido" }, { status: 400 });
    }
  }

  if ("email_inbound" in body) {
    const v = body.email_inbound;
    if (v === null || v === "") {
      patch.email_inbound = null;
    } else if (typeof v === "string") {
      const addr = normalizarEnderecoEmail(v);
      if (!addr) {
        return NextResponse.json({ error: "email_inbound inválido" }, { status: 400 });
      }

      const { data: dup } = await supabase
        .from("hub_agente_identidade")
        .select("agente_slug")
        .ilike("email_inbound", addr)
        .neq("agente_slug", slug)
        .maybeSingle();

      if (dup) {
        return NextResponse.json(
          { error: "Este endereço inbound já está associado a outro agente." },
          { status: 409 }
        );
      }

      patch.email_inbound = addr;
    } else {
      return NextResponse.json({ error: "email_inbound inválido" }, { status: 400 });
    }
  }

  if ("email_ativo" in body) {
    const v = parseBoolPatch(body.email_ativo);
    if (v === undefined) {
      return NextResponse.json({ error: "email_ativo inválido" }, { status: 400 });
    }
    patch.email_ativo = v;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
  }

  const hasEmailConfig =
    "email_from" in patch ||
    "email_inbound" in patch ||
    (typeof current.email_from === "string" && current.email_from.trim()) ||
    (typeof current.email_inbound === "string" && current.email_inbound.trim());

  if (hasEmailConfig && ("email_from" in patch || "email_inbound" in patch || !current.email_configured_at)) {
    patch.email_configured_at = new Date().toISOString();
  }

  const { data, error } = await updateHubAgenteIdentidadeCompat(supabase, slug, patch);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  return NextResponse.json(serializarEmailConfig(data, request));
}
