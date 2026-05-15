import Anthropic from "@anthropic-ai/sdk";

const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";

const SYSTEM = `És um assistente técnico do CRM Obra10+ (automação de agentes e ciclos IA).
Respostas só em português (Brasil), concisas e práticas. Não inventes dados sensíveis.`;

function sanitizarErroApi(raw: string, max = 280): string {
  const t = (raw || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

async function gerarComMistral(user: string): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) return { ok: false, error: "MISTRAL_API_KEY não configurada." };

  const model =
    process.env.MISTRAL_MODEL?.trim() ||
    process.env.AGENTE_WIZARD_CONHECIMENTO_MISTRAL_MODEL?.trim() ||
    "mistral-small-latest";

  try {
    const res = await fetch(MISTRAL_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 512,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Mistral: ${sanitizarErroApi(t || `HTTP ${res.status}`)}` };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    let texto = "";
    if (typeof content === "string") texto = content;
    else if (Array.isArray(content)) {
      for (const part of content as unknown[]) {
        if (part && typeof part === "object" && "text" in (part as object)) {
          const t = (part as { text?: string }).text;
          if (typeof t === "string") texto += t;
        }
      }
    }
    const cleaned = texto.trim();
    if (!cleaned) return { ok: false, error: "Mistral devolveu texto vazio." };
    return { ok: true, texto: cleaned };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Mistral: ${sanitizarErroApi(msg)}` };
  }
}

async function gerarComAnthropic(user: string): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return { ok: false, error: "ANTHROPIC_API_KEY não configurada." };

  const modelo =
    process.env.AGENTE_WIZARD_CONHECIMENTO_MODEL?.trim() || "claude-haiku-4-5-20251001";
  const anthropic = new Anthropic({ apiKey: key });

  try {
    const msg = await anthropic.messages.create({
      model: modelo,
      max_tokens: 512,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const block = msg.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return { ok: false, error: "Anthropic: resposta sem texto." };
    }
    const texto = block.text.trim();
    if (!texto) return { ok: false, error: "Anthropic: texto vazio." };
    return { ok: true, texto };
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: sanitizarErroApi(raw) };
  }
}

async function gerarTexto(user: string): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  if (mistralKey) {
    const r = await gerarComMistral(user);
    if (r.ok) return r;
    const fallback = await gerarComAnthropic(user);
    if (fallback.ok) return fallback;
    return { ok: false, error: `${r.error} Fallback: ${fallback.error}` };
  }
  const only = await gerarComAnthropic(user);
  if (only.ok) return only;
  return {
    ok: false,
    error: only.error + " Configure MISTRAL_API_KEY ou ANTHROPIC_API_KEY.",
  };
}

export type SugerirCicloDescricaoInput = {
  nome: string;
  agente_slug: string;
  tipo_ciclo: string;
  cron_resumo?: string;
  texto_atual?: string;
};

/** 2–4 frases: o que o ciclo faz quando corre, para equipe interna. */
export async function sugerirDescricaoCiclo(
  opts: SugerirCicloDescricaoInput
): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const cron =
    (opts.cron_resumo || "").trim() || "(agendamento não indicado — infere pelo tipo)";
  const atual = (opts.texto_atual || "").trim();
  const refin = atual
    ? `\nRascunho atual (melhorar / integrar, sem repetir à letra):\n${atual}\n`
    : "";

  const user = `Gera uma **descrição curta** (2 a 4 frases, parágrafo único ou duas frases no máximo) para um **ciclo de automação IA** no CRM.

- **Nome do ciclo:** ${opts.nome.trim()}
- **Agente (slug):** ${opts.agente_slug.trim()}
- **Tipo:** ${opts.tipo_ciclo} (continuo = repetição por intervalo; programado = cron; gatilho = sob pedido externo)
- **Agendamento / contexto:** ${cron}
${refin}

Regras: texto para humanos (equipa interna). Sem markdown, sem títulos. Sem mencionar "IA" em tom promocional — apenas o que o job faz e quando faz sentido correr.`;

  return gerarTexto(user);
}

export type SugerirFollowupInput = {
  nome: string;
  agente_slug: string;
  descricao?: string;
};

/**
 * Sugere lista de horas (após último contacto) e dias para arquivar, em JSON.
 */
export async function sugerirParametrosFollowup(
  opts: SugerirFollowupInput
): Promise<
  | { ok: true; horas_followup: string; arquivar_apos_dias: number }
  | { ok: false; error: string }
> {
  const desc = (opts.descricao || "").trim() || "(sem descrição)";
  const user = `Para um ciclo de **follow-up WhatsApp** (lembretes ao lead):

- Nome: **${opts.nome.trim()}**
- Agente: **${opts.agente_slug.trim()}**
- Descrição do ciclo: ${desc}

Responde **apenas** um JSON numa linha, sem markdown, com este formato exato:
{"horas":"2, 6, 24, 48","dias_arquivar":7}

Onde:
- "horas" = 3 a 5 números inteiros (horas após última mensagem do lead), crescentes, separados por vírgula e espaço.
- "dias_arquivar" = inteiro entre 3 e 30 (dias sem resposta após o último passo antes de arquivar).

Escolhe valores realistas para SDR/atendimento em construção civil no Brasil.`;

  const raw = await gerarTexto(user);
  if (!raw.ok) return raw;

  try {
    const t = raw.texto.replace(/```json\s*|\s*```/g, "").trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    const jsonStr = start >= 0 && end > start ? t.slice(start, end + 1) : t;
    const json = JSON.parse(jsonStr) as {
      horas?: string;
      dias_arquivar?: number;
    };
    const horas = typeof json.horas === "string" ? json.horas.trim() : "";
    const dias = typeof json.dias_arquivar === "number" ? json.dias_arquivar : NaN;
    if (!horas || !Number.isFinite(dias) || dias < 1) {
      return { ok: false, error: "Modelo devolveu JSON inválido." };
    }
    return { ok: true, horas_followup: horas, arquivar_apos_dias: Math.min(90, Math.max(1, Math.floor(dias))) };
  } catch {
    return { ok: false, error: "Não foi possível interpretar a sugestão (JSON)." };
  }
}
