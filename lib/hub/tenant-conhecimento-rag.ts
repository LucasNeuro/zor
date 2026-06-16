import type { SupabaseClient } from "@supabase/supabase-js";
import { mistralChatCompletion } from "@/lib/ia/mistral-chat";
import { extrairTextoParaConhecimentoTenant } from "@/lib/hub/conhecimento-extracao";
import {
  chunkTextRag,
  gerarEmbeddingsRag,
  RAG_EMBEDDING_DIMENSIONS,
} from "@/lib/hub/rag";

export const TENANT_CONHECIMENTO_BUCKET = "hub-tenant-conhecimento";
export const MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT = 20;
const TEXTO_EXTRAIDO_MAX_CHARS = 48_000;
const RESUMO_TEXTO_MAX_CHARS = 14_000;

export type TenantConhecimentoDocumento = {
  id: string;
  tenant_id: string;
  nome_arquivo: string;
  titulo: string | null;
  mime_type: string | null;
  tamanho_bytes: number;
  status: "indexando" | "pronto" | "erro";
  chunks_count: number;
  erro: string | null;
  texto_extraido: string | null;
  resumo_ia: Record<string, unknown> | null;
  criado_em: string;
  indexado_em: string | null;
};

export type TenantConhecimentoTrecho = {
  titulo: string;
  nomeArquivo: string;
  conteudo: string;
  similarity: number;
};

function safeSegment(s: string, fallback: string): string {
  const cleaned = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return cleaned || fallback;
}

/** Path no bucket: `{slug-empresa}/{timestamp}-{nome-arquivo}` */
export function tenantConhecimentoObjectPath(tenantSlug: string, fileName: string): string {
  const empresa = safeSegment(tenantSlug, "empresa");
  const name = safeSegment(fileName, "documento.txt");
  return `${empresa}/${Date.now()}-${name}`;
}

export async function removerArquivoConhecimentoStorage(
  supabase: SupabaseClient,
  bucket: string,
  objectPath: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const path = objectPath.trim();
  if (!path) return { ok: true };
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    return { ok: false, error: error.message || "Não foi possível remover o ficheiro no Storage." };
  }
  return { ok: true };
}

export function isTenantConhecimentoMigrationMissing(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("hub_tenant_conhecimento_documento") ||
    m.includes("hub_tenant_conhecimento_chunk") ||
    m.includes("match_hub_tenant_conhecimento_chunks") ||
    (m.includes("schema cache") && m.includes("conhecimento"))
  );
}

function sanitizarChunksParaEmbedding(chunks: string[]): string[] {
  return chunks
    .map((c) =>
      c
        .replace(/\u0000/g, "")
        .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{4,}/g, "\n\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim()
    )
    .filter((c) => c.length >= 20 && /[a-zA-Z0-9\u00C0-\u024F]{4,}/.test(c));
}

