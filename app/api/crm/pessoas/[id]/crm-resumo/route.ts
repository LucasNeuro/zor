import { NextRequest, NextResponse } from "next/server";
import { buildCrmResumoForPessoa } from "@/lib/crm/cliente-crm-resumo";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const supabase = crmDb();

  try {
    const data = await buildCrmResumoForPessoa(supabase, id);
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao carregar resumo CRM.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
