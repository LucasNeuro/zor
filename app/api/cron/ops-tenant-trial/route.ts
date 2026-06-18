import { NextRequest, NextResponse } from "next/server";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import { desativarTenantsTrialExpiradoSemPagamento } from "@/lib/ops/tenant-trial-billing";

/**
 * Desativa tenants com trial expirado e sem mensalidade paga.
 * Agendar diariamente (ex.: Render Cron) com Authorization: Bearer $CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await desativarTenantsTrialExpiradoSemPagamento();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao processar trials.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
