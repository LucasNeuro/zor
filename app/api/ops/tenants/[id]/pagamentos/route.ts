import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import {
  MAX_MENSALIDADES_POR_TENANT,
  contarMensalidadesTenant,
  MENSALIDADE_SELECT,
} from "@/lib/ops/cora-mensalidade";
import { excluirMensalidadesSemEmissaoTenant } from "@/lib/ops/excluir-mensalidade";
import { requireOpsApiAccess, getOpsActor } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(_request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const tenantId = id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "ID do tenant obrigatório." }, { status: 400 });
  }

  const { data, error } = await crmDb()
    .from("hub_tenant_mensalidades")
    .select(MENSALIDADE_SELECT)
    .eq("tenant_id", tenantId)
    .order("competencia", { ascending: false })
    .limit(MAX_MENSALIDADES_POR_TENANT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: (data ?? []).map((r) => ({
      ...r,
      valor_reais: (r.valor_centavos ?? 0) / 100,
    })),
    max: MAX_MENSALIDADES_POR_TENANT,
  });
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const tenantId = id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "ID do tenant obrigatório." }, { status: 400 });
  }

  let body: {
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

  const competencia = body.competencia?.trim();
  if (!competencia) {
    return NextResponse.json({ error: "competencia é obrigatória." }, { status: 400 });
  }

  const total = await contarMensalidadesTenant(tenantId);
  if (total >= MAX_MENSALIDADES_POR_TENANT) {
    return NextResponse.json(
      { error: `Limite de ${MAX_MENSALIDADES_POR_TENANT} mensalidades por tenant.` },
      { status: 422 },
    );
  }

  const valor_centavos =
    typeof body.valor_centavos === "number" && Number.isFinite(body.valor_centavos)
      ? Math.round(body.valor_centavos)
      : 0;

  const { data, error } = await crmDb()
    .from("hub_tenant_mensalidades")
    .insert({
      tenant_id: tenantId,
      competencia,
      valor_centavos,
      vencimento: body.vencimento ?? null,
      notas: body.notas ?? null,
      status: "pendente",
    })
    .select(
      "id, tenant_id, competencia, valor_centavos, status, vencimento, pago_em, cora_invoice_id, cora_boleto_url, cora_pix_emv",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const actor = await getOpsActor(request);
  if (actor?.email) console.info("[ops/tenant/pagamentos] criada por", actor.email, data?.id);

  return NextResponse.json(
    { data: { ...data, valor_reais: (data.valor_centavos ?? 0) / 100 } },
    { status: 201 },
  );
}

/** Apaga cobranças pendentes sem boleto emitido (rascunhos / testes). */
export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const tenantId = id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "ID do tenant obrigatório." }, { status: 400 });
  }

  const semEmissao = request.nextUrl.searchParams.get("sem_emissao");
  if (semEmissao !== "1" && semEmissao !== "true") {
    return NextResponse.json(
      { error: "Use ?sem_emissao=1 para apagar cobranças sem boleto emitido." },
      { status: 400 },
    );
  }

  try {
    const { apagadas, ids } = await excluirMensalidadesSemEmissaoTenant(tenantId);
    const actor = await getOpsActor(request);
    if (actor?.email) {
      console.info("[ops/tenant/pagamentos] apagadas sem emissão", apagadas, "por", actor.email);
    }
    return NextResponse.json({ ok: true, apagadas, ids });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao apagar cobranças.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
