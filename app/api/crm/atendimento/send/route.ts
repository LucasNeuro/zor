import { NextRequest, NextResponse } from "next/server";
import {
  humanoResponsavelFromActor,
  resolveActorFromRequest,
  slugFromActor,
} from "@/lib/crm/resolve-crm-actor";
import { enviarMensagemAtendimentoHumano } from "@/lib/crm/atendimento-humano-whatsapp";
import { MAX_ANEXO_CHAT_BYTES } from "@/lib/crm/atendimento-midia-envio";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

async function parseBody(request: NextRequest): Promise<
  | { ok: true; leadId: string; texto?: string; midia?: { base64: string; mimeType: string; nomeArquivo: string; legenda?: string } }
  | { ok: false; error: string; status: number }
> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return { ok: false, error: "Formulário inválido", status: 400 };
    }

    const leadId = String(form.get("leadId") ?? "").trim();
    const texto = String(form.get("texto") ?? "").trim();
    const file = form.get("file");

    if (!leadId) {
      return { ok: false, error: "leadId é obrigatório", status: 400 };
    }

    if (!(file instanceof File)) {
      if (!texto) {
        return { ok: false, error: "Informe texto ou anexe um arquivo", status: 400 };
      }
      return { ok: true, leadId, texto };
    }

    if (file.size <= 0) {
      return { ok: false, error: "Arquivo vazio", status: 400 };
    }
    if (file.size > MAX_ANEXO_CHAT_BYTES) {
      return {
        ok: false,
        error: `Arquivo excede ${Math.round(MAX_ANEXO_CHAT_BYTES / (1024 * 1024))} MB`,
        status: 400,
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type.trim() || "application/octet-stream";
    const nomeArquivo = file.name.trim() || "arquivo";

    return {
      ok: true,
      leadId,
      texto: texto || undefined,
      midia: { base64, mimeType, nomeArquivo, legenda: texto || undefined },
    };
  }

  let body: { leadId?: string; texto?: string };
  try {
    body = (await request.json()) as { leadId?: string; texto?: string };
  } catch {
    return { ok: false, error: "JSON inválido", status: 400 };
  }

  const leadId = body.leadId?.trim();
  const texto = body.texto?.trim();
  if (!leadId || !texto) {
    return { ok: false, error: "leadId e texto são obrigatórios", status: 400 };
  }

  return { ok: true, leadId, texto };
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const parsed = await parseBody(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const supabase = crmDb();
  const actor = await resolveActorFromRequest(supabase, request.headers);
  const operadorSlug = slugFromActor(actor);
  const feitoPor = humanoResponsavelFromActor(actor);

  const result = await enviarMensagemAtendimentoHumano(supabase, {
    leadId: parsed.leadId,
    texto: parsed.texto,
    midia: parsed.midia,
    feitoPor,
    operadorSlug,
    actorId: actor.id ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    whatsappSkipped: result.whatsappSkipped,
    whatsapp: result.whatsapp,
    tokenOrigem: result.tokenOrigem,
    ...(result.aviso ? { aviso: result.aviso } : {}),
  });
}
