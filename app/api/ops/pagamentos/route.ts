import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { MENSALIDADE_SELECT } from "@/lib/ops/mensalidade";
import { requireOpsApiAccess, getOpsActor } from "@/lib/ops/ops-api-auth";

function isMissingTable(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("hub_tenant_mensalidades") && (m.includes("does not exist") || m.includes("schema cache"));
}

export async function GET(request: NextRequest) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const statusFilter = request.nextUrl.searchParams.get("status")?.trim();

  let query = crmDb()
    .from("hub_tenant_mensalidades")
    .select(MENSALIDADE_SELECT)
    .order("competencia", { ascending: false })
    .limit(200);

  if (statusFilter) query = query.eq("status", statusFilter);

  const { data: rows, error } = await query;
  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json({
        data: [],
        schema_ready: false,
        message:
          "Tabela hub_tenant_mensalidades ainda não existe. Execute a migração waje-ops-platform.sql no Supabase.",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tenantIds = [
    ...new Set((rows ?? []).map((r) => r.tenant_id).filter((id): id is string => Boolean(id))),
  ];
  const tenantMap = new Map<string, { slug: string; nome: string }>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await crmDb()
      .from("hub_tenants")
      .select("id, slug, nome_exibicao")
      .in("id", tenantIds);
    for (const t of tenants ?? []) {
      tenantMap.set(t.id, { slug: t.slug, nome: t.nome_exibicao });
    }
  }

  const data = (rows ?? []).map((r) => {
    const tenant = tenantMap.get(r.tenant_id);
    return {
      ...r,
      tenant_slug: tenant?.slug ?? null,
      tenant_nome: tenant?.nome ?? null,
      valor_reais: (r.valor_centavos ?? 0) / 100,
    };
  });

  return NextResponse.json({ data, schema_ready: true });
}

export async function POST(request: NextRequest) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  let body: {
    tenant_id?: string;
    competencia?: string;
    valor_centavos?: number;
    vencimento?: string | null;
    notas?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const tenant_id = body.tenant_id?.trim();
  const competencia = body.competencia?.trim();
  if (!tenant_id || !competencia) {
    return NextResponse.json({ error: "tenant_id e competencia são obrigatórios." }, { status: 400 });
  }

  const valor_centavos =
    typeof body.valor_centavos === "number" && Number.isFinite(body.valor_centavos)
      ? Math.round(body.valor_centavos)
      : 0;

  const { data, error } = await crmDb()
    .from("hub_tenant_mensalidades")
    .insert({
      tenant_id,
      competencia,
      valor_centavos,
      vencimento: body.vencimento ?? null,
      notas: body.notas ?? null,
      status: "pendente",
    })
    .select("id, tenant_id, competencia, valor_centavos, status, vencimento")
    .single();

  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json(
        {
          error:
            "Tabela hub_tenant_mensalidades ausente. Execute docs/sql/waje-ops-platform.sql no Supabase.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const actor = await getOpsActor(request);
  if (actor?.email) {
    console.info("[ops/pagamentos] mensalidade criada por", actor.email, data?.id);
  }

  return NextResponse.json({ data }, { status: 201 });
}