async function marcarDocumentoErro(supabase: SupabaseClient, documentoId: string, erro: string) {
  await supabase
    .from("hub_tenant_conhecimento_documento")
    .update({ status: "erro", erro: erro.slice(0, 500), indexado_em: new Date().toISOString() })
    .eq("id", documentoId);
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

export async function gerarResumoIaDocumentoTenant(texto: string): Promise<Record<string, unknown> | null> {
  const snippet = texto.trim().slice(0, RESUMO_TEXTO_MAX_CHARS);
  if (snippet.length < 80) return null;

  const model =
    process.env.HUB_CONHECIMENTO_RESUMO_MISTRAL_MODEL?.trim() ||
    process.env.MISTRAL_MODEL?.trim() ||
    "mistral-small-latest";

  const chat = await mistralChatCompletion({
    model,
    system: `Analisa documentos internos de UMA empresa real no ecossistema Waje.
O objectivo é identificar o NEGÓCIO CONCRETO da empresa — não o tema jurídico/formal do documento.

Regras críticas:
- POP, protocolo, política de garantia, termo CDC, SOP descrevem COMO a empresa opera — não transformes isso em "empresa de conformidade" ou "consultoria regulatória".
- Procura substantivos concretos do negócio: construção civil, clínica, restaurante, consultoria, loja, escola, escritório contábil, software, etc.
- Não assumas um sector específico sem evidência explícita no texto.
- Inferir modelo_negocio (B2C/B2B/misto) a partir do público e da operação descrita — não por linguagem jurídica sozinha.
- Não generalizes para "multi-setor" ou "ambientes regulados" só por linguagem legal.

Devolve APENAS um objeto JSON válido (sem Markdown) com chaves:
"empresa" (string, o que a empresa FAZ no dia a dia),
"tipo_documento" (string, ex.: "termo de garantia", "POP recepção"),
"nicho" (string, nicho específico inferido, ex.: "clínica odontológica", "restaurante", "consultoria em RH"),
"modelo_negocio" ("B2C" | "B2B" | "misto" | ""),
"segmentos" (array de strings),
"produtos_servicos" (array de strings),
"publico_alvo" (string),
"tom_voz" (string),
"pontos_chave" (array de até 8 strings).
Se não souberes um campo, usa string vazia ou array vazio — não inventes marcas ou números.`,
    messages: [
      {
        role: "user",
        content: `## Trecho do documento\n${snippet}\n\n## Saída\nObjeto JSON com as chaves pedidas.`,
      },
    ],
    maxTokens: 900,
    temperature: 0.15,
  });

  if (!chat.ok) {
    console.warn("[tenant-conhecimento] resumo IA falhou:", chat.error);
    return null;
  }

  return extrairJsonObjeto(chat.text);
}

export async function indexarDocumentoTenantConhecimento(params: {
  supabase: SupabaseClient;
  documentoId: string;
  tenantId: string;
  texto: string;
  gerarResumo?: boolean;
  resumoIaPrecomputado?: Record<string, unknown> | null;
  metadataExtracao?: Record<string, unknown>;
}): Promise<{ ok: true; chunks: number; resumo_ia: Record<string, unknown> | null } | { ok: false; error: string }> {
  const chunksBrutos = chunkTextRag(params.texto);
  const chunks = sanitizarChunksParaEmbedding(chunksBrutos);
  if (chunks.length === 0) {
    const error = "Documento sem trechos úteis para indexar.";
    await marcarDocumentoErro(params.supabase, params.documentoId, error);
    return { ok: false, error };
  }

  const embed = await gerarEmbeddingsRag(chunks);
  if (!embed.ok) {
    await marcarDocumentoErro(params.supabase, params.documentoId, embed.error);
    return embed;
  }

  if (embed.embeddings.some((v) => v.length !== RAG_EMBEDDING_DIMENSIONS)) {
    const error = "Embedding com dimensão inválida.";
    await marcarDocumentoErro(params.supabase, params.documentoId, error);
    return { ok: false, error };
  }

  await params.supabase.from("hub_tenant_conhecimento_chunk").delete().eq("document_id", params.documentoId);

  const rows = chunks.map((conteudo, i) => ({
    document_id: params.documentoId,
    tenant_id: params.tenantId,
    chunk_index: i,
    conteudo,
    embedding: embed.embeddings[i],
    metadata: { source: "tenant_conhecimento" },
  }));

  const { error: insertErr } = await params.supabase.from("hub_tenant_conhecimento_chunk").insert(rows);
  if (insertErr) {
    await marcarDocumentoErro(params.supabase, params.documentoId, insertErr.message);
    return { ok: false, error: insertErr.message };
  }

  let resumo_ia: Record<string, unknown> | null = null;
  if (params.resumoIaPrecomputado && typeof params.resumoIaPrecomputado === "object") {
    resumo_ia = params.resumoIaPrecomputado;
  } else if (params.gerarResumo !== false) {
    resumo_ia = await gerarResumoIaDocumentoTenant(params.texto);
  }
  const texto_extraido = params.texto.slice(0, TEXTO_EXTRAIDO_MAX_CHARS);

  let metadataPatch: Record<string, unknown> = {};
  if (params.metadataExtracao && Object.keys(params.metadataExtracao).length > 0) {
    const { data: rowMeta } = await params.supabase
      .from("hub_tenant_conhecimento_documento")
      .select("metadata")
      .eq("id", params.documentoId)
      .maybeSingle();
    const prev =
      rowMeta?.metadata && typeof rowMeta.metadata === "object"
        ? (rowMeta.metadata as Record<string, unknown>)
        : {};
    metadataPatch = { ...prev, ...params.metadataExtracao };
  }

  const { error: docErr } = await params.supabase
    .from("hub_tenant_conhecimento_documento")
    .update({
      status: "pronto",
      chunks_count: chunks.length,
      erro: null,
      texto_extraido,
      resumo_ia,
      indexado_em: new Date().toISOString(),
      ...(Object.keys(metadataPatch).length > 0 ? { metadata: metadataPatch } : {}),
    })
    .eq("id", params.documentoId);

  if (docErr) return { ok: false, error: docErr.message };
  return { ok: true, chunks: chunks.length, resumo_ia };
}

export async function reindexarDocumentoTenantConhecimentoFromStorage(params: {
  supabase: SupabaseClient;
  documento: {
    id: string;
    tenant_id: string;
    bucket_id: string;
    object_path: string;
    nome_arquivo: string;
    mime_type?: string | null;
  };
}): Promise<{ ok: true; chunks: number } | { ok: false; error: string }> {
  const bucket = params.documento.bucket_id || TENANT_CONHECIMENTO_BUCKET;
  const { data: blob, error: dlErr } = await params.supabase.storage
    .from(bucket)
    .download(params.documento.object_path);

  if (dlErr || !blob) {
    const error = dlErr?.message || "Não foi possível ler o ficheiro no Storage.";
    await marcarDocumentoErro(params.supabase, params.documento.id, error);
    return { ok: false, error };
  }

  const bytes = Buffer.from(await blob.arrayBuffer());
  const extracao = await extrairTextoParaConhecimentoTenant(
    params.documento.nome_arquivo,
    params.documento.mime_type,
    bytes
  );

  if (!extracao.ok) {
    await marcarDocumentoErro(params.supabase, params.documento.id, extracao.error);
    return { ok: false, error: extracao.error };
  }

  await params.supabase
    .from("hub_tenant_conhecimento_documento")
    .update({ status: "indexando", erro: null, chunks_count: 0 })
    .eq("id", params.documento.id);

  const indexed = await indexarDocumentoTenantConhecimento({
    supabase: params.supabase,
    documentoId: params.documento.id,
    tenantId: params.documento.tenant_id,
    texto: extracao.texto,
    resumoIaPrecomputado: extracao.resumo_ia,
    metadataExtracao: extracao.metadata,
  });

  if (!indexed.ok) return indexed;
  return { ok: true, chunks: indexed.chunks };
}

export async function buscarTrechosConhecimentoTenant(
  supabase: SupabaseClient,
  tenantId: string,
  pergunta: string,
  opts?: { limit?: number; threshold?: number }
): Promise<TenantConhecimentoTrecho[]> {
  const texto = pergunta.trim();
  if (texto.length < 8) return [];

  const { data: docPronto, error: docErr } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "pronto")
    .limit(1);

  if (docErr) {
    if (!isTenantConhecimentoMigrationMissing(docErr.message)) {
      console.warn("[tenant-conhecimento] verificação docs prontos falhou:", docErr.message);
    }
    return [];
  }
  if (!Array.isArray(docPronto) || docPronto.length === 0) return [];

  const embed = await gerarEmbeddingsRag([texto]);
  if (!embed.ok) {
    console.warn("[tenant-conhecimento] embedding pergunta falhou:", embed.error);
    return [];
  }

  const vectorLiteral = `[${embed.embeddings[0].join(",")}]`;
  const { data, error } = await supabase.rpc("match_hub_tenant_conhecimento_chunks", {
    p_tenant_id: tenantId,
    p_query_embedding: vectorLiteral,
    p_match_count: opts?.limit ?? 5,
    p_similarity_threshold: opts?.threshold ?? 0.65,
  });

  if (error) {
    if (!isTenantConhecimentoMigrationMissing(error.message)) {
      console.warn("[tenant-conhecimento] match falhou:", error.message);
    }
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    titulo: String(row.titulo ?? row.nome_arquivo ?? "documento"),
    nomeArquivo: String(row.nome_arquivo ?? "documento"),
    conteudo: String(row.conteudo ?? ""),
    similarity: Number(row.similarity ?? 0),
  }));
}

