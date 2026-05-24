import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prepararRowHubLeadInsert } from "@/lib/crm/lead-cadastro";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET() {
  const { data, error } = await db()
    .from("hub_leads_crm")
    .select("id, nome, telefone, origem, estagio, score, valor_estimado, agente_responsavel, humano_responsavel, criado_em, atualizado_em")
    .not("estagio", "in", "(perdido,ganho)")
    .order("score", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  if (!body.nome) return NextResponse.json({ error: "nome required" }, { status: 400 });

  const row = await prepararRowHubLeadInsert(db(), {
    nome: body.nome,
    telefone: body.telefone ?? null,
    email: body.email ?? null,
    origem: body.origem ?? "outro",
    campanha: body.campanha ?? null,
    estagio: body.estagio ?? "novo",
    valor_estimado: body.valor_estimado ?? 0,
    score: body.score ?? 50,
    tags: body.tags ?? [],
    metadata: { origem_cadastro: "api_leads_legacy" },
  });

  const { data, error } = await db().from("hub_leads_crm").insert(row).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  updates.atualizado_em = new Date().toISOString();
  const { error } = await db().from("hub_leads_crm").update(updates).eq("id", id as string);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
