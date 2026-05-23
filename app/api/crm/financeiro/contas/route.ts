import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as {
    tipo?: string;
    descricao?: string;
    valor?: number | string;
    vencimento?: string | null;
  };

  const tipo = body.tipo?.trim();
  if (tipo !== "pagar" && tipo !== "receber") {
    return NextResponse.json({ error: "tipo deve ser pagar ou receber" }, { status: 400 });
  }

  const descricao = body.descricao?.trim();
  if (!descricao) {
    return NextResponse.json({ error: "descricao é obrigatória" }, { status: 400 });
  }

  const valor = Number(body.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: "valor inválido" }, { status: 400 });
  }

  const vencimento =
    body.vencimento != null && String(body.vencimento).trim()
      ? String(body.vencimento).slice(0, 10)
      : null;

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const supabase = crmDb();

  const row = {
    descricao,
    valor,
    vencimento,
    status: "pendente",
    tenant_id: tenantId,
    atualizado_em: new Date().toISOString(),
  };

  const table = tipo === "pagar" ? "hub_contas_pagar" : "hub_contas_receber";
  const { data, error } = await supabase.from(table).insert(row).select("id").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id, tipo }, { status: 201 });
}