export function formatarTrechosConhecimentoParaPrompt(trechos: TenantConhecimentoTrecho[]): string {
  if (!trechos.length) return "";
  return trechos
    .map(
      (t, i) =>
        `### Trecho ${i + 1} — ${t.titulo} (relevância ${(t.similarity * 100).toFixed(0)}%)\n${t.conteudo.slice(0, 1200)}`
    )
    .join("\n\n");
}

export type TenantConhecimentoAnaliseNegocio = {
  sintese: string;
  nicho: string;
  modelo_negocio: string;
  perfil_empresa: string;
  segmentos: string[];
  produtos_servicos: string[];
  publico_alvo: string;
  tom_voz: string;
  proposta_valor: string;
  diferenciais: string[];
  oportunidades_ia: string[];
  lacunas_conhecimento: string[];
  recomendacoes: string[];
  confianca: "baixa" | "media" | "alta";
};

export type TenantConhecimentoAnaliseCache = {
  gerado_em: string;
  documentos_usados: number;
  ultimo_indexado_em: string | null;
  documentos_ids_hash?: string;
  analise: TenantConhecimentoAnaliseNegocio;
};

const SETTINGS_ANALISE_KEY = "conhecimento_analise";

function arrStr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : [];
}

function strField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function confiancaField(v: unknown): TenantConhecimentoAnaliseNegocio["confianca"] {
  const c = typeof v === "string" ? v.trim().toLowerCase() : "";
  if (c === "alta" || c === "media" || c === "baixa") return c;
  return "media";
}

