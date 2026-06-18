import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { coraConfigurado } from "@/lib/cora/cora-config";
import type { CoraFormaPagamento } from "@/lib/cora/cora-cobranca";
import { emitirMensalidadeNaCora } from "@/lib/ops/cora-mensalidade";
import { requireOpsApiAccess, getOpsActor } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

async function emitir(
  request: NextRequest,
  ctx: RouteCtx,
  forma: CoraFormaPagamento,
) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  if (!coraConfigurado()) {
    return NextResponse.json(
      {
        error:
          "Cora não configurada. Defina CORA_CLIENT_ID, CORA_CERT_PEM e CORA_PRIVATE_KEY_PEM no servidor.",
        configured: false,
      },
      { status: 503 },
    );
  }

  const { id } = await ctx.params;
  const pagamentoId = id?.trim();
  if (!pagamentoId) {
    return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  }

  const { data: pag, error: payErr } = await crmDb()
    .from("hub_tenant_mensalidades")
    .select("id, tenant_id, competencia, valor_centavos, status, vencimento, cora_invoice_id")
    .eq("id", pagamentoId)
    .maybeSingle();

  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });
  if (!pag) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });

  try {
    const updated = await emitirMensalidadeNaCora(pag, forma);

    const actor = await getOpsActor(request);
    if (actor?.email) {
      console.info("[ops/cora] cobrança emitida", forma, "por", actor.email, updated.cora_invoice_id);
    }

    return NextResponse.json({ data: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao emitir cobrança Cora.";
    const status = msg.includes("já emitida") ? 409 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  return emitir(request, ctx, "boleto_pix");
}
