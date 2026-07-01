/**
 * Converte o histórico do harness para formato event_stream estilo Manus,
 * antes de enviar ao Mistral. Permite injectar eventos tipados Plan e Knowledge
 * que estruturam melhor o contexto para o modelo.
 */

export type HarnessStreamEvent =
  | { type: "Message"; content: string; role: "user" | "assistant" }
  | { type: "Action"; tool_name: string; arguments: Record<string, unknown> }
  | { type: "Observation"; tool_name: string; result: string; ok: boolean }
  | { type: "Plan"; steps: string[] }
  | { type: "Knowledge"; skill_id: string; resumo: string };

/**
 * Converte uma lista de eventos para o formato de mensagens aceite pelo Mistral.
 *
 * Mapeamento:
 * - Message(user)    → { role: "user",      content: "[Message]\n{content}" }
 * - Message(asst)    → { role: "assistant", content: content }  (sem prefixo — resposta final)
 * - Action           → { role: "assistant", content: "[Action: {tool}]\n{args}" }
 * - Observation      → { role: "tool",      content: "[Observation: {tool}] ok={ok}\n{result}" }
 * - Plan             → { role: "user",      content: "[Plan]\n1. ...\n2. ..." }
 * - Knowledge        → { role: "user",      content: "[Knowledge: {skill_id}]\n{resumo}" }
 */
export function formatarEventStreamParaMistral(
  eventos: HarnessStreamEvent[]
): Array<{ role: "user" | "assistant" | "tool"; content: string }> {
  const result: Array<{ role: "user" | "assistant" | "tool"; content: string }> = [];

  for (const ev of eventos) {
    switch (ev.type) {
      case "Message":
        if (ev.role === "user") {
          result.push({ role: "user", content: `[Message]\n${ev.content}` });
        } else {
          result.push({ role: "assistant", content: ev.content });
        }
        break;

      case "Action":
        result.push({
          role: "assistant",
          content: `[Action: ${ev.tool_name}]\n${JSON.stringify(ev.arguments, null, 2)}`,
        });
        break;

      case "Observation":
        result.push({
          role: "tool",
          content: `[Observation: ${ev.tool_name}] ok=${ev.ok}\n${ev.result}`,
        });
        break;

      case "Plan": {
        const stepsText = ev.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
        result.push({ role: "user", content: `[Plan]\n${stepsText}` });
        break;
      }

      case "Knowledge":
        result.push({
          role: "user",
          content: `[Knowledge: ${ev.skill_id}]\n${ev.resumo}`,
        });
        break;
    }
  }

  return result;
}

/**
 * Converte um histórico simples user/assistant para lista de eventos Message,
 * preservando a ordem original.
 */
export function historicoParaEventStream(
  historico: Array<{ role: "user" | "assistant"; content: string }>
): HarnessStreamEvent[] {
  return historico.map((m) => ({
    type: "Message" as const,
    role: m.role,
    content: m.content,
  }));
}

/**
 * Constrói as mensagens de injecção para Plan e Knowledge que serão
 * pré-pendidas ao histórico antes do turno.
 */
export function buildInjectMessages(params: {
  planSteps?: string[];
  knowledgeEvents?: Array<{ skill_id: string; resumo: string }>;
}): Array<{ role: "user" | "assistant"; content: string }> {
  const msgs: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (params.knowledgeEvents?.length) {
    for (const ke of params.knowledgeEvents) {
      msgs.push({
        role: "user",
        content: `[Knowledge: ${ke.skill_id}]\n${ke.resumo}`,
      });
    }
  }

  if (params.planSteps?.length) {
    const stepsText = params.planSteps.map((s, i) => `${i + 1}. ${s}`).join("\n");
    msgs.push({ role: "user", content: `[Plan]\n${stepsText}` });
  }

  return msgs;
}
