import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { coraConfigurado } from "@/lib/cora/cora-config";
import { cancelarCobrancaCora } from "@/lib/cora/cora-cobranca";
import { requireOpsApiAccess, getOpsActor } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const pagamentoId = id?.trim();
  if (!pagamentoId) {
    return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  }

  const { data: pag, error: payErr } = await crmDb()
    .from("hub_tenant_mensalidades")
    .select("id, status, cora_invoice_id")
    .eq("id", pagamentoId)
    .maybeSingle();

  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });
  if (!pag) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
  if (!pag.cora_invoice_id) {
    return NextResponse.json({ error: "Nenhuma cobrança Cora para cancelar." }, { status: 409 });
  }
  if (pag.status === "pago") {
    return NextResponse.json({ error: "Cobrança já paga — não pode cancelar." }, { status: 422 });
  }

  try {
    if (coraConfigurado()) {
      await cancelarCobrancaCora(pag.cora_invoice_id);
    }

    const { data: updated, error: upErr } = await crmDb()
      .from("hub_tenant_mensalidades")
      .update({
        status: "cancelado",
        cora_meta: { cancelled_at: new Date().toISOString() },
      })
      .eq("id", pag.id)
      .select("id, status, cora_invoice_id, cora_boleto_url, cora_pix_emv")
      .single();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const actor = await getOpsActor(request);
    if (actor?.email) console.info("[ops/cora] cancelado por", actor.email, pag.cora_invoice_id);

    return NextResponse.json({ data: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao cancelar na Cora.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
