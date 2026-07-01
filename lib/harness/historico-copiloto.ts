export type HistoricoCopilotoLinha = {
  papel: "user" | "assistant";
  conteudo: string;
};

export const BLOCO_MEMORIA_CONVERSA_HARNESS = `### MEMÓRIA E HISTÓRICO (harness — obrigatório)
- As **mensagens anteriores** deste thread (utilizador/assistente) são o **histórico desta conversa**. Use-as para continuidade, resumos e «o que já falámos».
- O bloco **MEMÓRIA CURADA** e **MEMÓRIAS DO AGENTE** cobrem preferências e factos **entre sessões/dias** — não substituem o thread actual.
- Pedidos como «resumo das nossas conversas», «o que discutimos» ou «recapitule» → resuma **primeiro** o thread actual; depois complemente com memória curada se existir.
- A regra «não afirme factos sem ferramenta» aplica-se a **dados CRM/financeiros/operacionais** (leads, valores, contagens). **Não** se aplica a resumir o que foi dito no chat.
- **Nunca** diga que «não tem registo de conversas» se existirem mensagens anteriores neste thread ou entradas no bloco de memória.`;

export function formatarBlocoHistoricoCopiloto(
  historico: HistoricoCopilotoLinha[],
  opts?: { maxTurnos?: number; maxCharsPorMsg?: number }
): string {
  const maxTurnos = opts?.maxTurnos ?? 24;
  const maxChars = opts?.maxCharsPorMsg ?? 900;
  const linhas = historico
    .filter((m) => m.conteudo?.trim())
    .slice(-maxTurnos)
    .map((m) => {
      const papel = m.papel === "user" ? "Gestor" : "Assistente";
      const texto = m.conteudo.trim();
      const cortado = texto.length > maxChars ? `${texto.slice(0, maxChars)}…` : texto;
      return `${papel}: ${cortado}`;
    });

  if (!linhas.length) return "";

  return `═══ HISTÓRICO DESTA CONVERSA (${linhas.length} mensagem(ns) — use para resumos e continuidade) ═══
${linhas.join("\n\n")}`;
}

/** Linha curta para memória curada entre sessões (sem LLM). */
export function resumoTurnoParaMemoria(
  mensagemUsuario: string,
  respostaIA: string
): string {
  const u = mensagemUsuario.replace(/\s+/g, " ").trim().slice(0, 100);
  const a = respostaIA.replace(/\s+/g, " ").trim().slice(0, 100);
  if (!u && !a) return "";
  return `${u || "…"} → ${a || "…"}`;
}
