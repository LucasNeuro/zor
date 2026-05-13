import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tenantIdFromRequest } from "@/lib/tenant-default";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const estagio = searchParams.get("estagio");
    const tenantId = tenantIdFromRequest(request.headers);

    let query = supabase
      .from("hub_leads_crm")
      .select("id, nome, telefone, origem, estagio, score, valor_estimado, criado_em, atualizado_em")
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: false });

    if (estagio && estagio !== "todos") {
      query = query.eq("estagio", estagio);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message, leads: [] }, { status: 500 });
    }

    return NextResponse.json({ leads: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg, leads: [] }, { status: 500 });
  }
}
