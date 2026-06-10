import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  leadTemConversaAtiva,
  loadLeadsCrmEnriquecidos,
} from "@/lib/crm/load-leads-crm-enriquecidos";
import { defaultTenantId, tenantIdFromRequest, tenantScopeOrFilter } from "@/lib/tenant-default";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const estagioAtendimento = searchParams.get("estagio_atendimento");
    const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
    const tenantFilter = tenantScopeOrFilter(tenantId);

    const { data: msgRows, error: msgError } = await supabase
      .from("hub_fila_mensagens")
      .select("lead_id")
      .or(tenantFilter)
      .not("lead_id", "is", null);

    const leadIdsComMensagem = new Set<string>(
      msgError
        ? []
        : (msgRows ?? [])
            .map((r) => (r.lead_id != null ? String(r.lead_id) : ""))
            .filter(Boolean)
    );

    const { rows, error } = await loadLeadsCrmEnriquecidos(supabase, tenantFilter, {
      skipView: true,
    });
    if (error) {
      return NextResponse.json({ error, leads: [] }, { status: 500 });
    }

    let filtered = rows.filter((row) => leadTemConversaAtiva(row, leadIdsComMensagem));

    if (estagioAtendimento && estagioAtendimento !== "todos") {
      filtered = filtered.filter((row) => {
        const est =
          row.estagio_atendimento != null ? String(row.estagio_atendimento) : "novo";
        return est === estagioAtendimento;
      });
    }

    const leads = filtered.map((row) => {
      const r = row;
      return {
        ...r,
        estagio: r.estagio != null ? String(r.estagio) : "novo",
        estagio_atendimento:
          r.estagio_atendimento != null ? String(r.estagio_atendimento) : "novo",
        _pessoa_codigo:
          r._pessoa_codigo != null
            ? String(r._pessoa_codigo)
            : r.pessoa_codigo != null
              ? String(r.pessoa_codigo)
              : null,
      };
    });

    return NextResponse.json({ leads });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg, leads: [] }, { status: 500 });
  }
}