export function parseAnaliseNegocioFromJson(raw: Record<string, unknown> | null): TenantConhecimentoAnaliseNegocio | null {
  if (!raw || typeof raw !== "object") return null;
  const sintese = strField(raw.sintese);
  const perfil = strField(raw.perfil_empresa);
  if (!sintese && !perfil) return null;
  return {
    sintese,
    nicho: strField(raw.nicho),
    modelo_negocio: strField(raw.modelo_negocio),
    perfil_empresa: perfil,
    segmentos: arrStr(raw.segmentos),
    produtos_servicos: arrStr(raw.produtos_servicos),
    publico_alvo: strField(raw.publico_alvo),
    tom_voz: strField(raw.tom_voz),
    proposta_valor: strField(raw.proposta_valor),
    diferenciais: arrStr(raw.diferenciais),
    oportunidades_ia: arrStr(raw.oportunidades_ia),
    lacunas_conhecimento: arrStr(raw.lacunas_conhecimento),
    recomendacoes: arrStr(raw.recomendacoes),
    confianca: confiancaField(raw.confianca),
  };
}

export function parseAnaliseCacheFromSettings(settings: unknown): TenantConhecimentoAnaliseCache | null {
  if (!settings || typeof settings !== "object") return null;
  const block = (settings as Record<string, unknown>)[SETTINGS_ANALISE_KEY];
  if (!block || typeof block !== "object") return null;
  const b = block as Record<string, unknown>;
  const analise = parseAnaliseNegocioFromJson(
    b.analise && typeof b.analise === "object" ? (b.analise as Record<string, unknown>) : null
  );
  if (!analise) return null;
  return {
    gerado_em: strField(b.gerado_em) || new Date(0).toISOString(),
    documentos_usados: Number.isFinite(Number(b.documentos_usados)) ? Number(b.documentos_usados) : 0,
    ultimo_indexado_em: strField(b.ultimo_indexado_em) || null,
    documentos_ids_hash: strField(b.documentos_ids_hash) || undefined,
    analise,
  };
}

function hashDocumentoIds(ids: string[]): string {
  return [...ids].sort().join("|");
}

export function analiseNegocioEstaDesatualizada(
  cache: TenantConhecimentoAnaliseCache | null,
  docsProntos: Array<{ id?: string; indexado_em?: string | null }>
): boolean {
  if (!cache) return true;
  if (docsProntos.length === 0) return true;
  if (cache.documentos_usados !== docsProntos.length) return true;

  const ids = docsProntos.map((d) => d.id).filter((id): id is string => Boolean(id?.trim()));
  if (ids.length > 0) {
    const hashAtual = hashDocumentoIds(ids);
    if (cache.documentos_ids_hash && cache.documentos_ids_hash !== hashAtual) return true;
    if (!cache.documentos_ids_hash && ids.length !== cache.documentos_usados) return true;
  }

  const ultimo = docsProntos
    .map((d) => d.indexado_em)
    .filter((v): v is string => Boolean(v?.trim()))
    .sort()
    .at(-1);
  if (!ultimo) return false;
  if (!cache.ultimo_indexado_em) return true;
  return new Date(ultimo).getTime() > new Date(cache.ultimo_indexado_em).getTime();
}

