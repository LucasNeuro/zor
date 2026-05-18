import Anthropic from "@anthropic-ai/sdk";
import { documentoConceitoPlaybookSecoesParaIa } from "@/lib/hub/documento-conceito-catalogo";
import {
  CONHECIMENTO_SECAO_ORDER,
  type ConhecimentoSecaoId,
} from "./conhecimento-secoes";

/** Re-export para API e validação — mesma ordem que `hub_agente_conhecimento` + playbook. */
export const SECOES_CONHECIMENTO_IDS = CONHECIMENTO_SECAO_ORDER;

export type SecaoConhecimentoId = ConhecimentoSecaoId;

export type CargoContextoSugerir = {
  slug: string;
  titulo: string;
  segmento?: string | null;
  nivel?: string | null;
  especialidade?: string | null;
  descricao_curta?: string | null;
  descricao?: string | null;
};

const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";

const INSTRUCAO_POR_SECAO: Record<SecaoConhecimentoId, string> = {
  fluxo_sdr:
    "POP/núcleo operacional: objetivo (2–4 linhas), escopo em lista, triagem (`| Tipo | Quando |`, 3–6 linhas), dados obrigatórios numerados, critérios encerrar/encaminhar, próximos passos/SLA se couber, escalação humana. Não presumir só vendas/SDR. Sem emojis.",
  empresa:
    "Sobre o negócio: quem somos, missão, diferenciais, valor. Subtítulos `##`, português (Brasil) profissional.",
  servicos:
    "Serviços: oferta, para quem, entregáveis; onde faltar detalhe use `[completar]` alinhado ao cargo. `##` + listas.",
  atendimento:
    "Como atender: primeiro contacto, perguntas, qualificação, escalação, SLA razoável. Markdown.",
  proibicoes:
    "Nunca fazer: lista objetiva (promessas, dados, preços sem validação, etc.), adequada ao risco do cargo.",
  objeccoes:
    "Objeções comuns: 5–8 pares (objeção + resposta curta) no tom do cargo.",
  exemplos:
    "Exemplos: 2–4 diálogos ou mensagens modelo, realistas para segmento e cargo.",
};

function unwrapMarkdownFences(s: string): string {
  const t = s.trim();
  const m = t.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i);
  if (m) return m[1].trim();
  return t;
}

function sanitizarErroApi(raw: string, max = 280): string {
  const t = (raw || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

const SYSTEM_SUGERIR_CONHECIMENTO = `És um redactor técnico/comercial a configurar knowledge base para agentes de IA no ecossistema **Obra10+** (construção, reformas, operações multi-mercado no Brasil). Respeita o cargo indicado: o conteúdo deve servir para montar playbook e prompts — concreto, auditável, sem fantasía.

Segue sempre o **documento conceito** das secções de playbook (não inventes novos cabeçalhos nem IDs de secção):
${documentoConceitoPlaybookSecoesParaIa()}`;

function montarUserPrompt(opts: {
  secao: SecaoConhecimentoId;
  cargo: CargoContextoSugerir;
  nomeAgente: string;
  mercados?: string[];
  textoAtual?: string;
}): string {
  const secaoId = opts.secao;
  const instrucaoSecao = INSTRUCAO_POR_SECAO[secaoId];
  const cargoJson = JSON.stringify(
    {
      slug: opts.cargo.slug,
      titulo: opts.cargo.titulo,
      segmento: opts.cargo.segmento ?? null,
      nivel: opts.cargo.nivel ?? null,
      especialidade: opts.cargo.especialidade ?? null,
      descricao_curta: opts.cargo.descricao_curta ?? null,
      descricao: opts.cargo.descricao ?? null,
    },
    null,
    0
  );
  const mercados =
    opts.mercados && opts.mercados.length > 0 ? opts.mercados.join(", ") : "(não indicado — inferir do segmento/cargo)";
  const atual = (opts.textoAtual || "").trim();
  const refinamento =
    atual.length > 0
      ? `\n\nJá existe texto no campo (rascunho do utilizador). **Melhore e expanda** mantendo ideias certas; integre com o rascunho, não repita blocos vazios.\n---\n${atual}\n---`
      : "";

  return `## Pedido
Nome proposto do agente: **${opts.nomeAgente.trim()}**
Mercados (prefixos): ${mercados}

## Cargo (JSON — base obrigatória para o tom e exemplos)
${cargoJson}

## Tarefa
${instrucaoSecao}
${refinamento}

**Âncora do cargo (obrigatório):** Sempre que fizer sentido, **usa literalmente** do JSON acima os valores de \`titulo\`, \`nivel\`, \`especialidade\` e \`segmento\` (e \`descricao_curta\` / \`descricao\` quando úteis) — nomeia o papel e o contexto; evita texto genérico que poderia servir a qualquer função. O conteúdo final vem desse cargo, não de um molde fixo.

**Regras:** Saída só em português (Brasil). Não invente CNPJ, jurisdição nem preços fixos; use placeholders quando necessário. Não mencione que é IA. Sem preâmbulo nem fecho meta — apenas o conteúdo da secção.`;
}

async function gerarComMistral(user: string): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) return { ok: false, error: "MISTRAL_API_KEY não configurada." };

  const model =
    process.env.AGENTE_WIZARD_CONHECIMENTO_MISTRAL_MODEL?.trim() ||
    process.env.MISTRAL_MODEL?.trim() ||
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
        max_tokens: 2048,
        messages: [
          { role: "system", content: SYSTEM_SUGERIR_CONHECIMENTO },
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
    const cleaned = unwrapMarkdownFences(texto);
    if (!cleaned.trim()) return { ok: false, error: "Mistral devolveu texto vazio." };
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
      max_tokens: 2_048,
      system: SYSTEM_SUGERIR_CONHECIMENTO,
      messages: [{ role: "user", content: user }],
    });
    const block = msg.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return { ok: false, error: "Anthropic (backup): resposta sem texto." };
    }
    const texto = unwrapMarkdownFences(block.text);
    if (!texto.trim()) return { ok: false, error: "Anthropic (backup): texto vazio." };
    return { ok: true, texto };
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : String(e);
    let friendly = sanitizarErroApi(raw);
    if (/credit balance|billing|too low/i.test(raw)) {
      friendly =
        "Anthropic (backup): créditos ou plano insuficientes. Use MISTRAL_API_KEY como provedor principal.";
    }
    return { ok: false, error: friendly };
  }
}

/**
 * Gera texto para uma secção de conhecimento do wizard.
 * **Ordem:** Mistral (MISTRAL_API_KEY) primeiro; Anthropic só como fallback.
 */
export async function gerarConhecimentoSecaoComIa(opts: {
  secao: SecaoConhecimentoId;
  cargo: CargoContextoSugerir;
  nomeAgente: string;
  mercados?: string[];
  textoAtual?: string;
}): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const user = montarUserPrompt(opts);

  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  if (mistralKey) {
    const r = await gerarComMistral(user);
    if (r.ok) return r;
    const fallback = await gerarComAnthropic(user);
    if (fallback.ok) return fallback;
    return {
      ok: false,
      error: `${r.error} Fallback Anthropic: ${fallback.error}`,
    };
  }

  const onlyAnth = await gerarComAnthropic(user);
  if (onlyAnth.ok) return onlyAnth;

  return {
    ok: false,
    error:
      onlyAnth.error +
      " Configure MISTRAL_API_KEY no servidor (provedor principal para este assistente).",
  };
}
