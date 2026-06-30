import { buildUrlArtefatoPublico } from "@/lib/hub/superagente/artefato-public-url";

const MAX_HTML_BYTES = 1_500_000;

export type PublicarArtefatoHtmlMeta = {
  titulo: string;
  agenteSlug: string;
  tenantId: string;
  telefoneGestor?: string | null;
  metadata?: Record<string, unknown>;
};

export async function publicarArtefatoHtml(
  html: string,
  meta: PublicarArtefatoHtmlMeta
): Promise<{ ok: true; url: string; artefato_id: string } | { ok: false; erro: string }> {
  const titulo = meta.titulo?.trim();
  if (!titulo) return { ok: false, erro: "titulo_obrigatorio" };

  const conteudo = html.trim();
  if (!conteudo) return { ok: false, erro: "html_vazio" };
  if (Buffer.byteLength(conteudo, "utf-8") > MAX_HTML_BYTES) {
    return { ok: false, erro: "html_muito_grande" };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return { ok: false, erro: "supabase_nao_configurado" };

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: inserido, error: insertErr } = await db
    .from("hub_superagente_artefatos")
    .insert({
      tenant_id: meta.tenantId,
      agente_slug: meta.agenteSlug,
      titulo: titulo.slice(0, 240),
      url_publica: "pending",
      conteudo_html: conteudo,
      telefone_gestor: meta.telefoneGestor ?? null,
      metadata: meta.metadata ?? {},
    })
    .select("id")
    .single();

  if (insertErr || !inserido?.id) {
    return { ok: false, erro: insertErr?.message || "insert_artefato_falhou" };
  }

  const artefatoId = String(inserido.id);
  const urlPublica = buildUrlArtefatoPublico(artefatoId);

  const { error: updateErr } = await db
    .from("hub_superagente_artefatos")
    .update({ url_publica: urlPublica })
    .eq("id", artefatoId);

  if (updateErr) {
    return { ok: false, erro: updateErr.message || "update_url_artefato_falhou" };
  }

  return { ok: true, url: urlPublica, artefato_id: artefatoId };
}
