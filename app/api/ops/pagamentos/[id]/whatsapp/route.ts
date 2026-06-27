import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { MENSALIDADE_SELECT } from "@/lib/ops/mensalidade";
import { enviarBoletoWhatsappOps, opsWhatsappConfigurado } from "@/lib/ops/ops-whatsapp-cobranca";
import { requireOpsApiAccess, getOpsActor } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  if (!opsWhatsappConfigurado()) {
    return NextResponse.json(
      {
        error:
          "WhatsApp ops não configurado. Defina UAZAPI_BASE_URL e OPS_UAZAPI_INSTANCE_TOKEN.",
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

  let body: { telefone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const telefone = body.telefone?.replace(/\D/g, "") ?? "";
  if (telefone.length < 10) {
    return NextResponse.json({ error: "Telefone inválido." }, { status: 400 });
  }

  const { data: pag, error: payErr } = await crmDb()
    .from("hub_tenant_mensalidades")
    .select(MENSALIDADE_SELECT)
    .eq("id", pagamentoId)
    .maybeSingle();

  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });
  if (!pag) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
  if (!pag.cora_invoice_id) {
    return NextResponse.json({ error: "Boleto ainda não emitido na Cora." }, { status: 422 });
  }

  const { data: tenant } = await crmDb()
    .from("hub_tenants")
    .select("nome_exibicao")
    .eq("id", pag.tenant_id)
    .maybeSingle();

  try {
    const actor = await getOpsActor(request);
    await enviarBoletoWhatsappOps({
      mensalidadeId: pag.id,
      tenantId: pag.tenant_id,
      telefone,
      tenantNome: tenant?.nome_exibicao ?? "Cliente Waje",
      valorCentavos: pag.valor_centavos ?? 0,
      vencimento: pag.vencimento,
      boletoArquivoUrl: pag.boleto_arquivo_url,
      coraBoletoUrl: pag.cora_boleto_url,
      actorEmail: actor?.email,
    });

    const { data: updated } = await crmDb()
      .from("hub_tenant_mensalidades")
      .select(MENSALIDADE_SELECT)
      .eq("id", pag.id)
      .single();

    return NextResponse.json({
      data: {
        ...updated,
        valor_reais: (updated?.valor_centavos ?? 0) / 100,
        tenant_nome: tenant?.nome_exibicao ?? null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao enviar WhatsApp.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
