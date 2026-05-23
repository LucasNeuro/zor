import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  extrairPaircodeDePayloadUazapi,
  extrairQrcodeDePayloadUazapi,
  resolverQrcodeImagemParaApi,
} from "@/lib/whatsapp/qr-uazapi";
import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";
import {
  extrairDiagnosticoInstanciaUazapi,
  pickInstanceFromResponse,
  statusFromPayloadUazapi,
} from "@/lib/whatsapp/uazapi-instance-status";
import {
  buildUazapiInstanceConnectBody,
  mergeUazapiProxyFields,
  persistPatchFromProxy,
  proxyFromRequestBody,
  proxyFromStoredRow,
  uazapiProxyConfigured,
  UAZAPI_PROXY_SETUP_HINT,
} from "@/lib/whatsapp/uazapi-proxy-connect";
import {
  formatWebhookSyncWarnings,
  syncWebhooksUazapi,
} from "@/lib/whatsapp/uazapi-webhook-sync";
import { resolverTokenCatalogoProxyCidades } from "@/lib/whatsapp/uazapi-proxy-cities-token";

async function resolverQrRespostaUazapi(
  payload: unknown,
  instanceToken: string
): Promise<{ qrcode?: string; qr_invalid?: boolean }> {
  let qrRaw = extrairQrcodeDePayloadUazapi(payload);
  if (!qrRaw) {
    const st = await uazapiFetchJson<Record<string, unknown>>("/instance/status", {
      method: "GET",
      instanceToken,
    });
    if (st.ok) qrRaw = extrairQrcodeDePayloadUazapi(st.data);
  }
  if (!qrRaw) return {};
  const resolved = await resolverQrcodeImagemParaApi(qrRaw, instanceToken);
  if ("src" in resolved && resolved.src) return { qrcode: resolved.src };
  if ("invalid" in resolved) return { qr_invalid: true };
  return {};
}

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: {
    action?: string;
    phone?: string;
    browser?: string;
    search?: string;
    proxy_managed_country?: string;
    proxy_managed_state?: string;
    proxy_managed_city?: string;
    /** Encerra sessão pendente antes de novo QR (recomendado se ficou em connecting). */
    reset_session?: boolean;
    systemName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const action = String(body.action || "").trim().toLowerCase();
  if (!action) {
    return NextResponse.json(
      { error: "Indique action: create | connect | status | disconnect | delete_remote | save_proxy | list_proxy_cities" },
      { status: 400 }
    );
  }

  const supabase = db();
  const { data: agente, error: loadErr } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, modo_operacao, uazapi_instance_id, uazapi_instance_token, uazapi_instance_name, uazapi_connection_status, uazapi_proxy_country, uazapi_proxy_state, uazapi_proxy_city"
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
    uazapi_proxy_country?: string | null;
    uazapi_proxy_state?: string | null;
    uazapi_proxy_city?: string | null;
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

      const webhookSync = await syncWebhooksUazapi(request, token);
      const webhookWarning = formatWebhookSyncWarnings(webhookSync);

      return NextResponse.json({
        ok: true,
        action: "create",
        uazapi_instance_id: id,
        uazapi_connection_status: st,
        webhook_sync: {
          instance: webhookSync.instance.ok,
          global: webhookSync.global.ok || webhookSync.global.skipped === true,
        },
        ...(webhookWarning ? { webhook_warning: webhookWarning } : {}),
      });
    }

    if (action === "save_proxy") {
      const fromBody = proxyFromRequestBody(body);
      if (!fromBody) {
        return NextResponse.json(
          { error: "Informe a cidade do proxy (proxy_managed_city)." },
          { status: 400 }
        );
      }
      await persistUazapi(persistPatchFromProxy(fromBody));
      return NextResponse.json({
        ok: true,
        action: "save_proxy",
        uazapi_proxy_country: fromBody.proxy_managed_country,
        uazapi_proxy_state: fromBody.proxy_managed_state ?? null,
        uazapi_proxy_city: fromBody.proxy_managed_city,
      });
    }

    const tokenInst = typeof row.uazapi_instance_token === "string" ? row.uazapi_instance_token.trim() : "";

    if (action === "list_proxy_cities") {
      const country = (body.proxy_managed_country || "br").trim().toLowerCase() || "br";
      const stateQ =
        typeof body.proxy_managed_state === "string" ? body.proxy_managed_state.trim().toLowerCase() : "";
      const search = typeof body.search === "string" ? body.search.trim() : "";
      const qs = new URLSearchParams({ country });
      if (stateQ) qs.set("state", stateQ);
      if (search) qs.set("search", search);

      const catalogAuth = await resolverTokenCatalogoProxyCidades(tokenInst);
      if (!catalogAuth.ok) {
        return NextResponse.json({ error: catalogAuth.error }, { status: catalogAuth.status });
      }

      const out = await uazapiFetchJson<Record<string, unknown>>(
        `/proxy-managed/cities?${qs.toString()}`,
        {
          method: "GET",
          instanceToken: catalogAuth.token,
        }
      );
      if (!out.ok) {
        return responderErroUazapi(action, out);
      }
      const cities = Array.isArray((out.data as { cities?: unknown })?.cities)
        ? (out.data as { cities: unknown[] }).cities
        : [];
      return NextResponse.json({
        ok: true,
        action: "list_proxy_cities",
        country,
        cities,
        auth_source: catalogAuth.source,
      });
    }

    if (!tokenInst) {
      return NextResponse.json({ error: "Crie primeiro a instância UAZAPI para este agente." }, { status: 409 });
    }

    if (action === "connect") {
      const fromBody = proxyFromRequestBody(body);
      const stored = proxyFromStoredRow(row);
      if (fromBody) {
        await persistUazapi(persistPatchFromProxy(fromBody));
        Object.assign(row, persistPatchFromProxy(fromBody));
      }
      const merged = mergeUazapiProxyFields({ body: fromBody, stored: proxyFromStoredRow(row) });
      if (!uazapiProxyConfigured(merged)) {
        return NextResponse.json(
          { error: "Guarde a cidade do proxy (região) antes de gerar o QR.", proxy_warning: UAZAPI_PROXY_SETUP_HINT },
          { status: 400 }
        );
      }

      const resetSession = body.reset_session === true;
      const statusPre = await uazapiFetchJson<Record<string, unknown>>("/instance/status", {
        method: "GET",
        instanceToken: tokenInst,
      });
      const stPre = statusPre.ok ? statusFromPayloadUazapi(statusPre.data) : "disconnected";
      if (resetSession) {
        await uazapiFetchJson<Record<string, unknown>>("/instance/disconnect", {
          method: "POST",
          instanceToken: tokenInst,
        });
        await new Promise((r) => setTimeout(r, 900));
      }

      const payload = buildUazapiInstanceConnectBody({
        browser: typeof body.browser === "string" ? body.browser : undefined,
        phone: typeof body.phone === "string" ? body.phone : undefined,
        systemName:
          typeof body.systemName === "string" && body.systemName.trim()
            ? body.systemName.trim()
            : slug,
        proxy: merged,
      });

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
      const webhookSync = await syncWebhooksUazapi(request, tokenInst);
      const webhookWarning = formatWebhookSyncWarnings(webhookSync);

      const qrPack = await resolverQrRespostaUazapi(out.data, tokenInst);
      const paircode = extrairPaircodeDePayloadUazapi(out.data);
      const diag = extrairDiagnosticoInstanciaUazapi(out.data);
      return NextResponse.json({
        ok: true,
        action: "connect",
        uazapi_connection_status: st,
        proxy_applied: merged,
        session_reset: resetSession,
        qr_valid_seconds: 120,
        ...(qrPack.qrcode ? { qrcode: qrPack.qrcode } : {}),
        ...(qrPack.qr_invalid ? { qr_invalid: true } : {}),
        ...(paircode ? { paircode } : {}),
        ...diag,
        webhook_sync: {
          instance: webhookSync.instance.ok,
          global: webhookSync.global.ok || webhookSync.global.skipped === true,
        },
        ...(webhookWarning ? { webhook_warning: webhookWarning } : {}),
        ...(qrPack.qr_invalid
          ? {
              connect_hint:
                "A UAZAPI devolveu dados que não são uma imagem QR válida. Use «Desligar sessão», guarde a região e «Gerar QR» de novo.",
            }
          : !qrPack.qrcode
            ? {
                connect_hint:
                  "UAZAPI não devolveu QR. Tente «Gerar QR» de novo ou «Desligar sessão» antes. O código expira em ~2 minutos.",
              }
            : {}),
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

      let webhookWarning: string | undefined;
      let webhookSync: Awaited<ReturnType<typeof syncWebhooksUazapi>> | undefined;
      if (st === "connected") {
        webhookSync = await syncWebhooksUazapi(request, tokenInst);
        webhookWarning = formatWebhookSyncWarnings(webhookSync);
      }

      const inst = pickInstanceFromResponse(out.data);
      const qrPack =
        st === "connecting" ? await resolverQrRespostaUazapi(out.data, tokenInst) : {};
      const paircode = extrairPaircodeDePayloadUazapi(out.data);
      const diag = extrairDiagnosticoInstanciaUazapi(out.data);
      return NextResponse.json({
        ok: true,
        action: "status",
        uazapi_connection_status: st,
        ...(qrPack.qrcode ? { qrcode: qrPack.qrcode } : {}),
        ...(qrPack.qr_invalid ? { qr_invalid: true } : {}),
        ...(paircode ? { paircode } : {}),
        profileName: typeof inst?.profileName === "string" ? inst.profileName : diag.profileName,
        ...diag,
        ...(webhookSync
          ? {
              webhook_sync: {
                instance: webhookSync.instance.ok,
                global: webhookSync.global.ok || webhookSync.global.skipped === true,
              },
            }
          : {}),
        ...(webhookWarning ? { webhook_warning: webhookWarning } : {}),
      });
    }

    if (action === "sync_webhook") {
      const webhookSync = await syncWebhooksUazapi(request, tokenInst);
      const webhookWarning = formatWebhookSyncWarnings(webhookSync);
      if (!webhookSync.instance.ok && !webhookSync.global.ok) {
        return NextResponse.json(
          { error: webhookWarning || "Falha ao sincronizar webhooks", webhook_sync: webhookSync },
          { status: 502 }
        );
      }
      return NextResponse.json({
        ok: true,
        action: "sync_webhook",
        webhook_sync: {
          instance: webhookSync.instance.ok,
          global: webhookSync.global.ok || webhookSync.global.skipped === true,
        },
        ...(webhookWarning ? { webhook_warning: webhookWarning } : {}),
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
        uazapi_proxy_country: null,
        uazapi_proxy_state: null,
        uazapi_proxy_city: null,
      });

      return NextResponse.json({ ok: true, action: "delete_remote" });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
