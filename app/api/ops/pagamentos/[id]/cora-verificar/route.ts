import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { getCoraConfig } from "@/lib/cora/cora-config";
import { clientIdDoCertificadoCora } from "@/lib/cora/cora-config";
import {
  consultarCobrancaCora,
  extrairPixEmvCora,
  extrairUrlBoletoCora,
} from "@/lib/cora/cora-client";
import { getCoraEmissorCnpj, getCoraEmissorNome } from "@/lib/cora/cora-emissor";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { id } = await ctx.params;
  const pagamentoId = id?.trim();
  if (!pagamentoId) {
    return NextResponse.json({ error: "ID da cobrança obrigatório." }, { status: 400 });
  }

  const { data: pag, error } = await crmDb()
    .from("hub_tenant_mensalidades")
    .select("id, cora_invoice_id, valor_centavos, vencimento, tenant_id")
    .eq("id", pagamentoId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pag) return NextResponse.json({ error: "Cobrança não encontrada." }, { status: 404 });
  if (!pag.cora_invoice_id) {
    return NextResponse.json(
      { error: "Esta cobrança ainda não tem cora_invoice_id — não foi emitida na Cora." },
      { status: 422 },
    );
  }

  try {
    const cfg = getCoraConfig();
    const invoice = await consultarCobrancaCora(pag.cora_invoice_id);
    const customer = (invoice as { customer?: { name?: string } }).customer;

    return NextResponse.json({
      data: {
        cora_invoice_id: invoice.id,
        status: invoice.status,
        total_amount: invoice.total_amount,
        valor_centavos_waje: pag.valor_centavos,
        vencimento_waje: pag.vencimento,
        customer_name: customer?.name ?? null,
        boleto_url: extrairUrlBoletoCora(invoice),
        tem_pix: Boolean(extrairPixEmvCora(invoice)),
        cora_ambiente: cfg.env,
        cora_client_id: cfg.clientId,
        cora_client_id_cert: clientIdDoCertificadoCora(cfg.cert),
        cora_emissor_cnpj: getCoraEmissorCnpj(),
        cora_emissor_nome: getCoraEmissorNome(),
        dica_painel_cora:
          "No app Cora: Gestão de boletos → «A receber» ou «Todos». Pesquise pelo nome do cliente " +
          "ou role até o vencimento. Cobranças de 2026 aparecem abaixo das de 2027.",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao consultar Cora.";
    return NextResponse.json(
      {
        error: msg,
        cora_invoice_id: pag.cora_invoice_id,
        dica:
          "Se GET falhar com 404, o invoice_id pode ser de outro ambiente (stage vs production) " +
          "ou credenciais diferentes das da conta ONNZE no painel web.",
      },
      { status: 502 },
    );
  }
}
