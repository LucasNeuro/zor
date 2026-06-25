import { gerarTextoIa } from "@/lib/hub/gerar-texto-ia";

const SYSTEM = `És um assistente técnico do CRM Obra10+ (automação de agentes e ciclos IA).
Respostas só em português (Brasil), concisas e práticas. Não inventes dados sensíveis.`;

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

  return gerarTextoIa({ user, system: SYSTEM });
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

  const raw = await gerarTextoIa({ user, system: SYSTEM });
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
