import type { SupabaseClient } from "@supabase/supabase-js";
import { mistralMemoryModelId } from "@/lib/ia/hub-model-defaults";
import { mistralChatCompletion } from "@/lib/ia/mistral-chat";
import { stagingMemoryPatch } from "@/lib/harness/stores/memory-store";
import type { HarnessSurface } from "@/lib/harness/types";

/**
 * Job pós-turno (REFLECT leve) — propõe patch de memória curada.
 * Não bloqueia o turno; falhas são ignoradas.
 */
export async function executarHarnessBackgroundReview(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    agenteSlug: string;
    surface: HarnessSurface | "whatsapp_lead" | "email_lead";
    mensagemUsuario: string;
    respostaIA: string;
    sessionId?: string | null;
    requireApproval?: boolean;
  }
): Promise<void> {
  const user = [
    `Canal: ${params.surface}`,
    `Mensagem:\n${params.mensagemUsuario.slice(0, 1500)}`,
    `Resposta:\n${params.respostaIA.slice(0, 1500)}`,
  ].join("\n\n");

  const system = `Analise o turno e extraia NO MÁXIMO 1 facto operacional novo sobre preferências, políticas ou padrões do agente/tenant.
Responda APENAS JSON: {"aplicar":true|false,"target":"operacional"|"utilizador"|"atendimento","conteudo":"frase curta"}
Se nada novo relevante: {"aplicar":false}`;

  const out = await mistralChatCompletion({
    model: mistralMemoryModelId(),
    system,
    messages: [{ role: "user", content: user }],
    maxTokens: 256,
    temperature: 0.1,
  });

  if (!out.ok || !out.text.trim()) return;

  let parsed: { aplicar?: boolean; target?: string; conteudo?: string };
  try {
    const raw = out.text.trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return;
    parsed = JSON.parse(raw.slice(start, end + 1)) as typeof parsed;
  } catch {
    return;
  }

  if (!parsed.aplicar || !parsed.conteudo?.trim()) return;
  const target =
    parsed.target === "utilizador" || parsed.target === "atendimento"
      ? parsed.target
      : "operacional";

  await stagingMemoryPatch(supabase, {
    tenantId: params.tenantId,
    agenteSlug: params.agenteSlug,
    sessionId: params.sessionId,
    target,
    conteudo: parsed.conteudo.trim(),
    requireApproval: params.requireApproval ?? false,
  });
}
