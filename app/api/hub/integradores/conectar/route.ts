import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { integradorPorId, type HubIntegradorId } from "@/lib/hub/integradores-catalogo";
import { integracaoAuthTipoValido } from "@/lib/hub/ferramentas-externas-db";
import { tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Liga integrador pré-definido: só credenciais + config mínima (sem ferramentas HTTP manuais). */
export async function POST(request: NextRequest) {
  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const integradorId = String(body.integrador_id || "").trim() as HubIntegradorId;
  const entry = integradorPorId(integradorId);
  if (!entry) {
    return NextResponse.json({ error: "integrador_id inválido." }, { status: 400 });
  }
  if (entry.emBreve) {
    return NextResponse.json({ error: "Esta integração ainda não está disponível." }, { status: 400 });
  }

  const principal = String(body.credencial_principal || body.api_key || body.bearer_token || "").trim();
  const extra = String(body.credencial_extra || body.subdomain || "").trim();

  if (!principal) {
    return NextResponse.json({ error: "Credencial principal é obrigatória." }, { status: 400 });
  }
  if (entry.authModo === "zendesk" && !extra) {
    return NextResponse.json({ error: "Subdomínio Zendesk é obrigatório." }, { status: 400 });
  }

  const config: Record<string, unknown> =
    entry.authModo === "zendesk"
      ? {
          subdomain: extra.toLowerCase().replace(/\.zendesk\.com$/i, ""),
          email: body.email != null ? String(body.email).trim() : "",
        }
      : {};

  const tipoAuth = entry.authModo === "zendesk" ? "api_key" : "bearer";
  const credenciais: Record<string, unknown> =
    tipoAuth === "bearer" ? { bearer_token: principal } : { api_key: principal };

  const { data: existing } = await supabase
    .from("hub_integracoes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("integracao_id", integradorId)
    .maybeSingle();

  let hubId = existing?.id ? String(existing.id) : "";

  if (hubId) {
    await supabase
      .from("hub_integracoes")
      .update({
        nome: entry.nome,
        status: "ativo",
        config,
        ativo: true,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", hubId)
      .eq("tenant_id", tenantId);
  } else {
    const { data: inserted, error } = await supabase
      .from("hub_integracoes")
      .insert({
        tenant_id: tenantId,
        integracao_id: integradorId,
        nome: entry.nome,
        status: "ativo",
        config,
        ativo: true,
      })
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!inserted?.id) return NextResponse.json({ error: "Falha ao criar integração." }, { status: 500 });
    hubId = String(inserted.id);
  }

  if (!integracaoAuthTipoValido(tipoAuth)) {
    return NextResponse.json({ error: "tipo_auth inválido." }, { status: 500 });
  }

  const { data: credExistente } = await supabase
    .from("hub_integracao_credenciais")
    .select("id")
    .eq("integracao_id", hubId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (credExistente?.id) {
    await supabase
      .from("hub_integracao_credenciais")
      .update({
        tipo_auth: tipoAuth,
        credenciais,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", credExistente.id);
  } else {
    await supabase.from("hub_integracao_credenciais").insert({
      tenant_id: tenantId,
      integracao_id: hubId,
      tipo_auth: tipoAuth,
      credenciais,
    });
  }

  const { data: full } = await supabase
    .from("hub_integracoes")
    .select("*, hub_integracao_credenciais(*)")
    .eq("id", hubId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    integrador_id: integradorId,
    ferramentas: entry.ferramentas.map((f) => f.ferramenta_key),
    integracao: full,
  });
}