export async function lerAnaliseNegocioTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantConhecimentoAnaliseCache | null> {
  const { data, error } = await supabase.from("hub_tenants").select("settings").eq("id", tenantId).maybeSingle();
  if (error || !data) return null;
  return parseAnaliseCacheFromSettings(data.settings);
}

export async function salvarAnaliseNegocioTenant(
  supabase: SupabaseClient,
  tenantId: string,
  cache: TenantConhecimentoAnaliseCache
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error: readErr } = await supabase
    .from("hub_tenants")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };

  const prev =
    row?.settings && typeof row.settings === "object" ? (row.settings as Record<string, unknown>) : {};
  const settings = { ...prev, [SETTINGS_ANALISE_KEY]: cache };

  const { error: writeErr } = await supabase.from("hub_tenants").update({ settings }).eq("id", tenantId);
  if (writeErr) return { ok: false, error: writeErr.message };
  return { ok: true };
}

export async function limparAnaliseNegocioTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error: readErr } = await supabase
    .from("hub_tenants")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle();

  if (readErr) return { ok: false, error: readErr.message };

  const prev =
    row?.settings && typeof row.settings === "object" ? (row.settings as Record<string, unknown>) : {};
  if (!(SETTINGS_ANALISE_KEY in prev)) return { ok: true };

  const { [SETTINGS_ANALISE_KEY]: _removed, ...rest } = prev;
  const { error: writeErr } = await supabase.from("hub_tenants").update({ settings: rest }).eq("id", tenantId);
  if (writeErr) return { ok: false, error: writeErr.message };
  return { ok: true };
}

function extrairConsultasRagDeDocumentos(
  docs: Array<{
    resumo_ia?: Record<string, unknown> | null;
    texto_extraido?: string | null;
    titulo?: string | null;
    nome_arquivo?: string | null;
  }>
): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();

  const add = (q: string) => {
    const t = q.trim().replace(/\s+/g, " ");
    if (t.length < 12) return;
    const key = t.slice(0, 80).toLowerCase();
    if (vistos.has(key)) return;
    vistos.add(key);
    out.push(t.slice(0, 500));
  };

  for (const d of docs) {
    const r = d.resumo_ia;
    if (r && typeof r === "object") {
      add(strField(r.nicho));
      add(strField(r.empresa));
      const ps = arrStr(r.produtos_servicos);
      if (ps.length) add(ps.slice(0, 6).join(" "));
      const seg = arrStr(r.segmentos);
      if (seg.length) add(seg.slice(0, 4).join(" "));
      add(strField(r.publico_alvo));
    }
    const titulo = (d.titulo?.trim() || d.nome_arquivo || "").trim();
    if (titulo.length >= 4) add(titulo);
    const inicio = typeof d.texto_extraido === "string" ? d.texto_extraido.trim() : "";
    if (inicio.length >= 80) add(inicio.slice(0, 450));
  }

  return out;
}

export async function buscarTrechosDiretosConhecimentoTenant(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 8
): Promise<TenantConhecimentoTrecho[]> {
  const { data: docs, error: docErr } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id, titulo, nome_arquivo")
    .eq("tenant_id", tenantId)
    .eq("status", "pronto")
    .order("indexado_em", { ascending: false })
    .limit(Math.max(limit, 5));

  if (docErr || !docs?.length) return [];

  const docMap = new Map(
    docs.map((d) => [
      d.id,
      {
        titulo: (d.titulo?.trim() || d.nome_arquivo || "documento") as string,
        nomeArquivo: (d.nome_arquivo || "documento") as string,
      },
    ])
  );

  const out: TenantConhecimentoTrecho[] = [];
  const vistos = new Set<string>();

  for (const docId of docs.map((d) => d.id)) {
    const { data: chunks } = await supabase
      .from("hub_tenant_conhecimento_chunk")
      .select("conteudo, chunk_index")
      .eq("tenant_id", tenantId)
      .eq("document_id", docId)
      .order("chunk_index", { ascending: true })
      .limit(2);

    if (!chunks?.length) continue;
    const meta = docMap.get(docId);
    for (const ch of chunks) {
      const conteudo = String(ch.conteudo ?? "").trim();
      if (conteudo.length < 40) continue;
      const key = conteudo.slice(0, 120);
      if (vistos.has(key)) continue;
      vistos.add(key);
      out.push({
        titulo: meta?.titulo ?? "documento",
        nomeArquivo: meta?.nomeArquivo ?? "documento",
        conteudo,
        similarity: 0.5,
      });
      if (out.length >= limit) return out;
    }
  }

  return out;
}

