import { mistralMemoryModelId } from "@/lib/ia/hub-model-defaults";
import { mistralChatCompletion } from "@/lib/ia/mistral-chat";

export type MemoriaExtraidaLlm = {
  chave: string;
  valor: string;
  confianca: number;
};

function parseJsonArray(raw: string): unknown[] | null {
  const t = raw.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : t).trim();
  try {
    const parsed = JSON.parse(body) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { memorias?: unknown }).memorias)) {
      return (parsed as { memorias: unknown[] }).memorias;
    }
    return null;
  } catch {
    const start = body.indexOf("[");
    const end = body.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(body.slice(start, end + 1)) as unknown;
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizarMemorias(arr: unknown[], max = 6): MemoriaExtraidaLlm[] {
  const out: MemoriaExtraidaLlm[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const chave = typeof o.chave === "string" ? o.chave.trim().slice(0, 80) : "";
    const valor = typeof o.valor === "string" ? o.valor.trim().slice(0, 400) : "";
    if (!chave || !valor) continue;
    let conf = 0.7;
    if (typeof o.confianca === "number" && Number.isFinite(o.confianca)) {
      conf = Math.min(1, Math.max(0.3, o.confianca));
    }
    out.push({ chave, valor, confianca: conf });
    if (out.length >= max) break;
  }
  return out;
}

async function completarJsonLlm(system: string, user: string, maxTokens = 512): Promise<string | null> {
  const out = await mistralChatCompletion({
    model: mistralMemoryModelId(),
    system,
    messages: [{ role: "user", content: user }],
    maxTokens,
    temperature: 0.2,
  });
  if (!out.ok) return null;
  return out.text.trim() || null;
}

/** Extrai memórias factuais do lead a partir do último turno. */
export async function extrairMemoriasLeadViaLlm(params: {
  mensagemUsuario: string;
  respostaIA: string;
}): Promise<MemoriaExtraidaLlm[]> {
  const system = `Extrai memórias factuais sobre o CLIENTE/LEAD a partir do turno de conversa.
Responda APENAS JSON array (sem markdown extra): [{"chave":"tipo_snake","valor":"facto curto","confianca":0.0-1.0}]
Chaves úteis: interesse, objecao, preferencia, orcamento, prazo, contato, decisor, produto, localizacao.
Regras: só factos explícitos ou fortemente implícitos; máx. 5 itens; português; sem inventar.`;
  const user = `Mensagem do cliente:\n${params.mensagemUsuario.slice(0, 2000)}\n\nResposta do assistente:\n${params.respostaIA.slice(0, 2000)}`;
  const raw = await completarJsonLlm(system, user, 480);
  if (!raw) return [];
  const arr = parseJsonArray(raw);
  if (!arr) return [];
  return normalizarMemorias(arr, 5);
}

/** Extrai memórias operacionais do agente (tom, fluxo, SLA, padrões). */
export async function extrairMemoriasAgenteViaLlm(params: {
  agenteSlug: string;
  mensagemUsuario: string;
  respostaIA: string;
  origem: string;
}): Promise<MemoriaExtraidaLlm[]> {
  const system = `Extrai aprendizados OPERACIONAIS para o agente "${params.agenteSlug}" (origem: ${params.origem}).
Responda APENAS JSON array: [{"chave":"tipo_snake","valor":"facto curto","confianca":0.0-1.0}]
Chaves úteis: preferencia_operacional, fluxo_recomendado, tom_preferido, sla_operacional, padrao_segmento, problema_recorrente.
Regras: só o que ajude futuras conversas deste agente; máx. 6 itens; português; sem PII desnecessária.`;
  const user = `Turno:\nUtilizador: ${params.mensagemUsuario.slice(0, 1800)}\nAssistente: ${params.respostaIA.slice(0, 1800)}`;
  const raw = await completarJsonLlm(system, user, 420);
  if (!raw) return [];
  const arr = parseJsonArray(raw);
  if (!arr) return [];
  return normalizarMemorias(arr, 6);
}

/** Resume mensagens antigas de uma conversa longa. */
export async function resumirConversaViaLlm(
  linhas: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string | null> {
  if (linhas.length < 8) return null;
  const corpo = linhas
    .map((l) => `${l.role === "user" ? "Cliente" : "Assistente"}: ${l.content}`)
    .join("\n")
    .slice(0, 12_000);

  const system = `Resume a conversa abaixo em português, 5–8 bullet points factuais.
Inclua: motivo do contacto, dados importantes, objeções, decisões, próximos passos combinados.
Não invente. Máx. 900 caracteres. Sem markdown pesado.`;
  const out = await mistralChatCompletion({
    model: mistralMemoryModelId(),
    system,
    messages: [{ role: "user", content: corpo }],
    maxTokens: 400,
    temperature: 0.25,
  });
  if (!out.ok) return null;
  const t = out.text.trim();
  return t.length > 20 ? t.slice(0, 1200) : null;
}
