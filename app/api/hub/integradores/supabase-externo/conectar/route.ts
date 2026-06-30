import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { crmConfigError } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { integracaoAuthTipoValido } from "@/lib/hub/ferramentas-externas-db";
import { SUPABASE_EXTERNO_INTEGRADOR_ID } from "@/lib/hub/supabase-externo-constants";
import {
  normalizarSupabaseProjectUrl,
  testarConexaoSupabaseExterno,
} from "@/lib/hub/supabase-externo-query";
import { tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const project_url = normalizarSupabaseProjectUrl(
    String(body.project_url || body.url || "").trim()
  );
  const api_key = String(body.api_key || body.service_role_key || "").trim();
  const rotulo = String(body.rotulo || body.nome || "Supabase externo").trim().slice(0, 80);

  if (!project_url || !api_key) {
    return NextResponse.json({ error: "URL do projecto e chave API são obrigatórios." }, { status: 400 });
  }

  const teste = await testarConexaoSupabaseExterno({ project_url, api_key });
  if (!teste.ok) {
    return NextResponse.json(
      { error: teste.detalhe || "Não foi possível ligar ao Supabase externo." },
      { status: 400 }
    );
  }

  const credenciais = { project_url, api_key };
  const config = { rotulo, project_host: new URL(project_url).host };

  const { data: existing } = await supabase
    .from("hub_integracoes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("integracao_id", SUPABASE_EXTERNO_INTEGRADOR_ID)
    .maybeSingle();

  let hubId = existing?.id ? String(existing.id) : "";

  if (hubId) {
    await supabase
      .from("hub_integracoes")
      .update({
        nome: rotulo,
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
        integracao_id: SUPABASE_EXTERNO_INTEGRADOR_ID,
        nome: rotulo,
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

  const tipoAuth = "api_key";
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

  return NextResponse.json({
    ok: true,
    integrador_id: SUPABASE_EXTERNO_INTEGRADOR_ID,
    project_host: config.project_host,
    rotulo,
  });
}
