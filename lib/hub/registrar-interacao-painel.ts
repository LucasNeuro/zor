import type { SupabaseClient } from "@supabase/supabase-js";
import type { BriefingModoSessao } from "@/lib/agente-briefing-chat";

type CicloRow = {
  id: string;
  tipo?: string | null;
  nome?: string | null;
  total_execucoes?: number | null;
};

async function resolverCicloInteracao(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<CicloRow | null> {
  const { data: ciclos } = await supabase
    .from("hub_ciclos_ia")
    .select("id, tipo, nome, total_execucoes")
    .eq("agente_slug", agenteSlug)
    .eq("ativo", true)
    .order("nome");

  if (!ciclos?.length) return null;

  const gatilho = ciclos.find((c) => String(c.tipo || "").toLowerCase() === "gatilho");
  if (gatilho) return gatilho as CicloRow;

  const sobInteracao = ciclos.find((c) => /intera[cç][aã]o/i.test(String(c.nome || "")));
  if (sobInteracao) return sobInteracao as CicloRow;

  return ciclos[0] as CicloRow;
}

export type RegistrarInteracaoPainelParams = {
  agenteSlug: string;
  modo: BriefingModoSessao;
  sessaoId: string;
  mensagemUsuario: string;
  respostaTexto: string;
  modelo: string;
  tokens_input: number;
  tokens_output: number;
  custo_brl: number;
  motor?: string;
  leadId?: string | null;
  /** Copiloto interno: só prompt log; não incrementa ciclo de canal. */
  ehCopilotoInterno?: boolean;
};

/**
 * Grava interação do painel (briefing / simulação) para métricas operacionais no CRM.
 * Produção WhatsApp já regista via engine/webhook; isto cobre testes no Copiloto IA.
 */
export async function registrarInteracaoPainelAgente(
  supabase: SupabaseClient,
  params: RegistrarInteracaoPainelParams
): Promise<void> {
  const agora = new Date().toISOString();
  const tokensTotal = (params.tokens_input || 0) + (params.tokens_output || 0);

  try {
    await supabase.from("hub_prompt_logs").insert({
      lead_id: params.leadId ?? null,
      agente_slug: params.agenteSlug,
      mensagem_usuario: params.mensagemUsuario,
      resposta_ia: params.respostaTexto,
      modelo_usado: params.modelo,
      tokens_input: params.tokens_input,
      tokens_output: params.tokens_output,
      custo_estimado_brl: params.custo_brl,
      foi_escalado: false,
      metadata: {
        origem: "painel_copiloto",
        modo: params.modo,
        sessao_id: params.sessaoId,
        motor: params.motor ?? null,
      },
    });
  } catch (e) {
    console.warn("[registrar-interacao-painel] hub_prompt_logs:", e);
  }

  if (params.ehCopilotoInterno) return;

  const ciclo = await resolverCicloInteracao(supabase, params.agenteSlug);
  if (!ciclo?.id) return;

  const acao =
    params.modo === "simulacao_canal"
      ? "simulacao_canal_painel"
      : "briefing_operacional_painel";

  try {
    await supabase.from("hub_ciclos_log").insert({
      ciclo_id: ciclo.id,
      agente_slug: params.agenteSlug,
      status: "sucesso",
      tokens_usados: tokensTotal,
      custo_brl: params.custo_brl,
      acoes_tomadas: {
        acao,
        modo: params.modo,
        sessao_id: params.sessaoId,
        lead_id: params.leadId ?? null,
        motor: params.motor ?? null,
      },
      iniciado_em: agora,
      finalizado_em: agora,
    });
  } catch (e) {
    console.warn("[registrar-interacao-painel] hub_ciclos_log:", e);
  }

  try {
    await supabase
      .from("hub_ciclos_ia")
      .update({
        ultimo_ciclo: agora,
        ultimo_status: "sucesso",
        total_execucoes: (ciclo.total_execucoes ?? 0) + 1,
        atualizado_em: agora,
      })
      .eq("id", ciclo.id);
  } catch (e) {
    console.warn("[registrar-interacao-painel] hub_ciclos_ia:", e);
  }
}
