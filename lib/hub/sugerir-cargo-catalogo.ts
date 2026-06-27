/**
 * Sugestão de linha em `hub_cargos_catalogo` via Mistral, com contexto dos cargos / mercados já existentes no Hub.
 */

import { documentoConceitoTaxonomiaParaIa } from "@/lib/hub/documento-conceito-catalogo";
import { mistral401UserMessage, mistralApiKey } from "@/lib/ia/mistral-health";
import { mistralChatCompletion } from "@/lib/ia/mistral-chat";

export type CargoCatalogoContextRow = {
  slug: string;
  titulo?: string | null;
  segmento?: string | null;
  especialidade?: string | null;
  nivel?: number | string | null;
};

export type MercadoContextRow = { sigla: string; nome?: string | null };

export type SugestaoCargoCatalogo = {
  titulo?: string;
  segmento?: string;
  especialidade?: string;
  descricao_curta?: string;
  area?: string;
  nivel?: number;
  modelo_padrao?: string;
  modelo_critico?: string;
  modelo_alto_valor?: string;
  supervisor_slug?: string | null;
  pode_fazer_padrao?: string[];
  nao_pode_fazer_padrao?: string[];
  prompt_template?: string;
  saudacao_cliente?: string;
  usar_perguntas_essenciais?: boolean;
  ordem_perguntas_essenciais?: "inicio" | "final";
  perguntas_essenciais?: string[];
  comprimento_padrao?: string;
  descricao?: string;
  limite_autonomia_brl?: number;
};

