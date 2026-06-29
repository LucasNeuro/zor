import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { aggregateAnalytics } from "@/lib/crm/analytics-aggregate";
import { parseAnalyticsPeriodo } from "@/lib/crm/analytics-period";
import { MERCADOS_PREFIXO } from "@/lib/crm/negocio-cadastro";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";

function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const parts = [o.message, o.code, o.details, o.hint]
      .map((p) => (p != null && String(p).trim() ? String(p) : ""))
      .filter(Boolean);
    if (parts.length) return parts.join(" — ");
  }
  return "Erro ao agregar analytics";
}

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const periodo = parseAnalyticsPeriodo(request.nextUrl.searchParams.get("periodo"));
  const tenantId = await resolveTenantIdFromCaller(request);
  const mercadoRaw = request.nextUrl.searchParams.get("mercado")?.trim().toUpperCase() ?? "";
  const mercado =
    mercadoRaw && (MERCADOS_PREFIXO as readonly string[]).includes(mercadoRaw) ? mercadoRaw : undefined;

  if (mercadoRaw && !mercado) {
    return NextResponse.json(
      {
        error: `Mercado inválido: ${mercadoRaw}. Use um de: ${MERCADOS_PREFIXO.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  try {
    const payload = await aggregateAnalytics(crmDb(), tenantId, periodo, mercado);
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}
