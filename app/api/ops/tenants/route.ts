import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

function cnpjFromSettings(settings: unknown): string | null {
  if (!settings || typeof settings !== "object") return null;
  const s = settings as Record<string, unknown>;
  const direct = typeof s.cnpj === "string" ? s.cnpj.trim() : "";
  if (direct) return direct;
  const cad = s.empresa_cadastral;
  if (cad && typeof cad === "object") {
    const c = (cad as Record<string, unknown>).cnpj;
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const ativoParam = request.nextUrl.searchParams.get("ativo");
  let query = crmDb()
    .from("hub_tenants")
    .select("id, slug, nome_exibicao, ativo, criado_em, settings, trial_ate")
    .order("criado_em", { ascending: false });

  if (ativoParam === "true") query = query.eq("ativo", true);
  if (ativoParam === "false") query = query.eq("ativo", false);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tenants = (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    nome: row.nome_exibicao,
    ativo: row.ativo !== false,
    criado_em: row.criado_em,
    cnpj: cnpjFromSettings(row.settings),
    trial_ate: (row as { trial_ate?: string | null }).trial_ate ?? null,
  }));

  return NextResponse.json({ data: tenants });
}
