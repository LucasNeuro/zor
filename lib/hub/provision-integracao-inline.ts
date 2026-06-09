import type { SupabaseClient } from "@supabase/supabase-js";
import { integracaoAuthTipoValido } from "@/lib/hub/ferramentas-externas-db";

export type ConexaoInlinePayload = {
  tipo_auth: "none" | "api_key" | "bearer";
  bearer_token?: string | null;
  api_key?: string | null;
  api_key_header?: string | null;
  allowed_hosts?: string[] | null;
};

/** Cria ou actualiza integração webhook_generico + credenciais a partir do formulário da ferramenta externa. */
export async function provisionIntegracaoInline(
  supabase: SupabaseClient,
  tenantId: string,
  opts: {
    nome: string;
    integracaoRowId?: string | null;
    conexao: ConexaoInlinePayload;
  }
): Promise<{ id: string }> {
  const allowed =
    opts.conexao.allowed_hosts?.map((h) => h.trim().toLowerCase()).filter(Boolean) ?? [];
  const config: Record<string, unknown> = allowed.length > 0 ? { allowed_hosts: allowed } : {};

  let integracaoId = opts.integracaoRowId?.trim() || "";

  if (integracaoId) {
    await supabase
      .from("hub_integracoes")
      .update({
        nome: opts.nome,
        config,
        status: "ativo",
        ativo: true,
        atualizado_em: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", integracaoId);
  } else {
    const { data: inserted, error } = await supabase
      .from("hub_integracoes")
      .insert({
        tenant_id: tenantId,
        integracao_id: "webhook_generico",
        nome: opts.nome,
        status: "ativo",
        config,
        ativo: true,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inserted?.id) throw new Error("Falha ao criar integração.");
    integracaoId = String(inserted.id);
  }

  const tipoAuth = opts.conexao.tipo_auth;
  if (tipoAuth !== "none" && integracaoAuthTipoValido(tipoAuth)) {
    const credenciais: Record<string, unknown> = {};
    if (tipoAuth === "bearer" && opts.conexao.bearer_token?.trim()) {
      credenciais.bearer_token = opts.conexao.bearer_token.trim();
    }
    if (tipoAuth === "api_key" && opts.conexao.api_key?.trim()) {
      credenciais.api_key = opts.conexao.api_key.trim();
      if (opts.conexao.api_key_header?.trim()) {
        credenciais.api_key_header = opts.conexao.api_key_header.trim();
      }
    }

    const { data: existing } = await supabase
      .from("hub_integracao_credenciais")
      .select("id")
      .eq("integracao_id", integracaoId)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("hub_integracao_credenciais")
        .update({
          tipo_auth: tipoAuth,
          credenciais,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("hub_integracao_credenciais").insert({
        tenant_id: tenantId,
        integracao_id: integracaoId,
        tipo_auth: tipoAuth,
        credenciais,
      });
    }
  }

  return { id: integracaoId };
}
