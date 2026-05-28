import { NextRequest, NextResponse } from "next/server";
import { carregarRelatorio, type RelatorioEntidade } from "@/lib/crm/relatorios-data";
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

const ENTIDADES_VALIDAS = new Set<string>([
  "leads",
  "negocios",
  "empresas",
  "imoveis",
  "contas_pagar",
  "contas_receber",
  "financeiro",
]);

function filenameFor(entidade: string): string {
  if (entidade === "contas_pagar") return "contas-pagar";
  if (entidade === "contas_receber") return "contas-receber";
  return `relatorio-${entidade}`;
}

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const entidade = request.nextUrl.searchParams.get("entidade") || "leads";
  const format = request.nextUrl.searchParams.get("format") || "csv";

  if (!ENTIDADES_VALIDAS.has(entidade)) {
    return NextResponse.json(
      {
        error:
          "entidade inválida (leads|negocios|empresas|imoveis|contas_pagar|contas_receber|financeiro)",
      },
      { status: 400 }
    );
  }

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const supabase = crmDb();

  try {
    const dataset = await carregarRelatorio(supabase, entidade as RelatorioEntidade, tenantId);

    if (format === "json") {
      return NextResponse.json({
        entidade: dataset.entidade,
        headers: dataset.headers,
        rows: dataset.rows,
        total: dataset.rows.length,
        ...(dataset.aviso ? { aviso: dataset.aviso } : {}),
      });
    }

    const csv = toCsv(dataset.headers, dataset.rows);
    const filename = filenameFor(entidade);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao carregar relatório";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
