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
    .select("id, cargo, principal, pessoa_id, hub_pessoas(id, codigo, nome, telefone, email)")
    .eq("empresa_id", id);

  if (error?.code === "42P01") {
    return NextResponse.json({ data: { pessoas: [], negocios: [] } });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: negocios } = await supabase
    .from("hub_negocios")
    .select("id, codigo, titulo, etapa, status, criado_em")
    .eq("empresa_id", id)
    .order("criado_em", { ascending: false })
    .limit(20);

  return NextResponse.json({
    data: {
      pessoas: (vinculos ?? []).map((v) => {
        const pes = v.hub_pessoas as
          | { id: string; codigo: string | null; nome: string; telefone: string | null; email: string | null }
          | { id: string; codigo: string | null; nome: string; telefone: string | null; email: string | null }[]
          | null;
        const row = Array.isArray(pes) ? pes[0] : pes;
        return {
          vinculo_id: v.id,
          cargo: v.cargo,
          principal: v.principal,
          pessoa_id: v.pessoa_id,
          codigo: row?.codigo ?? null,
          nome: row?.nome ?? "—",
          telefone: row?.telefone ?? null,
          email: row?.email ?? null,
        };
      }),
      negocios: negocios ?? [],
    },
  });
}
