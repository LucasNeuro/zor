import { NextRequest, NextResponse } from "next/server";
import { carregarRelatorio } from "@/lib/crm/relatorios-data";
import { resolveRelatorioViewId, relatorioViewById } from "@/lib/crm/relatorio-views-catalog";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";

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

function filenameFor(viewId: string): string {
  const def = relatorioViewById(viewId);
  const slug = def?.label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || viewId.replace(/^vw_rel_/, "");
}

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const viewIdParam =
    request.nextUrl.searchParams.get("view_id") ||
    request.nextUrl.searchParams.get("entidade") ||
    "vw_rel_leads_enriquecidos";
  const format = request.nextUrl.searchParams.get("format") || "csv";
  const colunasRaw = request.nextUrl.searchParams.get("colunas");
  const colunasSelecionadas = colunasRaw
    ? colunasRaw.split(",").map((c) => c.trim()).filter(Boolean)
    : undefined;

  const viewId = resolveRelatorioViewId(viewIdParam);
  if (!relatorioViewById(viewId)) {
    return NextResponse.json({ error: `view_id inválido: ${viewIdParam}` }, { status: 400 });
  }

  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = crmDb();

  try {
    const dataset = await carregarRelatorio(supabase, viewId, tenantId, colunasSelecionadas);

    if (format === "json") {
      return NextResponse.json({
        viewId: dataset.viewId,
        headers: dataset.headers,
        rows: dataset.rows,
        total: dataset.rows.length,
        ...(dataset.aviso ? { aviso: dataset.aviso } : {}),
      });
    }

    const csv = toCsv(dataset.headers, dataset.rows);
    const filename = filenameFor(dataset.viewId);
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
