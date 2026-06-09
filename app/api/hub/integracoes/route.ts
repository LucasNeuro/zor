import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  HUB_INTEGRACAO_TIPOS_EM_BREVE,
  integracaoAuthTipoValido,
  integracaoStatusValido,
  integracaoTipoValido,
} from "@/lib/hub/ferramentas-externas-db";
import { tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);
  const all = new URL(request.url).searchParams.get("all") === "true";

  let q = supabase
    .from("hub_integracoes")
    .select("*, hub_integracao_credenciais(tipo_auth, atualizado_em)")
    .eq("tenant_id", tenantId)
    .order("nome");
  if (!all) q = q.eq("ativo", true);

  const { data, error } = await q;
  if (error) {
    if (error.message.includes("hub_integracoes") && error.message.includes("relation")) {
      return NextResponse.json(
        { error: "Tabela hub_integracoes não existe. Execute migrações Supabase." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const integracaoId = String(body.integracao_id || "").trim();
  if (!integracaoTipoValido(integracaoId)) {
    return NextResponse.json(
      { error: `integracao_id inválido. Permitidos: webhook_generico, google_calendar, gmail, zendesk.` },
      { status: 400 }
    );
  }

  const nome = String(body.nome || "").trim();
  if (!nome) return NextResponse.json({ error: "nome é obrigatório." }, { status: 400 });

  const statusDefault = (HUB_INTEGRACAO_TIPOS_EM_BREVE as readonly string[]).includes(integracaoId)
    ? "em_breve"
    : "ativo";
  const statusRaw = body.status != null ? String(body.status).trim() : statusDefault;
  if (!integracaoStatusValido(statusRaw)) {
    return NextResponse.json({ error: "status inválido." }, { status: 400 });
  }

  const config =
    body.config && typeof body.config === "object" && !Array.isArray(body.config)
      ? body.config
      : {};

  const row = {
    tenant_id: tenantId,
    integracao_id: integracaoId,
    nome,
    status: statusRaw,
    config,
    ativo: body.ativo !== false,
  };

  const { data: inserted, error } = await supabase
    .from("hub_integracoes")
    .insert(row as Record<string, unknown>)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!inserted) return NextResponse.json({ error: "Falha ao criar integração." }, { status: 500 });

  const credBody = body.credenciais;
  if (credBody && typeof credBody === "object" && !Array.isArray(credBody)) {
    const cb = credBody as Record<string, unknown>;
    const tipoAuth = String(cb.tipo_auth ?? "api_key").toLowerCase();
    if (integracaoAuthTipoValido(tipoAuth)) {
      const credPayload =
        cb.secrets && typeof cb.secrets === "object" && !Array.isArray(cb.secrets)
          ? cb.secrets
          : cb.credenciais && typeof cb.credenciais === "object" && !Array.isArray(cb.credenciais)
            ? cb.credenciais
            : {};
      await supabase.from("hub_integracao_credenciais").insert({
        tenant_id: tenantId,
        integracao_id: inserted.id,
        tipo_auth: tipoAuth,
        credenciais: credPayload,
      });
    }
  }

  const { data: full } = await supabase
    .from("hub_integracoes")
    .select("*, hub_integracao_credenciais(*)")
    .eq("id", inserted.id)
    .maybeSingle();

  return NextResponse.json(full ?? inserted, { status: 201 });
}
