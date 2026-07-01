import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarContextoDocumentosEmpresaParaPrompt } from "@/lib/ia/contexto-documentos-prompt";
import { formatarTrechosConhecimentoParaPrompt } from "@/lib/hub/tenant-conhecimento-rag";

/** RAG tenant para harness interno (RFC: dados actuais / conhecimento empresa). */
export async function montarBlocoConhecimentoTenantHarness(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    mensagemUsuario: string;
    historico?: Array<{ papel: string; conteudo: string }>;
  }
): Promise<string> {
  const turnos = (params.historico ?? []).slice(-6).map((m) => ({
    role: m.papel === "user" ? ("user" as const) : ("assistant" as const),
    content: m.conteudo,
  }));

  const trechos = await buscarContextoDocumentosEmpresaParaPrompt(supabase, params.tenantId, {
    mensagemAtual: params.mensagemUsuario,
    turnosConversa: turnos,
  });

  if (!trechos.length) return "";

  const corpo = formatarTrechosConhecimentoParaPrompt(trechos);
  return `═══ CONHECIMENTO DA EMPRESA (RAG tenant — use para explicar produtos/serviços; dados CRM via tools) ═══
${corpo}`;
}
