import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  extrairTextoDocumentoRag,
  indexarDocumentoRag,
  ragObjectPath,
  RAG_BUCKET,
  reindexarDocumentoRagFromStorage,
} from "@/lib/hub/rag";

const MAX_RAG_DOCUMENTOS_POR_AGENTE = 3;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function carregarAgente(supabase: ReturnType<typeof db>, slug: string) {
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Agente não encontrado.", status: 404 };
  return { data: data as { agente_slug: string; tenant_id?: string | null } };
}

function isRagMigrationMissing(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("hub_agente_rag_documentos") ||
    m.includes("hub_agente_rag_chunks") ||
    m.includes("match_hub_agente_rag_chunks") ||
    (m.includes("schema cache") && m.includes("rag"))
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  const agente = await carregarAgente(supabase, slug);
  if ("error" in agente) {
    return NextResponse.json({ error: agente.error }, { status: agente.status ?? 500 });
  }

  const { data, error } = await supabase
    .from("hub_agente_rag_documentos")
    .select("id, nome_arquivo, mime_type, tamanho_bytes, status, chunks_count, erro, criado_em, indexado_em")
    .eq("agente_slug", slug)
    .order("criado_em", { ascending: false });

  if (error) {
    if (isRagMigrationMissing(error.message)) {
      return NextResponse.json({ documentos: [], aviso: "Migração RAG ainda não aplicada." });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documentos: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  const agente = await carregarAgente(supabase, slug);
  if ("error" in agente) {
    return NextResponse.json({ error: agente.error }, { status: agente.status ?? 500 });
  }

  const { count, error: countErr } = await supabase
    .from("hub_agente_rag_documentos")
    .select("id", { count: "exact", head: true })
    .eq("agente_slug", slug);

  if (countErr) {
    if (isRagMigrationMissing(countErr.message)) {
      return NextResponse.json({ error: "Migração RAG ainda não aplicada no Supabase." }, { status: 503 });
    }
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  if ((count ?? 0) >= MAX_RAG_DOCUMENTOS_POR_AGENTE) {
    return NextResponse.json(
      { error: `Limite de ${MAX_RAG_DOCUMENTOS_POR_AGENTE} documentos por agente atingido. Remova um documento antes de enviar outro.` },
      { status: 409 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo no campo file." }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo maior que 5 MB." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const objectPath = ragObjectPath(agente.data.tenant_id, slug, file.name);
  const mimeType = file.type || "application/octet-stream";

  const { error: uploadErr } = await supabase.storage.from(RAG_BUCKET).upload(objectPath, bytes, {
    contentType: mimeType,
    upsert: false,
  });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: doc, error: docErr } = await supabase
    .from("hub_agente_rag_documentos")
    .insert({
      tenant_id: agente.data.tenant_id ?? null,
      agente_slug: slug,
      bucket_id: RAG_BUCKET,
      object_path: objectPath,
      nome_arquivo: file.name,
      mime_type: mimeType,
      tamanho_bytes: file.size,
      status: "indexando",
      metadata: { origem: "wizard_materiais" },
    })
    .select("id, nome_arquivo, mime_type, tamanho_bytes, status, chunks_count, erro, criado_em, indexado_em")
    .single();

  if (docErr) {
    if (isRagMigrationMissing(docErr.message)) {
      return NextResponse.json({ error: "Migração RAG ainda não aplicada no Supabase." }, { status: 503 });
    }
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }

  const texto = extrairTextoDocumentoRag(file.name, mimeType, bytes);
  if (!texto.ok) {
    await supabase
      .from("hub_agente_rag_documentos")
      .update({ status: "erro", erro: texto.error, indexado_em: new Date().toISOString() })
      .eq("id", doc.id);
    return NextResponse.json({ documento: { ...doc, status: "erro", erro: texto.error }, error: texto.error }, { status: 422 });
  }

  const indexed = await indexarDocumentoRag({
    supabase,
    documentoId: doc.id,
    agenteSlug: slug,
    tenantId: agente.data.tenant_id,
    texto: texto.texto,
  });

  if (!indexed.ok) {
    return NextResponse.json({ documento: { ...doc, status: "erro", erro: indexed.error }, error: indexed.error }, { status: 502 });
  }

  return NextResponse.json({
    documento: {
      ...doc,
      status: "pronto",
      chunks_count: indexed.chunks,
      erro: null,
      indexado_em: new Date().toISOString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Informe o id do documento." }, { status: 400 });
  }

  const supabase = db();
  const agente = await carregarAgente(supabase, slug);
  if ("error" in agente) {
    return NextResponse.json({ error: agente.error }, { status: agente.status ?? 500 });
  }

  const { data: doc, error: docErr } = await supabase
    .from("hub_agente_rag_documentos")
    .select("id, agente_slug, tenant_id, bucket_id, object_path, nome_arquivo, mime_type, status")
    .eq("id", id)
    .eq("agente_slug", slug)
    .maybeSingle();

  if (docErr) {
    if (isRagMigrationMissing(docErr.message)) {
      return NextResponse.json({ error: "Migração RAG ainda não aplicada no Supabase." }, { status: 503 });
    }
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const indexed = await reindexarDocumentoRagFromStorage({
    supabase,
    documento: doc as {
      id: string;
      agente_slug: string;
      tenant_id?: string | null;
      bucket_id: string;
      object_path: string;
      nome_arquivo: string;
      mime_type?: string | null;
    },
  });

  if (!indexed.ok) {
    return NextResponse.json({ error: indexed.error }, { status: 422 });
  }

  return NextResponse.json({
    documento: {
      id: doc.id,
      status: "pronto",
      chunks_count: indexed.chunks,
      erro: null,
      indexado_em: new Date().toISOString(),
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Informe o id do documento." }, { status: 400 });
  }

  const supabase = db();
  const agente = await carregarAgente(supabase, slug);
  if ("error" in agente) {
    return NextResponse.json({ error: agente.error }, { status: agente.status ?? 500 });
  }

  const { data: doc, error: docErr } = await supabase
    .from("hub_agente_rag_documentos")
    .select("id, bucket_id, object_path")
    .eq("id", id)
    .eq("agente_slug", slug)
    .maybeSingle();

  if (docErr) {
    if (isRagMigrationMissing(docErr.message)) {
      return NextResponse.json({ error: "Migração RAG ainda não aplicada no Supabase." }, { status: 503 });
    }
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const bucket = typeof doc.bucket_id === "string" ? doc.bucket_id : RAG_BUCKET;
  const path = typeof doc.object_path === "string" ? doc.object_path : "";
  if (path) {
    const { error: storageErr } = await supabase.storage.from(bucket).remove([path]);
    if (storageErr) {
      console.warn("[rag] falha ao remover objeto do Storage:", storageErr.message);
    }
  }

  const { error: delErr } = await supabase
    .from("hub_agente_rag_documentos")
    .delete()
    .eq("id", id)
    .eq("agente_slug", slug);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
