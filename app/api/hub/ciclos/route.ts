import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { validateAndNormalizeCicloConfiguracoes } from "@/lib/hub-ciclos-configuracoes";
import { repararCiclosAusentesParaAgentes } from "@/lib/hub/provision-hub-ciclo-padrao";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

type CicloTipo = "continuo" | "programado" | "gatilho";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isCicloTipo(v: unknown): v is CicloTipo {
  return v === "continuo" || v === "programado" || v === "gatilho";
}

export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const supabase = db();
  const { searchParams } = new URL(request.url);
  const ativo = searchParams.get("ativo");
  const agenteSlug = searchParams.get("agente_slug");
  const tipo = searchParams.get("tipo");
  const q = searchParams.get("q");

  let query = supabase.from("hub_ciclos_ia").select("*").order("agente_slug").order("nome");

  if (ativo === "true") query = query.eq("ativo", true);
  if (ativo === "false") query = query.eq("ativo", false);
  if (agenteSlug) query = query.eq("agente_slug", agenteSlug);
  if (tipo && isCicloTipo(tipo)) query = query.eq("tipo", tipo);
  if (q) query = query.or(`nome.ilike.%${q}%,descricao.ilike.%${q}%,agente_slug.ilike.%${q}%`);

  let { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const repair = await repararCiclosAusentesParaAgentes(supabase);
  if (repair.reparados > 0) {
    ({ data, error } = await query);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ciclos: data || [],
    ...(repair.reparados > 0 ? { ciclos_reparados: repair.reparados } : {}),
  });
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const agente_slug = typeof body.agente_slug === "string" ? body.agente_slug.trim() : "";
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const descricao =
    typeof body.descricao === "string" && body.descricao.trim().length > 0
      ? body.descricao.trim()
      : null;
  const tipo = body.tipo;

  if (!agente_slug || !nome || !isCicloTipo(tipo)) {
    return NextResponse.json(
      { error: "agente_slug, nome e tipo (continuo/programado/gatilho) são obrigatórios." },
      { status: 400 }
    );
  }

  const intervalo =
    body.intervalo_minutos == null ? null : Number.parseInt(String(body.intervalo_minutos), 10);
  if (intervalo != null && (!Number.isFinite(intervalo) || intervalo <= 0)) {
    return NextResponse.json({ error: "intervalo_minutos inválido." }, { status: 400 });
  }

  const cron =
    typeof body.cron_expressao === "string" && body.cron_expressao.trim().length > 0
      ? body.cron_expressao.trim()
      : null;
  const parsedCfg = validateAndNormalizeCicloConfiguracoes(
    body.configuracoes && typeof body.configuracoes === "object" && !Array.isArray(body.configuracoes) ? body.configuracoes : {}
  );
  if (!parsedCfg.ok) {
    return NextResponse.json({ error: parsedCfg.error }, { status: 400 });
  }
  const configuracoes = parsedCfg.value;

  const tenantId = tenantIdFromRequest(request.headers);
  const row: Record<string, unknown> = {
    agente_slug,
    nome,
    descricao,
    tipo,
    cron_expressao: cron,
    intervalo_minutos: intervalo,
    ativo: body.ativo === false ? false : true,
    configuracoes,
    tenant_id: tenantId || defaultTenantId(),
  };

  const supabase = db();
  let { data, error } = await supabase.from("hub_ciclos_ia").insert(row).select("*").single();
  if (error && /tenant_id/i.test(error.message) && /column|schema cache|could not find/i.test(error.message)) {
    const { tenant_id: _omit, ...semTenant } = row;
    ({ data, error } = await supabase.from("hub_ciclos_ia").insert(semTenant).select("*").single());
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
