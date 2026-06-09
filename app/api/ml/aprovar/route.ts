import { NextRequest, NextResponse } from "next/server";
import { aplicarMudancaConfirmada } from "@/lib/ia/ml";
import { createClient } from "@supabase/supabase-js";
import {
  humanoResponsavelFromActor,
  resolveActorFromRequest,
} from "@/lib/crm/resolve-crm-actor";

export async function POST(request: NextRequest) {
  try {
    const { sugestaoId, acao, motivo, confirmacao } = await request.json();

    if (!sugestaoId || !acao) {
      return NextResponse.json({ erro: "sugestaoId e acao são obrigatórios" }, { status: 400 });
    }

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const actor = await resolveActorFromRequest(db, request.headers);
    const aprovadoPor = humanoResponsavelFromActor(actor);

    // PASSO 1 — humano aprova pela primeira vez → retorna preview detalhado
    if (acao === "aprovar_primeira_vez") {
      const resultado = await aplicarMudancaConfirmada(sugestaoId, "primeira_aprovacao", aprovadoPor);
      return NextResponse.json({
        ...resultado,
        instrucao: 'Para confirmar, chame novamente com acao="confirmar_aplicar" e confirmacao="CONFIRMO_A_ALTERACAO"',
      });
    }

    // PASSO 2 — humano confirma com token explícito → executa a mudança
    if (acao === "confirmar_aplicar") {
      if (confirmacao !== "CONFIRMO_A_ALTERACAO") {
        return NextResponse.json(
          { erro: 'Token de confirmação inválido. Use confirmacao="CONFIRMO_A_ALTERACAO"' },
          { status: 400 }
        );
      }
      const resultado = await aplicarMudancaConfirmada(sugestaoId, "confirmacao_final", aprovadoPor);
      return NextResponse.json(resultado);
    }

    // REJEITAR — apenas atualiza status, sem executar nada
    if (acao === "rejeitar") {
      await db
        .from("hub_ml_sugestoes")
        .update({
          status: "rejeitado",
          motivo_rejeicao: motivo || "Rejeitado pelo usuário",
        })
        .eq("id", sugestaoId);
      return NextResponse.json({ sucesso: true, status: "rejeitado" });
    }

    return NextResponse.json({ erro: "acao inválida. Use: aprovar_primeira_vez | confirmar_aplicar | rejeitar" }, { status: 400 });
  } catch (erro) {
    const errMsg = erro instanceof Error ? erro.message : "Erro desconhecido";
    return NextResponse.json({ sucesso: false, erro: errMsg }, { status: 500 });
  }
}
