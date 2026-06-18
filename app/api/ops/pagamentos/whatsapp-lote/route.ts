import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { MENSALIDADE_SELECT } from "@/lib/ops/cora-mensalidade";
import { enviarBoletoWhatsappOps, opsWhatsappConfigurado } from "@/lib/ops/ops-whatsapp-cobranca";
import { requireOpsApiAccess, getOpsActor } from "@/lib/ops/ops-api-auth";

export async function POST(request: NextRequest) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  if (!opsWhatsappConfigurado()) {
    return NextResponse.json(
      { error: "WhatsApp ops não configurado.", configured: false },
      { status: 503 },
    );
  }

  let body: { envios?: Array<{ pagamento_id: string; telefone: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const envios = body.envios ?? [];
  if (!envios.length) {
    return NextResponse.json({ error: "Informe envios: [{ pagamento_id, telefone }]." }, { status: 400 });
  }

  const actor = await getOpsActor(request);
  const ok: string[] = [];
  const erros: Array<{ pagamento_id: string; error: string }> = [];

  for (const item of envios) {
    const pagamentoId = item.pagamento_id?.trim();
    const telefone = item.telefone?.replace(/\D/g, "") ?? "";
    if (!pagamentoId || telefone.length < 10) {
      erros.push({ pagamento_id: pagamentoId ?? "?", error: "ID ou telefone inválido." });
      continue;
    }

    const { data: pag } = await crmDb()
      .from("hub_tenant_mensalidades")
      .select(MENSALIDADE_SELECT)
      .eq("id", pagamentoId)
      .maybeSingle();

    if (!pag?.cora_invoice_id) {
      erros.push({ pagamento_id: pagamentoId, error: "Boleto não emitido na Cora." });
      continue;
    }

    const { data: tenant } = await crmDb()
      .from("hub_tenants")
      .select("nome_exibicao")
      .eq("id", pag.tenant_id)
      .maybeSingle();

    try {
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
      ok.push(pagamentoId);
    } catch (e) {
      erros.push({
        pagamento_id: pagamentoId,
        error: e instanceof Error ? e.message : "Falha no envio.",
      });
    }
  }

  return NextResponse.json(
    {
      resumo: { enviados: ok.length, falhas: erros.length, total: envios.length },
      enviados: ok,
      erros,
    },
    { status: erros.length && !ok.length ? 502 : erros.length ? 207 : 200 },
  );
}
