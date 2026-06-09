import { mistralChatCompletion } from "@/lib/ia/mistral-chat";
import { mistralDefaultModelId } from "@/lib/ia/hub-model-defaults";
import type { HubFerramentaExternaMetodo, HubFerramentaExternaPolitica } from "@/lib/hub/fetch-hub-ferramentas-externas";
import { metodoHttpValido, ferramentaExternaPoliticaValida } from "@/lib/hub/ferramentas-externas-db";

const MODEL = process.env.HUB_FERRAMENTA_SUGESTAO_MISTRAL_MODEL?.trim() || mistralDefaultModelId();

export type SugestaoFerramentaExterna = {
  titulo: string;
  slug_curto: string;
  descricao_curta: string;
  descricao_modelo: string;
  tipo_auth: "none" | "api_key" | "bearer";
  api_key_header: string;
  metodo_http: HubFerramentaExternaMetodo;
  url_template: string;
  headers_template: Record<string, string>;
  body_template: string;
  parametros_schema: Record<string, unknown>;
  politica: HubFerramentaExternaPolitica;
};

const METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function parseJsonObject(raw: unknown, fallback: Record<string, unknown>): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return fallback;
}

export async function sugerirFerramentaExternaComMistral(params: {
  tituloPedido: string;
  contextoApi?: string;
}): Promise<{ ok: true; sugestao: SugestaoFerramentaExterna } | { ok: false; error: string }> {
  const contexto = params.contextoApi?.trim() || "";

  const system = `És um assistente que propõe ferramentas HTTP externas (hub_ext_*) para agentes IA num CRM português.
Responde APENAS com um único objecto JSON válido (sem markdown), chaves:
titulo (string curta PT),
slug_curto (string só [a-z0-9_]{3,40}, sem prefixo hub_ext_),
descricao_curta (string PT: 1 linha para administradores),
descricao_modelo (string PT: quando o modelo deve invocar — 2–4 frases, critérios claros),
tipo_auth ("none" | "bearer" | "api_key" — inferir do contexto; nunca incluir tokens reais),
api_key_header (string, ex. "X-API-Key"; vazio se tipo_auth não for api_key),
metodo_http (um de: ${METODOS.join(", ")}),
url_template (string URL com placeholders {{nome_param}} alinhados ao schema),
headers_template (objecto JSON string→string; sem credenciais; pode usar {{placeholders}}),
body_template (string JSON ou texto com {{placeholders}}; vazio "" se GET sem corpo),
parametros_schema (objecto JSON Schema para function calling: type object, properties, required, additionalProperties false),
politica ("leitura" para consultas; "escrita" só se altera dados remotos).

Regras:
- URL deve ser plausível (https://…) com host real ou exemplo claro.
- Placeholders em url/body/headers devem existir em parametros_schema.properties.
- Preferir POST para acções; GET para consultas.
- Não inventar segredos; tipo_auth indica só o tipo esperado.`;

  const user = [
    `Pedido do utilizador para nova ferramenta externa HTTP:\n"${params.tituloPedido}"`,
    contexto ? `\nContexto da API / documentação:\n${contexto}` : "",
    "\nGera uma configuração completa pronta para o Hub executar HTTP com substituição de {{placeholders}}.",
  ]
    .filter(Boolean)
    .join("");

  const chat = await mistralChatCompletion({
    model: MODEL,
    system,
    messages: [{ role: "user", content: user }],
    maxTokens: 1400,
    temperature: 0.35,
  });

  if (!chat.ok) return { ok: false, error: chat.error };

  let parsed: unknown;
  try {
    let t = chat.text.trim();
    if (t.startsWith("```")) {
      t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
    }
    parsed = JSON.parse(t);
  } catch {
    return { ok: false, error: "Mistral não devolveu JSON válido." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Formato de sugestão inválido." };
  }

  const o = parsed as Record<string, unknown>;
  const titulo = String(o.titulo || "").trim();
  const slug_curto = String(o.slug_curto || "").trim().toLowerCase();
  const descricao_curta = String(o.descricao_curta || "").trim();
  const descricao_modelo = String(o.descricao_modelo || "").trim();
  const tipoRaw = String(o.tipo_auth || "none").toLowerCase();
  const tipo_auth =
    tipoRaw === "bearer" || tipoRaw === "api_key" || tipoRaw === "none"
      ? (tipoRaw as SugestaoFerramentaExterna["tipo_auth"])
      : "none";
  const api_key_header = String(o.api_key_header || "X-API-Key").trim() || "X-API-Key";
  const metodoRaw = String(o.metodo_http || "POST").trim().toUpperCase();
  const url_template = String(o.url_template || "").trim();
  const body_template = o.body_template != null ? String(o.body_template) : "";
  const politicaRaw = String(o.politica || "leitura").toLowerCase();

  const headers_template: Record<string, string> = {};
  if (o.headers_template && typeof o.headers_template === "object" && !Array.isArray(o.headers_template)) {
    for (const [k, v] of Object.entries(o.headers_template as Record<string, unknown>)) {
      headers_template[k] = String(v);
    }
  }

  const parametros_schema = parseJsonObject(o.parametros_schema, {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  });

  if (!titulo || !slug_curto || !descricao_modelo || !url_template) {
    return { ok: false, error: "Sugestão incompleta (titulo, slug_curto, descricao_modelo, url_template)." };
  }
  if (!metodoHttpValido(metodoRaw)) {
    return { ok: false, error: "metodo_http inválido na sugestão." };
  }
  if (!ferramentaExternaPoliticaValida(politicaRaw)) {
    return { ok: false, error: "politica inválida na sugestão." };
  }

  return {
    ok: true,
    sugestao: {
      titulo,
      slug_curto,
      descricao_curta,
      descricao_modelo,
      tipo_auth,
      api_key_header: tipo_auth === "api_key" ? api_key_header : "X-API-Key",
      metodo_http: metodoRaw,
      url_template,
      headers_template,
      body_template,
      parametros_schema,
      politica: politicaRaw,
    },
  };
}
