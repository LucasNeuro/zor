import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const supabase = crmDb();

  const { data: vinculos, error } = await supabase
    .from("hub_pessoas_empresas")
    .select("id, cargo, principal, empresa_id, hub_empresas(id, codigo, razao_social, nome_fantasia)")
    .eq("pessoa_id", id);

  if (error?.code === "42P01") {
    return NextResponse.json({ data: { empresas: [], leads: [], negocios: [] } });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [{ data: leads }, { data: negocios }] = await Promise.all([
    supabase
      .from("hub_leads_crm")
      .select("id, nome, estagio, estagio_funil, criado_em")
      .eq("pessoa_id", id)
      .order("criado_em", { ascending: false })
      .limit(20),
    supabase
      .from("hub_negocios")
      .select("id, codigo, titulo, etapa, status, criado_em")
      .eq("pessoa_id", id)
      .order("criado_em", { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    data: {
      empresas: (vinculos ?? []).map((v) => {
        const emp = v.hub_empresas as
          | { id: string; codigo: string | null; razao_social: string; nome_fantasia: string | null }
          | { id: string; codigo: string | null; razao_social: string; nome_fantasia: string | null }[]
          | null;
        const row = Array.isArray(emp) ? emp[0] : emp;
        return {
          vinculo_id: v.id,
          cargo: v.cargo,
          principal: v.principal,
          empresa_id: v.empresa_id,
          codigo: row?.codigo ?? null,
          razao_social: row?.razao_social ?? "—",
          nome_fantasia: row?.nome_fantasia ?? null,
        };
      }),
      leads: leads ?? [],
      negocios: negocios ?? [],
    },
  });
}
