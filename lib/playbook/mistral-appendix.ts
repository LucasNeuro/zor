/**
 * Apêndice curto para operadores Agno — LLM não deve alterar o playbook determinístico.
 * API: https://docs.mistral.ai/capabilities/completion/usage
 */

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

export async function mistralGenerateAgnoAppendix(
  deterministicPlaybookPreview: string,
  agenteNome: string,
  agenteSlug: string
): Promise<string | null> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key?.trim()) return null;

  const model = process.env.MISTRAL_MODEL || "mistral-small-latest";

  const preview =
    deterministicPlaybookPreview.length > 12000
      ? deterministicPlaybookPreview.slice(0, 12000) + "\n\n[… truncado para contexto Mistral …]"
      : deterministicPlaybookPreview;

  const system = `És um assistente técnico Obra10+. O utilizador já tem um playbook Markdown COMPLETO e EXACTO (gerado a partir da base de dados) no início da mensagem.
A tua ÚNICA tarefa: acrescentar UMA secção final ao documento, após uma linha exactamente igual a:
<!-- AGNO_APPENDIX_START -->

Essa secção deve chamar-se "## Apêndice Agno (AgentOS / SDK)" e deve:
1) Explicar em 3–6 parágrafos curtos como usar este playbook como \`instructions\` / descrição num Agent Agno (Python), alinhado a https://docs.agno.com/first-agent
2) Sugerir que o agente não contradiga listas literais nem JSON embutido do playbook
3) NÃO repetir o playbook, NÃO resumir regras de negócio, NÃO inventar políticas
4) Responder SÓ com o conteúdo Markdown da secção após <!-- AGNO_APPENDIX_START --> (inclui essa linha como primeira linha da tua resposta)

Idioma: português do Brasil.`;

  const user = `Playbook determinístico (início):\n\n${preview}\n\n—\nAgente: ${agenteNome} (\`${agenteSlug}\`)\nGera só o apêndice após a linha mágica.`;

  const res = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      max_tokens: 2048,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("[playbook] Mistral HTTP", res.status, t.slice(0, 500));
    return null;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | unknown } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return null;
  return content.trim();
}
