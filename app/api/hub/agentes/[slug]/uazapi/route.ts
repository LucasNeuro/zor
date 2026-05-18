import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  extrairPaircodeDePayloadUazapi,
  extrairQrcodeDePayloadUazapi,
  normalizarSrcImagemQrUazapi,
} from "@/lib/whatsapp/qr-uazapi";
import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";
import {
  pickInstanceFromResponse,
  statusFromPayloadUazapi,
} from "@/lib/whatsapp/uazapi-instance-status";
import { buildPublicWebhookUrl } from "@/lib/whatsapp/webhook-auth";

function jsonErroUazapi(out: {
  error: string;
  data: unknown;
  request?: { origin: string; pathname: string };
  uazapi_connection_status?: string;
  uazapi_auth_failed?: boolean;
}) {
  return {
    error: out.error,
    uazapi: out.data,
    ...(out.request ? { uazapi_request: out.request } : {}),
    ...(out.uazapi_connection_status ? { uazapi_connection_status: out.uazapi_connection_status } : {}),
    ...(out.uazapi_auth_failed ? { uazapi_auth_failed: true } : {}),
  };
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function pickPublicAppOrigin(request: NextRequest): string | null {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const candidate = envUrl && envUrl.length > 0 ? envUrl : request.nextUrl.origin;
  if (!candidate) return null;

  try {
    const u = new URL(candidate);
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0") return null;
    u.pathname = "";
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

async function syncWebhookDaInstancia(
  request: NextRequest,
  instanceToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const origin = pickPublicAppOrigin(request);
  if (!origin) {
    return { ok: false, error: "NEXT_PUBLIC_APP_URL ausente/inválido para webhook público" };
  }

  const webhookUrl = buildPublicWebhookUrl(origin, process.env.WEBHOOK_SECRET);
  const out = await uazapiFetchJson<Record<string, unknown>>("/webhook", {
    method: "POST",
    instanceToken,
    body: {
      enabled: true,
      url: webhookUrl,
      events: ["messages", "connection"],
      excludeMessages: ["wasSentByApi", "isGroupYes"],
      addUrlEvents: false,
      addUrlTypesMessages: false,
    },
  });

  if (!out.ok) return { ok: false, error: out.error };
  return { ok: true };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: { action?: string; phone?: string; browser?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const action = String(body.action || "").trim().toLowerCase();
  if (!action) {
    return NextResponse.json(
      { error: "Indique action: create | connect | status | disconnect | delete_remote" },
      { status: 400 }
    );
  }

  const supabase = db();
  const { data: agente, error: loadErr } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, modo_operacao, uazapi_instance_id, uazapi_instance_token, uazapi_instance_name, uazapi_connection_status"
    )
    .eq("agente_slug", slug)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!agente) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  const row = agente as {
    modo_operacao?: string | null;
    uazapi_instance_id?: string | null;
    uazapi_instance_token?: string | null;
    uazapi_instance_name?: string | null;
    uazapi_connection_status?: string | null;
  };

  async function persistUazapi(patch: Record<string, unknown>) {
    const full = { ...patch, uazapi_snapshot_at: new Date().toISOString() };
    let { error } = await supabase.from("hub_agente_identidade").update(full).eq("agente_slug", slug);
    if (error?.message?.includes("uazapi_snapshot_at")) {
      ({ error } = await supabase.from("hub_agente_identidade").update(patch).eq("agente_slug", slug));
    }
    if (error) throw new Error(error.message);
  }

  type UazapiErrOut = {
    ok: false;
    status: number;
    data: unknown;
    error: string;
    request?: { origin: string; pathname: string };
  };

  function uazapiAuthFalhou(out: UazapiErrOut): boolean {
    if (out.status === 401 || out.status === 403) return true;
    const payloadTxt =
      typeof out.data === "string"
        ? out.data
        : out.data && typeof out.data === "object"
          ? JSON.stringify(out.data)
          : "";
    const msg = `${out.error} ${payloadTxt}`.toLowerCase();
    return (
      msg.includes("invalid token") ||
      msg.includes("token invalid") ||
      msg.includes("unauthorized") ||
      msg.includes("forbidden") ||
      msg.includes("not authorized")
    );
  }

  async function responderErroUazapi(action: string, out: UazapiErrOut) {
    let hintedStatus: string | undefined;
    const authFailed = uazapiAuthFalhou(out);
    if (
      authFailed &&
      (action === "status" || action === "connect" || action === "disconnect" || action === "delete_remote")
    ) {
      hintedStatus = "disconnected";
      try {
        await persistUazapi({ uazapi_connection_status: "disconnected" });
      } catch {
        // mantém retorno de erro original mesmo se falhar persistência local
      }
    }
    return NextResponse.json(
      jsonErroUazapi({
        ...out,
        ...(hintedStatus ? { uazapi_connection_status: hintedStatus } : {}),
        ...(authFailed ? { uazapi_auth_failed: true } : {}),
      }),
      { status: 502 }
    );
  }

  try {
    if (action === "create") {
      if (row.modo_operacao !== "canal_whatsapp") {
        return NextResponse.json(
          { error: "Defina o modo de operação «WhatsApp» neste agente antes de criar instância." },
          { status: 409 }
        );
      }
      if (row.uazapi_instance_id?.trim()) {
        return NextResponse.json(
          { error: "Este agente já tem instância UAZAPI. Use «Eliminar na UAZAPI» para remover antes." },
          { status: 409 }
        );
      }

      const name = `obra10-${slug}`.slice(0, 80);
      const out = await uazapiFetchJson<Record<string, unknown>>("/instance/create", {
        method: "POST",
        admin: true,
        body: { name, adminField01: slug },
      });

      if (!out.ok) {
        return responderErroUazapi(action, out);
      }

      const data = out.data as Record<string, unknown>;
      const inst = pickInstanceFromResponse(data);
      const token =
        (typeof data.token === "string" && data.token.trim()) ||
        (inst && typeof inst.token === "string" && inst.token.trim()) ||
        "";
      const id = inst && typeof inst.id === "string" && inst.id.trim() ? inst.id.trim() : "";

      if (!token || !id) {
        return NextResponse.json(
          { error: "UAZAPI não devolveu id/token da instância; verifique a resposta.", uazapi: data },
          { status: 502 }
        );
      }

      const st = statusFromPayloadUazapi(data);

      await persistUazapi({
        uazapi_instance_id: id,
        uazapi_instance_token: token,
        uazapi_instance_name: name,
        uazapi_connection_status: st,
      });

      const webhookSync = await syncWebhookDaInstancia(request, token);

      return NextResponse.json({
        ok: true,
        action: "create",
        uazapi_instance_id: id,
        uazapi_connection_status: st,
        ...(webhookSync.ok
          ? {}
          : { webhook_warning: `Instância criada, mas webhook não sincronizado: ${webhookSync.error}` }),
      });
    }

    const tokenInst = typeof row.uazapi_instance_token === "string" ? row.uazapi_instance_token.trim() : "";
    if (!tokenInst) {
      return NextResponse.json({ error: "Crie primeiro a instância UAZAPI para este agente." }, { status: 409 });
    }

    if (action === "connect") {
      const browser = typeof body.browser === "string" ? body.browser : "auto";
      const phoneRaw = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
      const payload: Record<string, unknown> = { browser };
      if (phoneRaw.length >= 10) payload.phone = phoneRaw;

      const out = await uazapiFetchJson<Record<string, unknown>>("/instance/connect", {
        method: "POST",
        instanceToken: tokenInst,
        body: payload,
      });

      if (!out.ok) {
        return responderErroUazapi(action, out);
      }

      const st = statusFromPayloadUazapi(out.data);
      await persistUazapi({ uazapi_connection_status: st });
      const webhookSync = await syncWebhookDaInstancia(request, tokenInst);

      const qrRaw = extrairQrcodeDePayloadUazapi(out.data);
      const qrcode = qrRaw ? normalizarSrcImagemQrUazapi(qrRaw) : undefined;
      const paircode = extrairPaircodeDePayloadUazapi(out.data);
      return NextResponse.json({
        ok: true,
        action: "connect",
        uazapi_connection_status: st,
        ...(qrcode ? { qrcode } : {}),
        ...(paircode ? { paircode } : {}),
        ...(webhookSync.ok
          ? {}
          : { webhook_warning: `Conectado, mas webhook não sincronizado: ${webhookSync.error}` }),
      });
    }

    if (action === "status") {
      const out = await uazapiFetchJson<Record<string, unknown>>("/instance/status", {
        method: "GET",
        instanceToken: tokenInst,
      });

      if (!out.ok) {
        return responderErroUazapi(action, out);
      }

      const st = statusFromPayloadUazapi(out.data);
      await persistUazapi({ uazapi_connection_status: st });

      const inst = pickInstanceFromResponse(out.data);
      const qrRaw = extrairQrcodeDePayloadUazapi(out.data);
      const qrcode = qrRaw ? normalizarSrcImagemQrUazapi(qrRaw) : undefined;
      const paircode = extrairPaircodeDePayloadUazapi(out.data);
      return NextResponse.json({
        ok: true,
        action: "status",
        uazapi_connection_status: st,
        ...(qrcode ? { qrcode } : {}),
        ...(paircode ? { paircode } : {}),
        profileName: typeof inst?.profileName === "string" ? inst.profileName : undefined,
      });
    }

    if (action === "disconnect") {
      const out = await uazapiFetchJson<Record<string, unknown>>("/instance/disconnect", {
        method: "POST",
        instanceToken: tokenInst,
      });

      if (!out.ok) {
        return responderErroUazapi(action, out);
      }

      const st = statusFromPayloadUazapi(out.data);
      await persistUazapi({ uazapi_connection_status: st || "disconnected" });

      return NextResponse.json({ ok: true, action: "disconnect", uazapi_connection_status: st });
    }

    if (action === "delete_remote") {
      const out = await uazapiFetchJson<Record<string, unknown>>("/instance", {
        method: "DELETE",
        instanceToken: tokenInst,
      });

      if (!out.ok) {
        return responderErroUazapi(action, out);
      }

      await persistUazapi({
        uazapi_instance_id: null,
        uazapi_instance_token: null,
        uazapi_instance_name: null,
        uazapi_connection_status: null,
      });

      return NextResponse.json({ ok: true, action: "delete_remote" });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
