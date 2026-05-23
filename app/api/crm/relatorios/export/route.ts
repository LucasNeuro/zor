import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const entidade = request.nextUrl.searchParams.get("entidade") || "leads";
  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const supabase = crmDb();

  let csv = "";
  let filename = `relatorio-${entidade}`;

  if (entidade === "leads") {
    const { data, error } = await supabase
      .from("hub_leads_crm")
      .select("nome, telefone, email, origem, estagio, valor_estimado, criado_em")
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: false })
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const headers = ["nome", "telefone", "email", "origem", "estagio", "valor_estimado", "criado_em"];
    csv = toCsv(headers, (data ?? []) as Record<string, unknown>[]);
  } else if (entidade === "negocios") {
    const { data, error } = await supabase
      .from("hub_negocios")
      .select("codigo, titulo, prefixo_mercado, etapa, status, valor_estimado, criado_em")
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: false })
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const headers = ["codigo", "titulo", "prefixo_mercado", "etapa", "status", "valor_estimado", "criado_em"];
    csv = toCsv(headers, (data ?? []) as Record<string, unknown>[]);
  } else if (entidade === "empresas") {
    const { data, error } = await supabase
      .from("hub_empresas")
      .select("razao_social, nome_fantasia, cnpj, segmento, mercado, criado_em")
      .order("criado_em", { ascending: false })
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const headers = ["razao_social", "nome_fantasia", "cnpj", "segmento", "mercado", "criado_em"];
    csv = toCsv(headers, (data ?? []) as Record<string, unknown>[]);
  } else if (entidade === "imoveis") {
    const { data, error } = await supabase
      .from("hub_imoveis")
      .select("codigo, titulo, tipo, status, valor, cidade, estado, criado_em")
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: false })
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const headers = ["codigo", "titulo", "tipo", "status", "valor", "cidade", "estado", "criado_em"];
    csv = toCsv(headers, (data ?? []) as Record<string, unknown>[]);
  } else if (entidade === "contas_pagar") {
    const { data, error } = await supabase
      .from("hub_contas_pagar")
      .select("descricao, valor, vencimento, status, criado_em")
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .order("vencimento", { ascending: true, nullsFirst: false })
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const headers = ["descricao", "valor", "vencimento", "status", "criado_em"];
    csv = toCsv(headers, (data ?? []) as Record<string, unknown>[]);
    filename = "contas-pagar";
  } else if (entidade === "contas_receber") {
    const { data, error } = await supabase
      .from("hub_contas_receber")
      .select("descricao, valor, vencimento, status, criado_em")
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .order("vencimento", { ascending: true, nullsFirst: false })
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const headers = ["descricao", "valor", "vencimento", "status", "criado_em"];
    csv = toCsv(headers, (data ?? []) as Record<string, unknown>[]);
    filename = "contas-receber";
  } else if (entidade === "financeiro") {
    const [pagarRes, receberRes] = await Promise.all([
      supabase
        .from("hub_contas_pagar")
        .select("descricao, valor, vencimento, status, criado_em")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .order("vencimento", { ascending: true, nullsFirst: false })
        .limit(5000),
      supabase
        .from("hub_contas_receber")
        .select("descricao, valor, vencimento, status, criado_em")
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .order("vencimento", { ascending: true, nullsFirst: false })
        .limit(5000),
    ]);
    if (pagarRes.error) return NextResponse.json({ error: pagarRes.error.message }, { status: 500 });
    if (receberRes.error) return NextResponse.json({ error: receberRes.error.message }, { status: 500 });
    const headers = ["tipo", "descricao", "valor", "vencimento", "status", "criado_em"];
    const rows: Record<string, unknown>[] = [
      ...(pagarRes.data ?? []).map((r) => ({ tipo: "pagar", ...r })),
      ...(receberRes.data ?? []).map((r) => ({ tipo: "receber", ...r })),
    ];
    csv = toCsv(headers, rows);
    filename = "financeiro";
  } else {
    return NextResponse.json(
      {
        error:
          "entidade inválida (leads|negocios|empresas|imoveis|contas_pagar|contas_receber|financeiro)",
      },
      { status: 400 }
    );
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
