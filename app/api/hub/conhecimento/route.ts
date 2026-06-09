import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { extrairTextoDocumentoRag } from "@/lib/hub/rag";
import { extensaoArquivo, ragExtensaoAceita } from "@/lib/hub/rag-formatos";
import {
  indexarDocumentoTenantConhecimento,
  isTenantConhecimentoMigrationMissing,
  MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT,
  removerArquivoConhecimentoStorage,
  TENANT_CONHECIMENTO_BUCKET,
  tenantConhecimentoObjectPath,
} from "@/lib/hub/tenant-conhecimento-rag";
import { resolveTenantContextFromCaller } from "@/lib/crm/resolve-tenant-from-caller";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SELECT_LIST =
  "id, tenant_id, nome_arquivo, titulo, mime_type, tamanho_bytes, status, chunks_count, erro, resumo_ia, criado_em, indexado_em";

function isStorageMimeRejected(message: string): boolean {
  return /mime type/i.test(message) && /not supported/i.test(message);
}

function spreadsheetUploadFallbackExt(nomeArquivo: string): boolean {
  const ext = extensaoArquivo(nomeArquivo);
  return ext === ".xlsx" || ext === ".xls";
}

export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { tenantId } = await resolveTenantContextFromCaller(request);
  const supabase = db();

  const { data, error } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select(SELECT_LIST)
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false });

  if (error) {
    if (isTenantConhecimentoMigrationMissing(error.message)) {
      return NextResponse.json({ documentos: [], aviso: "Migração de conhecimento ainda não aplicada." });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documentos: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { tenantId, tenantSlug } = await resolveTenantContextFromCaller(request);
  const supabase = db();

  const { count, error: countErr } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (countErr) {
    if (isTenantConhecimentoMigrationMissing(countErr.message)) {
      return NextResponse.json({ error: "Migração de conhecimento ainda não aplicada no Supabase." }, { status: 503 });
    }
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  if ((count ?? 0) >= MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT) {
    return NextResponse.json(
      {
        error: `Limite de ${MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT} documentos atingido. Remova um documento antes de enviar outro.`,
      },
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

  if (!ragExtensaoAceita(file.name)) {
    return NextResponse.json({ error: "Formato de arquivo não suportado." }, { status: 415 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo maior que 5 MB." }, { status: 413 });
  }

  const tituloRaw = form.get("titulo");
  const titulo =
    typeof tituloRaw === "string" && tituloRaw.trim() ? tituloRaw.trim().slice(0, 200) : null;

  const bytes = Buffer.from(await file.arrayBuffer());
  const objectPath = tenantConhecimentoObjectPath(tenantSlug, file.name);
  const mimeType = file.type || "application/octet-stream";

  let storageContentType = mimeType;
  let uploadErr = (
    await supabase.storage.from(TENANT_CONHECIMENTO_BUCKET).upload(objectPath, bytes, {
      contentType: storageContentType,
      upsert: false,
    })
  ).error;

  if (uploadErr && isStorageMimeRejected(uploadErr.message ?? "") && spreadsheetUploadFallbackExt(file.name)) {
    storageContentType = "application/octet-stream";
    uploadErr = (
      await supabase.storage.from(TENANT_CONHECIMENTO_BUCKET).upload(objectPath, bytes, {
        contentType: storageContentType,
        upsert: false,
      })
    ).error;
  }

  if (uploadErr) {
    const msg = uploadErr.message || "";
    if (isStorageMimeRejected(msg)) {
      return NextResponse.json(
        {
          error: `${msg} Atualize o bucket no Supabase: execute supabase/scripts/patch_hub_tenant_conhecimento_bucket_mimes.sql`,
        },
        { status: 415 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: doc, error: docErr } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .insert({
      tenant_id: tenantId,
      bucket_id: TENANT_CONHECIMENTO_BUCKET,
      object_path: objectPath,
      nome_arquivo: file.name,
      titulo,
      mime_type: mimeType,
      tamanho_bytes: file.size,
      status: "indexando",
      metadata: { origem: "crm_conhecimento" },
    })
    .select(SELECT_LIST)
    .single();

  if (docErr) {
    await removerArquivoConhecimentoStorage(supabase, TENANT_CONHECIMENTO_BUCKET, objectPath);
    if (isTenantConhecimentoMigrationMissing(docErr.message)) {
      return NextResponse.json({ error: "Migração de conhecimento ainda não aplicada no Supabase." }, { status: 503 });
    }
    return NextResponse.json({ error: docErr.message }, { status: 500 });
  }

  const texto = extrairTextoDocumentoRag(file.name, mimeType, bytes);
  if (!texto.ok) {
    await supabase
      .from("hub_tenant_conhecimento_documento")
      .update({ status: "erro", erro: texto.error, indexado_em: new Date().toISOString() })
      .eq("id", doc.id);
    return NextResponse.json({ documento: { ...doc, status: "erro", erro: texto.error }, error: texto.error }, { status: 422 });
  }

  const indexed = await indexarDocumentoTenantConhecimento({
    supabase,
    documentoId: doc.id,
    tenantId,
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
      resumo_ia: indexed.resumo_ia,
      indexado_em: new Date().toISOString(),
    },
  });
}