function sanitizarErroApi(raw: string, max = 320): string {
  const t = (raw || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function extrairJsonObjeto(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const inner = fence ? fence[1].trim() : t;
  const start = inner.indexOf("{");
  const end = inner.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(inner.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizarSugestao(o: Record<string, unknown>): SugestaoCargoCatalogo {
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string).trim() : undefined);
  const num = (k: string) => {
    const n = typeof o[k] === "number" ? o[k] : Number(o[k]);
    return Number.isFinite(n) ? (n as number) : undefined;
  };
  const arr = (k: string): string[] | undefined => {
    const v = o[k];
    if (!Array.isArray(v)) return undefined;
    const out = v.map((x) => String(x).trim()).filter(Boolean);
    return out.length ? out : undefined;
  };
  const nivelRaw = num("nivel");
  const nivel =
    nivelRaw != null ? Math.min(5, Math.max(1, Math.round(nivelRaw))) : undefined;

  return {
    titulo: str("titulo"),
    segmento: str("segmento"),
    especialidade: str("especialidade"),
    descricao_curta: str("descricao_curta"),
    area: str("area"),
    nivel,
    modelo_padrao: str("modelo_padrao"),
    modelo_critico: str("modelo_critico"),
    modelo_alto_valor: str("modelo_alto_valor"),
    supervisor_slug: typeof o.supervisor_slug === "string" ? o.supervisor_slug.trim() || null : undefined,
    pode_fazer_padrao: arr("pode_fazer_padrao"),
    nao_pode_fazer_padrao: arr("nao_pode_fazer_padrao"),
    prompt_template: str("prompt_template"),
    saudacao_cliente: str("saudacao_cliente"),
    usar_perguntas_essenciais:
      typeof o.usar_perguntas_essenciais === "boolean" ? o.usar_perguntas_essenciais : undefined,
    ordem_perguntas_essenciais:
      o.ordem_perguntas_essenciais === "final" || o.ordem_perguntas_essenciais === "inicio"
        ? o.ordem_perguntas_essenciais
        : undefined,
    perguntas_essenciais: arr("perguntas_essenciais"),
    comprimento_padrao: str("comprimento_padrao"),
    descricao: str("descricao"),
    limite_autonomia_brl: num("limite_autonomia_brl"),
  };
}

const SYSTEM = `És um arquitecto de agentes de IA no ecossistema **Waje** (plataforma multi-setor, mercado GRL — geral / multi-cliente no Brasil).
Recebes o **título desejado** para um novo cargo no catálogo \`hub_cargos_catalogo\`, mais **contexto JSON** com cargos, mercados e (quando existir) trechos da base de conhecimento da empresa.
Devolves **apenas um objeto JSON válido** (sem Markdown à volta, sem comentários, sem texto antes ou depois) com campos para preencher o catálogo.

Regras:
- Português (Brasil), tom profissional.
- Alinha segmento, especialidade, saudação e prompt ao **negócio real** descrito nos trechos de conhecimento — não assumas construção/reforma salvo que o contexto o indique.
- POP, termo de garantia ou protocolo interno NÃO significam que a empresa é de "compliance" — identifica o serviço prestado (ex.: restaurante, clínica, construção, consultoria, loja).
- \`modelo_padrao\`, \`modelo_critico\`, \`modelo_alto_valor\`: preferir o literal **mistral** salvo que haja motivo forte para outro ID de modelo (o runtime resolve via env).
- \`nivel\`: inteiro de 1 a 5 (5 = maior autonomia relativa no Hub).
- \`limite_autonomia_brl\`: número >= 0 razoável para operações normais do cargo (ex.: 500–50000); não inventes dados financeiros específicos da empresa — usa valor conservador com breve raciocínio implícito no campo descricao se preciso.
- \`supervisor_slug\`: slug de **outro cargo** do catálogo quando fizer sentido (ex.: SDR → gerente_atendimento); senão **null**.
- Listas curtas e acionáveis (máx. **12** itens cada em pode_fazer / nao_pode_fazer).
- \`prompt_template\`: base de system prompt para agentes criados com este cargo (parágrafos claros; pode usar bullets com "-").
- \`saudacao_cliente\`: saudação para canal externo (WhatsApp), curta e natural, sem mencionar cargo/função interna.
- \`usar_perguntas_essenciais\`: booleano (true quando o cargo deve conduzir qualificação por perguntas).
- \`ordem_perguntas_essenciais\`: "inicio" ou "final" (quando perguntar no fluxo).
- \`perguntas_essenciais\`: lista ordenada de perguntas obrigatórias quando \`usar_perguntas_essenciais=true\`.
- \`comprimento_padrao\`: orientação de tamanho da resposta (ex.: "máx. 2 frases por mensagem").
- \`descricao\`: texto longo para documentação interna do papel (responsabilidades, limites).
- Quando houver \`saudacao_cliente\`, nunca incluir termos como "qualificadora", "qualificador", "SDR", "closer", "cargo" ou "função interna".
- Alinha segmento/especialidade ao **padrão já observado** no contexto quando possível — mas **sem violar** o documento conceito abaixo.

${documentoConceitoTaxonomiaParaIa()}`;

export async function sugerirCargoCatalogoComMistral(opts: {
  tituloPedido: string;
  cargosExistentes: CargoCatalogoContextRow[];
  mercados?: MercadoContextRow[];
  conhecimentoEmpresa?: string;
}): Promise<{ ok: true; sugestao: SugestaoCargoCatalogo } | { ok: false; error: string }> {
  if (!mistralApiKey()) return { ok: false, error: "Serviço de IA indisponível." };

  const model =
    process.env.HUB_CARGO_SUGESTAO_MISTRAL_MODEL?.trim() ||
    process.env.MISTRAL_MODEL?.trim() ||
    "mistral-small-latest";

  const titulo = opts.tituloPedido.trim();
  if (!titulo) return { ok: false, error: "Título vazio." };

  const ctx = JSON.stringify(
    {
      cargos_existentes: opts.cargosExistentes.slice(0, 48),
      mercados_hub: opts.mercados?.slice(0, 32) ?? [],
    },
    null,
    0
  );

  const blocoConhecimento = opts.conhecimentoEmpresa?.trim()
    ? `## Base de conhecimento da empresa (trechos relevantes)
${opts.conhecimentoEmpresa.trim()}

`
    : "";

  const user = `## Título pedido para o novo cargo
${titulo}

## Contexto actual do Hub (JSON)
${ctx}

${blocoConhecimento}## Saída obrigatória
Um único objeto JSON com estas chaves (todas opcionais excepto convém preencher bem titulo alinhado ao pedido):
"titulo","segmento","especialidade","descricao_curta","area","nivel","modelo_padrao","modelo_critico","modelo_alto_valor","supervisor_slug","pode_fazer_padrao","nao_pode_fazer_padrao","prompt_template","saudacao_cliente","usar_perguntas_essenciais","ordem_perguntas_essenciais","perguntas_essenciais","comprimento_padrao","descricao","limite_autonomia_brl"`;

  try {
    const chat = await mistralChatCompletion({
      model,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
      maxTokens: 2800,
      temperature: 0.25,
    });

    if (!chat.ok) {
      const err = chat.error;
      if (/HTTP 401|401:/i.test(err) || err.toLowerCase().includes("unauthorized")) {
        return { ok: false, error: mistral401UserMessage() };
      }
      if (/HTTP 402|HTTP 429|402:|429:/i.test(err)) {
        return {
          ok: false,
          error:
            "Limite ou créditos Mistral insuficientes. Verifique Billing em console.mistral.ai → Admin.",
        };
      }
      return { ok: false, error: sanitizarErroApi(err) };
    }

    const obj = extrairJsonObjeto(chat.text);
    if (!obj) {
      return { ok: false, error: "Resposta da IA não continha JSON válido." };
    }

    return { ok: true, sugestao: normalizarSugestao(obj) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: sanitizarErroApi(msg) };
  }
}
