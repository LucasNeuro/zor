import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tenantIdFromRequest } from "@/lib/tenant-default";

const ATENDIMENTO_SELECT =
  "id, nome, telefone, email, origem, estagio, estagio_atendimento, score, valor_estimado, criado_em, atualizado_em, agente_responsavel, humano_responsavel, ultimo_contato, campanha, proxima_acao, data_proxima_acao, interesse_principal, tags, observacoes, metadata, codigo, pipeline_id";

function isAtendimentoRelevant(row: Record<string, unknown>): boolean {
  const humano = row.humano_responsavel != null ? String(row.humano_responsavel).trim() : "";
  const agente = row.agente_responsavel != null ? String(row.agente_responsavel).trim() : "";
  const ultimaMsg = row.ultima_mensagem_fila_em;
  return Boolean(humano || agente || ultimaMsg);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const estagioAtendimento = searchParams.get("estagio_atendimento");
    const tenantId = tenantIdFromRequest(request.headers);

    let query = supabase
      .from("vw_hub_leads_crm_enriquecido")
      .select(`${ATENDIMENTO_SELECT}, ultima_mensagem_fila, ultima_mensagem_fila_em, pessoa_codigo`)
      .eq("tenant_id", tenantId)
      .order("atualizado_em", { ascending: false });

    if (estagioAtendimento && estagioAtendimento !== "todos") {
      query = query.eq("estagio_atendimento", estagioAtendimento);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message, leads: [] }, { status: 500 });
    }

    const leads = (data || [])
      .filter((row) => isAtendimentoRelevant(row as Record<string, unknown>))
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          ...r,
          estagio_atendimento: r.estagio_atendimento != null ? String(r.estagio_atendimento) : "novo",
          _pessoa_codigo: r.pessoa_codigo != null ? String(r.pessoa_codigo) : null,
        };
      });

    return NextResponse.json({ leads });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg, leads: [] }, { status: 500 });
  }
}
