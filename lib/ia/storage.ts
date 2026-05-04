// ============================================================
// STORAGE — Gerenciamento Universal de Mídia
// Imagens, vídeos, áudios, documentos, criativos e conversas
// ============================================================
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type TipoMidia =
  | "imagem"
  | "video"
  | "audio"
  | "documento"
  | "criativo"
  | "proposta"
  | "contrato"
  | "relatorio";

export type OrigemMidia =
  | "marketing"
  | "comercial"
  | "atendimento"
  | "trafego"
  | "conteudo"
  | "cliente"
  | "ia_gerado";

export interface ArquivoMidia {
  id: string;
  nome: string;
  tipo: TipoMidia;
  origem: OrigemMidia;
  url: string;
  tamanho: number;
  formato: string;
  leadId?: string;
  clienteId?: string;
  agenteSlug?: string;
  campanhaId?: string;
  versao: number;
  aprovado: boolean;
  metadata: Record<string, unknown>;
  criadoEm: string;
}

// ── BUCKETS NO SUPABASE STORAGE ───────────────────────────────
const BUCKETS = {
  imagens: "hub-imagens",
  videos: "hub-videos",
  audios: "hub-audios",
  documentos: "hub-documentos",
  criativos: "hub-criativos",
  conversas: "hub-conversas",
};

// ── FAZER UPLOAD DE ARQUIVO ───────────────────────────────────
export async function uploadArquivo(dados: {
  arquivo: File | Buffer;
  nome: string;
  tipo: TipoMidia;
  origem: OrigemMidia;
  leadId?: string;
  clienteId?: string;
  agenteSlug?: string;
  campanhaId?: string;
  metadata?: Record<string, unknown>;
}): Promise<ArquivoMidia | null> {
  const db = supabase();
  const bucket = selecionarBucket(dados.tipo);
  const caminhoArquivo = gerarCaminho(dados);

  const { error: uploadError } = await db.storage
    .from(bucket)
    .upload(caminhoArquivo, dados.arquivo, { upsert: true });

  if (uploadError) {
    console.error("[STORAGE] Erro no upload:", uploadError);
    return null;
  }

  const { data: urlData } = db.storage.from(bucket).getPublicUrl(caminhoArquivo);

  const { data, error } = await db
    .from("hub_arquivos")
    .insert({
      nome: dados.nome,
      tipo: dados.tipo,
      origem: dados.origem,
      bucket,
      caminho: caminhoArquivo,
      url: urlData.publicUrl,
      tamanho: dados.arquivo instanceof File ? dados.arquivo.size : (dados.arquivo as Buffer).length,
      formato: dados.nome.split(".").pop() || "unknown",
      lead_id: dados.leadId,
      cliente_id: dados.clienteId,
      agente_slug: dados.agenteSlug,
      campanha_id: dados.campanhaId,
      versao: 1,
      aprovado: false,
      metadata: dados.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error("[STORAGE] Erro ao salvar no banco:", error);
    return null;
  }

  return {
    id: data.id,
    nome: data.nome,
    tipo: data.tipo,
    origem: data.origem,
    url: data.url,
    tamanho: data.tamanho,
    formato: data.formato,
    leadId: data.lead_id,
    clienteId: data.cliente_id,
    agenteSlug: data.agente_slug,
    campanhaId: data.campanha_id,
    versao: data.versao,
    aprovado: data.aprovado,
    metadata: data.metadata,
    criadoEm: data.criado_em,
  };
}

// ── SALVAR CONVERSA COMPLETA ──────────────────────────────────
export async function salvarConversa(dados: {
  leadId: string;
  canal: string;
  mensagens: Array<{ role: string; content: string; timestamp: string }>;
  agenteSlug?: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const db = supabase();

  const conteudo = JSON.stringify(dados.mensagens, null, 2);
  const nomeArquivo = `conversa_${dados.leadId}_${Date.now()}.json`;
  const caminho = `${dados.canal}/${dados.leadId}/${nomeArquivo}`;

  const buffer = Buffer.from(conteudo, "utf-8");

  const { error } = await db.storage
    .from(BUCKETS.conversas)
    .upload(caminho, buffer, { contentType: "application/json", upsert: true });

  if (error) {
    console.error("[STORAGE] Erro ao salvar conversa:", error);
    return null;
  }

  const { data: urlData } = db.storage.from(BUCKETS.conversas).getPublicUrl(caminho);

  await db.from("hub_conversas_log").insert({
    lead_id: dados.leadId,
    canal: dados.canal,
    agente_slug: dados.agenteSlug,
    total_mensagens: dados.mensagens.length,
    url_arquivo: urlData.publicUrl,
    metadata: dados.metadata || {},
  });

  return urlData.publicUrl;
}

// ── BUSCAR ARQUIVOS DO LEAD ───────────────────────────────────
export async function buscarArquivosLead(leadId: string): Promise<ArquivoMidia[]> {
  const db = supabase();

  const { data } = await db
    .from("hub_arquivos")
    .select("*")
    .eq("lead_id", leadId)
    .order("criado_em", { ascending: false });

  return data?.map((item: Record<string, unknown>) => ({
    id: item.id as string,
    nome: item.nome as string,
    tipo: item.tipo as TipoMidia,
    origem: item.origem as OrigemMidia,
    url: item.url as string,
    tamanho: item.tamanho as number,
    formato: item.formato as string,
    leadId: item.lead_id as string,
    clienteId: item.cliente_id as string,
    agenteSlug: item.agente_slug as string,
    campanhaId: item.campanha_id as string,
    versao: item.versao as number,
    aprovado: item.aprovado as boolean,
    metadata: item.metadata as Record<string, unknown>,
    criadoEm: item.criado_em as string,
  })) || [];
}

// ── HELPERS ───────────────────────────────────────────────────
function selecionarBucket(tipo: TipoMidia): string {
  if (tipo === "imagem" || tipo === "criativo") return BUCKETS.imagens;
  if (tipo === "video") return BUCKETS.videos;
  if (tipo === "audio") return BUCKETS.audios;
  return BUCKETS.documentos;
}

function gerarCaminho(dados: { tipo: TipoMidia; origem: OrigemMidia; nome: string; leadId?: string; campanhaId?: string }): string {
  const base = `${dados.origem}/${dados.tipo}`;
  if (dados.leadId) return `${base}/leads/${dados.leadId}/${Date.now()}_${dados.nome}`;
  if (dados.campanhaId) return `${base}/campanhas/${dados.campanhaId}/${Date.now()}_${dados.nome}`;
  return `${base}/${Date.now()}_${dados.nome}`;
}
