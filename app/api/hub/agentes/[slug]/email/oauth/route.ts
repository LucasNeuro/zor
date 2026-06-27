import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import {
  EMAIL_CHANNEL_DISABLED_CODE,
  EMAIL_CHANNEL_DISABLED_MESSAGE,
  isEmailChannelEnabled,
} from "@/lib/feature-flags";
import {
  selectHubAgenteIdentidadeCompat,
  updateHubAgenteIdentidadeCompat,
} from "@/lib/hub/hub-agente-schema-compat";
import { carregarEmailOAuthStatus } from "@/lib/email/email-oauth-status";
import { googleOAuthConfigured } from "@/lib/email/oauth-google";
import { microsoftOAuthConfigured } from "@/lib/email/oauth-microsoft";
import { credentialsEncryptionConfigured } from "@/lib/hub/credentials-crypto";
import { resolveEmailProviderForAgente } from "@/lib/email/resolve-email-provider";

const OAUTH_SELECT_COLS = [
  "agente_slug",
  "nome",
  "tenant_id",
  "modo_operacao",
  "email_from",
  "email_from_name",
  "email_inbound",
  "email_ativo",
  "email_configured_at",
  "email_provider",
  "email_integracao_id",
  "ativo",
  "arquivado_em",
] as const;

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

async function carregarAgente(
  supabase: ReturnType<typeof db>,
  slug: string,
  tenantId: string
) {
  const { data, error } = await selectHubAgenteIdentidadeCompat(supabase, slug, [...OAUTH_SELECT_COLS]);
  if (error) return { error: error.message, status: 500 as const };
  if (!data) return { error: "Agente não encontrado", status: 404 as const };
  if (!agentePertenceAoTenant(data, tenantId)) {
    return { error: "Agente não encontrado", status: 404 as const };
  }
  return { data };
}

/** GET — estado OAuth Gmail do agente. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isEmailChannelEnabled()) {
    return NextResponse.json(
      { error: EMAIL_CHANNEL_DISABLED_MESSAGE, code: EMAIL_CHANNEL_DISABLED_CODE },
      { status: 403 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();

  const loaded = await carregarAgente(supabase, slug, tenantId);
  if ("error" in loaded && !("data" in loaded)) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
  const status = await carregarEmailOAuthStatus(supabase, loaded.data!);
  return NextResponse.json({
    agente_slug: slug,
    ...status,
    providers_available: {
      google: googleOAuthConfigured(origin) && credentialsEncryptionConfigured(),
      microsoft: microsoftOAuthConfigured() && credentialsEncryptionConfigured(),
    },
  });
}

/** DELETE — desliga OAuth deste agente (não apaga integração Gmail do tenant). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isEmailChannelEnabled()) {
    return NextResponse.json(
      { error: EMAIL_CHANNEL_DISABLED_MESSAGE, code: EMAIL_CHANNEL_DISABLED_CODE },
      { status: 403 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();

  const loaded = await carregarAgente(supabase, slug, tenantId);
  if ("error" in loaded && !("data" in loaded)) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const current = loaded.data!;
  if (current.arquivado_em != null && current.arquivado_em !== "") {
    return NextResponse.json({ error: "Agente arquivado." }, { status: 409 });
  }

  const provider = resolveEmailProviderForAgente({
    email_provider: typeof current.email_provider === "string" ? current.email_provider : null,
    email_integracao_id:
      typeof current.email_integracao_id === "string" ? current.email_integracao_id : null,
  });

  if (provider !== "oauth_google") {
    const status = await carregarEmailOAuthStatus(supabase, current);
    return NextResponse.json({
      ok: true,
      message: "Agente já não usa OAuth Gmail.",
      agente_slug: slug,
      ...status,
    });
  }

  const patch: Record<string, unknown> = {
    email_provider: null,
    email_integracao_id: null,
  };

  const { data, error } = await updateHubAgenteIdentidadeCompat(supabase, slug, patch);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  const status = await carregarEmailOAuthStatus(supabase, data);
  return NextResponse.json({
    ok: true,
    message: "Conta Google desligada deste agente.",
    agente_slug: slug,
    ...status,
  });
}
