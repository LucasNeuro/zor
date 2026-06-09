import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  isTenantConhecimentoMigrationMissing,
  removerArquivoConhecimentoStorage,
  TENANT_CONHECIMENTO_BUCKET,
} from "@/lib/hub/tenant-conhecimento-rag";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SELECT_DETAIL =
  "id, tenant_id, nome_arquivo, titulo, mime_type, tamanho_bytes, status, chunks_count, erro, texto_extraido, resumo_ia, metadata, criado_em, indexado_em, bucket_id, object_path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { id } = await params;
  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();

  const { data, error } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select(SELECT_DETAIL)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    if (isTenantConhecimentoMigrationMissing(error.message)) {
      return NextResponse.json({ error: "Migração de conhecimento ainda não aplicada." }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ documento: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { id } = await params;
  const tenantId = await resolveTenantIdFromCaller(request);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.titulo === "string") {
    patch.titulo = body.titulo.trim().slice(0, 200) || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id, titulo, nome_arquivo, status, chunks_count, erro, resumo_ia, criado_em, indexado_em")
    .maybeSingle();

  if (error) {
    if (isTenantConhecimentoMigrationMissing(error.message)) {
      return NextResponse.json({ error: "Migração de conhecimento ainda não aplicada." }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ documento: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { id } = await params;
  const tenantId = await resolveTenantIdFromCaller(request);
  const supabase = db();

  const { data: doc, error: docErr } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id, bucket_id, object_path")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (docErr) {
    if (isTenantConhecimentoMigrationMissing(docErr.message)) {
      return NextResponse.json({ error: "Migração de conhecimento ainda não aplicada." }, { status: 503 });
    }
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const bucket = typeof doc.bucket_id === "string" ? doc.bucket_id : TENANT_CONHECIMENTO_BUCKET;
  const path = typeof doc.object_path === "string" ? doc.object_path : "";
  const storageOut = await removerArquivoConhecimentoStorage(supabase, bucket, path);
  if (!storageOut.ok) {
    return NextResponse.json(
      { error: `Não foi possível remover o ficheiro no Storage: ${storageOut.error}` },
      { status: 502 }
    );
  }

  const { error: delErr } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
