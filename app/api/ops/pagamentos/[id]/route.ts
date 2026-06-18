import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { excluirMensalidadeOps } from "@/lib/ops/excluir-mensalidade";
import { requireOpsApiAccess, getOpsActor } from "@/lib/ops/ops-api-auth";

const STATUS_VALIDOS = new Set(["pendente", "pago", "atrasado", "cancelado"]);

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const pagamentoId = id?.trim();
  if (!pagamentoId) {
    return NextResponse.json({ error: "ID do pagamento obrigatório." }, { status: 400 });
  }

  let body: {
    status?: string;
    pago_em?: string | null;
    vencimento?: string | null;
    notas?: string | null;
    valor_centavos?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.status !== undefined) {
    const s = body.status.trim().toLowerCase();
    if (!STATUS_VALIDOS.has(s)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    patch.status = s;
    if (s === "pago" && body.pago_em === undefined) {
      patch.pago_em = new Date().toISOString();
    }
    if (s !== "pago" && body.pago_em === undefined) {
      patch.pago_em = null;
    }
  }

  if (body.pago_em === null) patch.pago_em = null;
  else if (typeof body.pago_em === "string" && body.pago_em.trim()) {
    patch.pago_em = new Date(body.pago_em).toISOString();
  }

  if (body.vencimento === null) patch.vencimento = null;
  else if (typeof body.vencimento === "string" && body.vencimento.trim()) {
    patch.vencimento = body.vencimento.trim().slice(0, 10);
  }

  if (body.notas !== undefined) patch.notas = body.notas;

  if (typeof body.valor_centavos === "number" && Number.isFinite(body.valor_centavos)) {
    patch.valor_centavos = Math.max(0, Math.round(body.valor_centavos));
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const { data, error } = await crmDb()
    .from("hub_tenant_mensalidades")
    .update(patch)
    .eq("id", pagamentoId)
    .select(
      "id, tenant_id, competencia, valor_centavos, status, vencimento, pago_em, notas, cora_invoice_id, cora_boleto_url, cora_pix_emv",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
  }

  const actor = await getOpsActor(request);
  if (actor?.email) {
    console.info("[ops/pagamentos] atualizado por", actor.email, pagamentoId, patch);
  }

  return NextResponse.json({
    data: {
      ...data,
      valor_reais: (data.valor_centavos ?? 0) / 100,
    },
  });
}

export async function DELETE(_request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(_request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const pagamentoId = id?.trim();
  if (!pagamentoId) {
    return NextResponse.json({ error: "ID do pagamento obrigatório." }, { status: 400 });
  }

  const result = await excluirMensalidadeOps(pagamentoId);
  if (!result.ok) {
    const status = result.error.includes("não encontrada") ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  const actor = await getOpsActor(_request);
  if (actor?.email) console.info("[ops/pagamentos] apagada por", actor.email, pagamentoId);

  return NextResponse.json({ ok: true, id: pagamentoId });
}