export async function buscarTrechosAnaliseNegocio(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantConhecimentoTrecho[]> {
  const { data: docs } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id, titulo, nome_arquivo, resumo_ia, texto_extraido")
    .eq("tenant_id", tenantId)
    .eq("status", "pronto")
    .order("indexado_em", { ascending: false });

  const prontos = docs ?? [];
  if (prontos.length === 0) return [];

  const consultasDinamicas = extrairConsultasRagDeDocumentos(prontos);
  const consultasGenericas = [
    "empresa negócio serviços produtos público-alvo operação",
    "clientes atendimento modelo negócio segmento mercado",
  ];
  const consultas = [...consultasDinamicas, ...consultasGenericas].slice(0, 8);

  const vistos = new Set<string>();
  const out: TenantConhecimentoTrecho[] = [];

  for (const q of consultas) {
    const rows = await buscarTrechosConhecimentoTenant(supabase, tenantId, q, {
      limit: 3,
      threshold: 0.52,
    });
    for (const row of rows) {
      const key = row.conteudo.slice(0, 120);
      if (vistos.has(key)) continue;
      vistos.add(key);
      out.push(row);
      if (out.length >= 10) return out;
    }
  }

  if (out.length < 4) {
    const diretos = await buscarTrechosDiretosConhecimentoTenant(supabase, tenantId, 10 - out.length);
    for (const row of diretos) {
      const key = row.conteudo.slice(0, 120);
      if (vistos.has(key)) continue;
      vistos.add(key);
      out.push(row);
      if (out.length >= 10) return out;
    }
  }

  return out;
}

export function formatarAnaliseNegocioParaPrompt(analise: TenantConhecimentoAnaliseNegocio): string {
  const linhas = [
    analise.nicho ? `Nicho: ${analise.nicho}` : "",
    analise.modelo_negocio ? `Modelo: ${analise.modelo_negocio}` : "",
    analise.perfil_empresa ? `Perfil: ${analise.perfil_empresa}` : "",
    analise.publico_alvo ? `Público: ${analise.publico_alvo}` : "",
    analise.produtos_servicos.length ? `Serviços: ${analise.produtos_servicos.join(", ")}` : "",
    analise.sintese ? `Síntese: ${analise.sintese}` : "",
  ].filter(Boolean);
  return linhas.join("\n");
}

export async function gerarAnaliseNegocioTenantConhecimento(params: {
  supabase: SupabaseClient;
  tenantId: string;
}): Promise<
  | { ok: true; cache: TenantConhecimentoAnaliseCache }
  | { ok: false; error: string; code?: "sem_documentos" }
> {
  const { data: docs, error: docsErr } = await params.supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id, titulo, nome_arquivo, resumo_ia, texto_extraido, indexado_em")
    .eq("tenant_id", params.tenantId)
    .eq("status", "pronto")
    .order("indexado_em", { ascending: false });

  if (docsErr) {
    if (isTenantConhecimentoMigrationMissing(docsErr.message)) {
      return { ok: false, error: "Migração de conhecimento ainda não aplicada." };
    }
    return { ok: false, error: docsErr.message };
  }

  const prontos = docs ?? [];
  if (prontos.length === 0) {
    return { ok: false, error: "Envie e indexe pelo menos um documento antes de gerar a análise.", code: "sem_documentos" };
  }

  const textosBloco = prontos
    .map((d, i) => {
      const titulo = (d.titulo?.trim() || d.nome_arquivo || `Documento ${i + 1}`) as string;
      const inicio = typeof d.texto_extraido === "string" ? d.texto_extraido.trim().slice(0, 3200) : "";
      const resumo =
        d.resumo_ia && typeof d.resumo_ia === "object"
          ? JSON.stringify(d.resumo_ia, null, 0)
          : "";
      return `### ${titulo}
Arquivo: ${d.nome_arquivo}
${inicio ? `Texto extraído (início):\n${inicio}` : "(sem texto extraído)"}
${resumo ? `Resumo IA auxiliar:\n${resumo}` : ""}`;
    })
    .join("\n\n");

  const trechos = await buscarTrechosAnaliseNegocio(params.supabase, params.tenantId);
  const trechosBloco = formatarTrechosConhecimentoParaPrompt(trechos);

  const model =
    process.env.HUB_CONHECIMENTO_ANALISE_MISTRAL_MODEL?.trim() ||
    process.env.HUB_CONHECIMENTO_RESUMO_MISTRAL_MODEL?.trim() ||
    process.env.MISTRAL_MODEL?.trim() ||
    "mistral-small-latest";

  const chat = await mistralChatCompletion({
    model,
    system: `És analista de negócio no ecossistema Waje. Sintetiza o NEGÓCIO REAL de UMA empresa a partir dos documentos internos.

Regras críticas (obrigatórias):
1. Identifica o nicho CONCRETO com base nos documentos (ex.: "construção civil", "clínica odontológica", "restaurante", "consultoria em marketing", "loja de moda") — nunca substitua por "gestão de conformidade", "consultoria regulatória" ou "multi-setor" só porque o documento usa linguagem legal (CDC, garantia, POP, SOP).
2. POPs, termos de garantia e protocolos descrevem processos INTERNOS do negócio — o negócio é quem presta o serviço real (ex.: serve refeições, presta consultoria, constrói imóveis), não quem "gere garantias" como produto principal.
3. Inferir modelo_negocio (B2C/B2B/misto) a partir do público, produtos e operação descritos — não por palavras jurídicas isoladas.
4. Cita implicitamente o tipo de operação nos campos — sem inventar marcas, números ou factos ausentes.
5. Se a evidência for só documentos operacionais (sem site/catálogo), confianca tende a "media" e indica lacunas.

Devolve APENAS um objeto JSON válido (sem Markdown) com estas chaves:
"sintese" (string, 2-4 frases sobre o negócio real),
"nicho" (string, nicho específico),
"modelo_negocio" ("B2C" | "B2B" | "misto"),
"perfil_empresa" (string),
"segmentos" (array de strings),
"produtos_servicos" (array de strings),
"publico_alvo" (string),
"tom_voz" (string),
"proposta_valor" (string),
"diferenciais" (array de até 6 strings),
"oportunidades_ia" (array de até 6 strings — agentes IA para ESTE negócio),
"lacunas_conhecimento" (array de até 5 strings),
"recomendacoes" (array de até 5 strings),
"confianca" ("baixa" | "media" | "alta").`,
    messages: [
      {
        role: "user",
        content: `## Documentos indexados (${prontos.length}) — texto real + resumos
${textosBloco}

${trechosBloco ? `## Trechos semânticos (RAG)\n${trechosBloco}` : "## Nota\nSem trechos RAG adicionais — base a análise no texto extraído e nos resumos IA acima."}

## Tarefa
Descreve o negócio real desta empresa para orientar cargos e agentes IA adequados ao sector (ex.: atendente de restaurante, recepcionista de clínica, SDR de software B2B — conforme a evidência nos documentos).`,
      },
    ],
    maxTokens: 1600,
    temperature: 0.12,
  });

  if (!chat.ok) return { ok: false, error: chat.error };

  const analise = parseAnaliseNegocioFromJson(extrairJsonObjeto(chat.text));
  if (!analise) {
    return { ok: false, error: "A IA não devolveu uma análise estruturada válida." };
  }

  const ultimo_indexado_em = prontos
    .map((d) => d.indexado_em)
    .filter((v): v is string => Boolean(v?.trim()))
    .sort()
    .at(-1) ?? null;

  const cache: TenantConhecimentoAnaliseCache = {
    gerado_em: new Date().toISOString(),
    documentos_usados: prontos.length,
    ultimo_indexado_em,
    documentos_ids_hash: hashDocumentoIds(prontos.map((d) => d.id)),
    analise,
  };

  const saved = await salvarAnaliseNegocioTenant(params.supabase, params.tenantId, cache);
  if (!saved.ok) return saved;

  return { ok: true, cache };
}
