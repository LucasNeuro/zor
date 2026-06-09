import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  humanoResponsavelFromActor,
  resolveActorFromRequest,
} from "@/lib/crm/resolve-crm-actor";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status, aprovado_por, observacao } = body as {
    status: string;
    aprovado_por?: string;
    observacao?: string;
  };

  const supabase = db();
  const actor = await resolveActorFromRequest(supabase, request.headers);
  const actorFallback = humanoResponsavelFromActor(actor);

  const { data: aprovacaoRow } = await supabase
    .from("hub_aprovacoes")
    .select("tipo, dados")
    .eq("id", id)
    .single();

  const updates: Record<string, unknown> = {
    status,
    atualizado_em: new Date().toISOString(),
  };

  if (status === "aprovado") {
    updates.aprovado_por = aprovado_por || actorFallback;
    updates.aprovado_em = new Date().toISOString();
  } else if (status === "rejeitado" || status === "ignorado") {
    updates.rejeitado_por = aprovado_por || actorFallback;
    updates.rejeitado_em = new Date().toISOString();
    if (observacao) updates.observacao = observacao;
  }

  const { error } = await supabase.from("hub_aprovacoes").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const dados = (aprovacaoRow?.dados as Record<string, unknown>) || {};
  const pedidoId = dados.pedido_id as string | undefined;
  if (aprovacaoRow?.tipo === "cotacao_fornecedor" && pedidoId && (status === "aprovado" || status === "rejeitado")) {
    await supabase
      .from("hub_cotacoes_pedidos")
      .update({
        status: status === "aprovado" ? "aprovado" : "rejeitado",
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", pedidoId);
  }

  return NextResponse.json({ ok: true });
}
