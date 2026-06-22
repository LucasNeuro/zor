import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Metadata schema stored in hub_tenant_conhecimento_documento.metadata for conversation signals:
 * {
 *   origem: string;                 // e.g. "whatsapp_webhook", "learn_worker"
 *   pendente_aprovacao: boolean;    // true until ops approves indexing
 *   sinais: Array<{
 *     conteudo: string;
 *     confianca: number;            // 0..1
 *     capturado_em: string;         // ISO timestamp
 *   }>;
 *   agente_slug?: string;
 *   lead_id?: string;
 *   ...extra fields from input.metadata
 * }
 */
export type ConhecimentoSinalMetadata = {
  origem: string;
  pendente_aprovacao: boolean;
  sinais: Array<{ conteudo: string; confianca: number; capturado_em: string }>;
  agente_slug?: string;
  lead_id?: string;
  [key: string]: unknown;
};

export type PersistConhecimentoSinalInput = {
  tenantId: string;
  conteudo: string;
  confianca: number;
  origem: string;
  metadata?: Record<string, unknown>;
};

export type PersistConhecimentoSinalResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

const BUCKET_ID = "hub-tenant-conhecimento";

/**
 * Stub: persists a knowledge signal as a pending document row (no file upload yet).
 * Worker/approval flow can later promote to indexed RAG chunks.
 */
export async function persistConhecimentoSinal(
  supabase: SupabaseClient,
  input: PersistConhecimentoSinalInput
): Promise<PersistConhecimentoSinalResult> {
  const tenantId = input.tenantId.trim();
  const conteudo = input.conteudo.trim();
  if (!tenantId || !conteudo) {
    return { ok: false, error: "tenantId e conteudo são obrigatórios" };
  }

  const confianca = Math.min(1, Math.max(0, input.confianca));
  const leadId =
    typeof input.metadata?.lead_id === "string" ? input.metadata.lead_id.trim() : undefined;
  const agenteSlug =
    typeof input.metadata?.agente_slug === "string"
      ? input.metadata.agente_slug.trim()
      : undefined;

  const capturadoEm = new Date().toISOString();
  const objectPath = `sinais/${tenantId}/${leadId ?? "sem-lead"}/${Date.now()}.json`;

  const metadata: ConhecimentoSinalMetadata = {
    origem: input.origem.trim() || "sinal_conversa",
    pendente_aprovacao: true,
    sinais: [{ conteudo, confianca, capturado_em: capturadoEm }],
    ...(agenteSlug ? { agente_slug: agenteSlug } : {}),
    ...(leadId ? { lead_id: leadId } : {}),
    ...(input.metadata ?? {}),
  };

  const titulo =
    conteudo.length > 80 ? `${conteudo.slice(0, 77)}...` : conteudo;

  const { data, error } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .insert({
      tenant_id: tenantId,
      bucket_id: BUCKET_ID,
      object_path: objectPath,
      nome_arquivo: `sinal-${capturadoEm.slice(0, 10)}.json`,
      titulo,
      mime_type: "application/json",
      tamanho_bytes: Buffer.byteLength(conteudo, "utf8"),
      status: "indexando",
      texto_extraido: conteudo,
      metadata,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? "Falha ao gravar sinal de conhecimento" };
  }

  return { ok: true, documentId: String(data.id) };
}
