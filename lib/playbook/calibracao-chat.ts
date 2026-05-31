import { completarChatPreferindoMistral } from "@/lib/ia/llm-completion";

export type CalibracaoMensagemLinha = {
  papel: "user" | "assistant";
  conteudo: string;
};

const MAX_PLAYBOOK_CHARS = 48_000;
const MAX_HISTORICO_TURNOS = 24;

function calcularCustoBrl(modelo: string, input: number, output: number): number {
  const inM = input / 1_000_000;
  const outM = output / 1_000_000;
  let usd = 0;
  const m = modelo.toLowerCase();
  if (m.includes("mistral") || m.includes("mixtral") || m.includes("ministral")) {
    usd = inM * 0.2 + outM * 0.6;
  } else if (m.includes("haiku")) usd = inM * 1 + outM * 5;
  else if (m.includes("sonnet")) usd = inM * 3 + outM * 15;
  else if (m.includes("opus")) usd = inM * 15 + outM * 75;
  else usd = inM * 3 + outM * 15;
  return usd * 5.5;
}

function truncPlaybook(markdown: string): string {
  const t = markdown.trim();
  if (t.length <= MAX_PLAYBOOK_CHARS) return t;
  return `${t.slice(0, MAX_PLAYBOOK_CHARS)}\n\n[playbook truncado para contexto do chat de calibração]`;
}

export function montarSystemCalibracaoPlaybook(params: {
  agenteNome: string;
  agenteSlug: string;
  cargo?: string | null;
  playbookMarkdown: string;
}): string {
  const cargo = String(params.cargo ?? "").trim() || "—";
  return `Você está no MODO CALIBRAÇÃO DE PLAYBOOK do CRM Obra10+ (equipe interna).
Agente: ${params.agenteNome} (${params.agenteSlug})
Cargo/registo: ${cargo}

Regras absolutas:
- O playbook Markdown abaixo é a fonte que o humano está a calibrar. Baseie-se nele.
- Ajude a auditar qualidade, fechar gaps, reduzir riscos e reescrever secções.
- Quando sugerir alterações, devolva trechos em Markdown claro (títulos ### e listas).
- NÃO afirme que publicou ou gravou alterações — o humano usa o botão «Publicar» no editor.
- Não simule atendimento a cliente final; foque na documentação operacional.
- Se pedirem «aplica na secção X», devolva o texto pronto para colar/substituir.
- Português (Brasil). Objetivo, concreto e acionável.

--- PLAYBOOK_ATUAL (Markdown) ---
${truncPlaybook(params.playbookMarkdown)}
--- FIM PLAYBOOK_ATUAL ---`;
}

export async function executarCalibracaoPlaybookReply(params: {
  agenteNome: string;
  agenteSlug: string;
  cargo?: string | null;
  playbookMarkdown: string;
  historico: CalibracaoMensagemLinha[];
  mensagemUsuario: string;
  modelo?: string;
}): Promise<{
  texto: string;
  modelo: string;
  tokens_input?: number;
  tokens_output?: number;
  custo_brl?: number;
}> {
  const system = montarSystemCalibracaoPlaybook({
    agenteNome: params.agenteNome,
    agenteSlug: params.agenteSlug,
    cargo: params.cargo,
    playbookMarkdown: params.playbookMarkdown,
  });

  const historico = params.historico.slice(-MAX_HISTORICO_TURNOS);
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...historico.map((m) => ({ role: m.papel, content: m.conteudo })),
    { role: "user", content: params.mensagemUsuario.trim() },
  ];

  const completion = await completarChatPreferindoMistral({
    systemPrompt: system,
    mensagens: messages,
    modeloFromDb: params.modelo?.trim() || "mistral",
    maxTokens: 2500,
  });

  if (!completion.ok) {
    throw new Error(completion.erro || "Falha ao gerar resposta de calibração.");
  }

  const brl = calcularCustoBrl(completion.modeloLog, completion.tokensEntrada, completion.tokensSaida);

  return {
    texto: completion.texto.trim(),
    modelo: completion.modeloLog,
    tokens_input: completion.tokensEntrada,
    tokens_output: completion.tokensSaida,
    custo_brl: brl,
  };
}
