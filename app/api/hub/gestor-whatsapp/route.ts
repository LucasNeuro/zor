import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveValidatedTenantId } from "@/lib/crm/resolve-tenant-from-caller";
import { defaultTenantId } from "@/lib/tenant-default";
import { telefonesAutorizadosGestor } from "@/lib/whatsapp/gestor-linha-db";
import { extrairPaircodeDePayloadUazapi } from "@/lib/whatsapp/qr-uazapi";
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
  formatGestorWebhookSyncWarnings,
  maskWebhookUrlForUi,
  publicGestorWebhookUrlFromRequest,
  syncWebhooksUazapiGestor,
} from "@/lib/whatsapp/uazapi-webhook-sync";
import {
  deleteUazapiInstanceForAgent,
} from "@/lib/whatsapp/uazapi-delete-instance";
import { resolverTokenCatalogoProxyCidades } from "@/lib/whatsapp/uazapi-proxy-cities-token";
import {
  jsonErroUazapi,
  resolverQrRespostaUazapi,
  uazapiAuthFalhou,
  type UazapiErrOut,
} from "@/lib/whatsapp/uazapi-route-helpers";
import {
  instanciaGestorNomeValido,
  instanciaNaListaAdminUazapi,
  nomeInstanciaGestorUazapi,
  verificarInstanciaNoUazapi,
} from "@/lib/whatsapp/uazapi-verify-instance";
import { uazapiBaseUrlNormalizado } from "@/lib/whatsapp/uazapi-http";
import { pickPublicAppOrigin } from "@/lib/whatsapp/uazapi-webhook-sync";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SELECT_LINHA =
  "id, tenant_id, uazapi_instance_id, uazapi_instance_token, uazapi_instance_name, uazapi_connection_status, uazapi_proxy_country, uazapi_proxy_state, uazapi_proxy_city, telefones_autorizados, ativo, uazapi_snapshot_at";

type LinhaGestorRow = Record<string, unknown>;

async function ensureLinhaGestor(supabase: ReturnType<typeof db>, tenantId: string) {
  const { data } = await supabase
    .from("hub_linha_gestor_whatsapp")
    .select("id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (data?.id) return;
  await supabase.from("hub_linha_gestor_whatsapp").insert({ tenant_id: tenantId });
}

function sanitizarLinhaGestor(row: LinhaGestorRow, extras?: { remoto_verificado?: boolean }) {
  return {
    tenant_id: row.tenant_id,
    uazapi_instance_id: row.uazapi_instance_id ?? null,
    uazapi_instance_name: row.uazapi_instance_name ?? null,
    uazapi_connection_status: row.uazapi_connection_status ?? null,
    uazapi_has_instance_token: Boolean(
      typeof row.uazapi_instance_token === "string" && row.uazapi_instance_token.trim()
    ),
    uazapi_proxy_country: row.uazapi_proxy_country ?? null,
    uazapi_proxy_state: row.uazapi_proxy_state ?? null,
    uazapi_proxy_city: row.uazapi_proxy_city ?? null,
    telefones_autorizados: telefonesAutorizadosGestor(row.telefones_autorizados),
    ativo: row.ativo !== false,
    uazapi_snapshot_at: row.uazapi_snapshot_at ?? null,
    ...(typeof extras?.remoto_verificado === "boolean"
      ? { remoto_verificado: extras.remoto_verificado }
      : {}),
  };
}

function servidorWhatsappHost(): string | null {
  const base = uazapiBaseUrlNormalizado();
  if (!base) return null;
  try {
    return new URL(base).host;
  } catch {
    return base.replace(/^https?:\/\//, "").split("/")[0] || null;
  }
}

async function linhaRemotoVerificado(
  row: LinhaGestorRow,
  tenantId: string
): Promise<boolean> {
  const token = tokenInstancia(row);
  const id = idInstancia(row);
  const name = nomeInstancia(row);
  if (!token && !id && !name) return false;

  const lista = await instanciaNaListaAdminUazapi({ instanceId: id, instanceName: name, instanceToken: token });
  if (!lista.ok || !lista.encontrada) return false;
  return instanciaGestorNomeValido(lista.nome || name, tenantId);
}

function tokenInstancia(row: LinhaGestorRow): string {
  return typeof row.uazapi_instance_token === "string" ? row.uazapi_instance_token.trim() : "";
}

function idInstancia(row: LinhaGestorRow): string {
  return typeof row.uazapi_instance_id === "string" ? row.uazapi_instance_id.trim() : "";
}

function nomeInstancia(row: LinhaGestorRow): string {
  return typeof row.uazapi_instance_name === "string" ? row.uazapi_instance_name.trim() : "";
}

async function limparInstanciaGestorLocal(
  persistGestor: (patch: Record<string, unknown>) => Promise<void>,
  opts?: { manterProxy?: boolean }
) {
  const patch: Record<string, unknown> = {
    uazapi_instance_id: null,
    uazapi_instance_token: null,
    uazapi_instance_name: null,
    uazapi_connection_status: null,
  };
  if (!opts?.manterProxy) {
    patch.uazapi_proxy_country = null;
    patch.uazapi_proxy_state = null;
    patch.uazapi_proxy_city = null;
  }
  await persistGestor(patch);
}

/** Remove registo local se a instância não existir ou não for a linha gestor deste tenant. */
async function garantirInstanciaGestorNoServidor(
  row: LinhaGestorRow,
  tenantId: string,
  persistGestor: (patch: Record<string, unknown>) => Promise<void>
): Promise<{ ok: true; remotoExiste: boolean; nomeRemoto?: string } | { ok: false; error: string }> {
  const token = tokenInstancia(row);
  const id = idInstancia(row);
  const name = nomeInstancia(row);
  if (!token && !id && !name) return { ok: true, remotoExiste: false };

  const lista = await instanciaNaListaAdminUazapi({ instanceId: id, instanceName: name, instanceToken: token });
  if (!lista.ok) return { ok: false, error: lista.error };

  const nomeRemoto = lista.nome || name || undefined;
  const nomeOk =
    lista.encontrada && instanciaGestorNomeValido(nomeRemoto || name, tenantId);

  if (nomeOk) {
    return { ok: true, remotoExiste: true, nomeRemoto };
  }

  if (lista.encontrada && !nomeOk) {
    await limparInstanciaGestorLocal(persistGestor, { manterProxy: true });
    return { ok: true, remotoExiste: false };
  }

  if (instanciaGestorNomeValido(name, tenantId)) {
    await deleteUazapiInstanceForAgent({
      instanceToken: token,
      instanceId: id,
      instanceName: name,
    });
  }
  await limparInstanciaGestorLocal(persistGestor, { manterProxy: true });
  return { ok: true, remotoExiste: false };
}

export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
  const tenantResolved = await resolveValidatedTenantId(request);
  if (!tenantResolved.ok) {
    return NextResponse.json({ error: "Tenant inválido" }, { status: 403 });
  }

  const supabase = db();
  await ensureLinhaGestor(supabase, tenantResolved.tenantId);

  const { data, error } = await supabase
    .from("hub_linha_gestor_whatsapp")
    .select(SELECT_LINHA)
    .eq("tenant_id", tenantResolved.tenantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let linhaOut = data as LinhaGestorRow | null;
  const syncRemoto = request.nextUrl.searchParams.get("sync") === "1";
  if (data && syncRemoto) {
    const row = data as LinhaGestorRow;
    const temRegisto =
      Boolean(tokenInstancia(row)) || Boolean(idInstancia(row)) || Boolean(nomeInstancia(row));
    if (temRegisto) {
      const check = await garantirInstanciaGestorNoServidor(
        row,
        tenantResolved.tenantId,
        async (patch) => {
          const full = {
            ...patch,
            atualizado_em: new Date().toISOString(),
            uazapi_snapshot_at: new Date().toISOString(),
          };
          await supabase.from("hub_linha_gestor_whatsapp").update(full).eq("tenant_id", tenantResolved.tenantId);
        }
      );
      if (check.ok && !check.remotoExiste) {
        const { data: fresh } = await supabase
          .from("hub_linha_gestor_whatsapp")
          .select(SELECT_LINHA)
          .eq("tenant_id", tenantResolved.tenantId)
          .maybeSingle();
        linhaOut = (fresh as LinhaGestorRow | null) ?? null;
      }
    }
  }

  const remotoVerificado = linhaOut
    ? await linhaRemotoVerificado(linhaOut, tenantResolved.tenantId)
    : false;
  const registroLocalOrfao = Boolean(
    linhaOut &&
      (tokenInstancia(linhaOut) || idInstancia(linhaOut) || nomeInstancia(linhaOut)) &&
      !remotoVerificado
  );

  const appOrigin = pickPublicAppOrigin(request);
  const webhookLocalhost = Boolean(
    appOrigin && /localhost|127\.0\.0\.1/i.test(appOrigin)
  );

  return NextResponse.json({
    ok: true,
    linha: linhaOut ? sanitizarLinhaGestor(linhaOut, { remoto_verificado: remotoVerificado }) : null,
    meta: {
      servidor_whatsapp: servidorWhatsappHost(),
      nome_instancia_esperado: nomeInstanciaGestorUazapi(tenantResolved.tenantId),
      registro_local_orfao: registroLocalOrfao,
      webhook_localhost: webhookLocalhost,
      uazapi_configurado: Boolean(uazapiBaseUrlNormalizado() && process.env.UAZAPI_ADMIN_TOKEN?.trim()),
    },
  });
}

export async function PATCH(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
  const tenantResolved = await resolveValidatedTenantId(request);
  if (!tenantResolved.ok) {
    return NextResponse.json({ error: "Tenant inválido" }, { status: 403 });
  }

  let body: { telefones_autorizados?: string[]; ativo?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const telefones = Array.isArray(body.telefones_autorizados)
    ? body.telefones_autorizados.map((t) => String(t).replace(/\D/g, "")).filter((t) => t.length >= 10)
    : undefined;

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (telefones !== undefined) patch.telefones_autorizados = telefones;
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;

  const supabase = db();
  await ensureLinhaGestor(supabase, tenantResolved.tenantId);

  const { data, error } = await supabase
    .from("hub_linha_gestor_whatsapp")
    .update(patch)
    .eq("tenant_id", tenantResolved.tenantId)
    .select(SELECT_LINHA)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, linha: sanitizarLinhaGestor(data as LinhaGestorRow) });
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
  const tenantResolved = await resolveValidatedTenantId(request);
  if (!tenantResolved.ok) {
    return NextResponse.json({ error: "Tenant inválido" }, { status: 403 });
  }

  const tenantId = tenantResolved.tenantId || defaultTenantId();

  let body: {
    action?: string;
    phone?: string;
    browser?: string;
    systemName?: string;
    telefones_autorizados?: string[];
    proxy_managed_country?: string;
    proxy_managed_state?: string;
    proxy_managed_city?: string;
    reset_session?: boolean;
    search?: string;
    force_recreate?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const action = String(body.action || "").trim().toLowerCase();
  if (!action) {
    return NextResponse.json(
      {
        error:
          "Indique action: create | connect | status | disconnect | delete_remote | save_proxy | sync_webhook | verify_remote | list_proxy_cities",
      },
      { status: 400 }
    );
  }

  const supabase = db();
  await ensureLinhaGestor(supabase, tenantId);

  let { data: linha, error: loadErr } = await supabase
    .from("hub_linha_gestor_whatsapp")
    .select(SELECT_LINHA)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });

  let row = (linha ?? { tenant_id: tenantId }) as LinhaGestorRow;

  async function persistGestor(patch: Record<string, unknown>) {
    const full = { ...patch, atualizado_em: new Date().toISOString(), uazapi_snapshot_at: new Date().toISOString() };
    const { error } = await supabase.from("hub_linha_gestor_whatsapp").update(full).eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    Object.assign(row, patch);
  }

  async function recarregarLinha() {
    const { data: fresh } = await supabase
      .from("hub_linha_gestor_whatsapp")
      .select(SELECT_LINHA)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (fresh) row = fresh as LinhaGestorRow;
  }

  async function responderErroUazapi(actionName: string, out: UazapiErrOut) {
    let hintedStatus: string | undefined;
    const authFailed = uazapiAuthFalhou(out);
    if (
      authFailed &&
      (actionName === "status" ||
        actionName === "connect" ||
        actionName === "disconnect" ||
        actionName === "delete_remote")
    ) {
      hintedStatus = "disconnected";
      try {
        await persistGestor({ uazapi_connection_status: "disconnected" });
      } catch {
        /* mantém retorno de erro */
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
      const forceRecreate = body.force_recreate === true;
      const name = nomeInstanciaGestorUazapi(tenantId);
      const temLocal = Boolean(idInstancia(row) || tokenInstancia(row) || nomeInstancia(row));

      if (temLocal && !forceRecreate) {
        const check = await garantirInstanciaGestorNoServidor(row, tenantId, persistGestor);
        if (!check.ok) {
          return NextResponse.json({ error: check.error }, { status: 502 });
        }
        await recarregarLinha();

        if (check.remotoExiste) {
          return NextResponse.json(
            {
              error:
                "Já existe ligação WhatsApp registada. Use «Eliminar ligação WhatsApp» para remover antes de criar outra.",
            },
            { status: 409 }
          );
        }
      }

      if (temLocal && forceRecreate) {
        await deleteUazapiInstanceForAgent({
          instanceToken: tokenInstancia(row),
          instanceId: idInstancia(row),
          instanceName: nomeInstancia(row) || name,
        });
        await limparInstanciaGestorLocal(persistGestor, { manterProxy: true });
        await recarregarLinha();
      }

      const remotoPorNome = await verificarInstanciaNoUazapi({ instanceName: name });
      if (!remotoPorNome.ok) {
        return NextResponse.json({ error: remotoPorNome.error }, { status: 502 });
      }
      if (remotoPorNome.encontrada) {
        const delOrfao = await deleteUazapiInstanceForAgent({
          instanceName: name,
          instanceId: remotoPorNome.id,
        });
        if (!delOrfao.ok) {
          return NextResponse.json({ error: delOrfao.error }, { status: 502 });
        }
      }
      const out = await uazapiFetchJson<Record<string, unknown>>("/instance/create", {
        method: "POST",
        admin: true,
        body: { name, adminField01: `gestor:${tenantId}` },
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

      await persistGestor({
        uazapi_instance_id: id,
        uazapi_instance_token: token,
        uazapi_instance_name: name,
        uazapi_connection_status: st,
      });

      let confirmacaoLista: Awaited<ReturnType<typeof instanciaNaListaAdminUazapi>> | null = null;
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        confirmacaoLista = await instanciaNaListaAdminUazapi({
          instanceToken: token,
          instanceId: id,
          instanceName: name,
        });
        if (confirmacaoLista.ok && confirmacaoLista.encontrada) break;
        await new Promise((r) => setTimeout(r, 600 + tentativa * 400));
      }

      if (!confirmacaoLista?.ok) {
        const errMsg =
          confirmacaoLista && "error" in confirmacaoLista
            ? confirmacaoLista.error
            : "Falha ao confirmar instância no painel UAZAPI.";
        await deleteUazapiInstanceForAgent({ instanceToken: token, instanceId: id, instanceName: name });
        await limparInstanciaGestorLocal(persistGestor, { manterProxy: true });
        return NextResponse.json({ error: errMsg }, { status: 502 });
      }
      if (!confirmacaoLista.encontrada) {
        await deleteUazapiInstanceForAgent({ instanceToken: token, instanceId: id, instanceName: name });
        await limparInstanciaGestorLocal(persistGestor, { manterProxy: true });
        return NextResponse.json(
          {
            error:
              "A ligação foi criada mas não apareceu no painel UAZAPI. Confira UAZAPI_BASE_URL e o Admin Token do mesmo servidor e tente de novo.",
          },
          { status: 502 }
        );
      }

      const confirmacao = await verificarInstanciaNoUazapi({
        instanceToken: token,
        instanceId: id,
        instanceName: name,
      });
      if (!confirmacao.ok) {
        await deleteUazapiInstanceForAgent({ instanceToken: token, instanceId: id, instanceName: name });
        await limparInstanciaGestorLocal(persistGestor, { manterProxy: true });
        return NextResponse.json({ error: confirmacao.error }, { status: 502 });
      }
      if (!confirmacao.encontrada) {
        await limparInstanciaGestorLocal(persistGestor, { manterProxy: true });
        return NextResponse.json(
          {
            error:
              "A ligação não foi confirmada no servidor WhatsApp. Tente de novo em alguns segundos ou reinicie a API no painel do provedor.",
          },
          { status: 502 }
        );
      }

      const webhookSync = await syncWebhooksUazapiGestor(request, token);
      const webhookWarning = formatGestorWebhookSyncWarnings(webhookSync);

      return NextResponse.json({
        ok: true,
        action: "create",
        uazapi_instance_id: id,
        uazapi_instance_name: name,
        uazapi_connection_status: st,
        servidor_confirmado: true,
        servidor_whatsapp: servidorWhatsappHost(),
        remoto_verificado: true,
        orphan_cleared: temLocal,
        webhook_sync: { instance: webhookSync.instance.ok },
        webhook_url: publicGestorWebhookUrlFromRequest(request),
        ...(webhookWarning ? { webhook_warning: webhookWarning } : {}),
      });
    }

    if (action === "verify_remote") {
      const token = tokenInstancia(row);
      const id = idInstancia(row);
      const name = nomeInstancia(row);
      if (!token && !id && !name) {
        return NextResponse.json({ error: "Sem instância gestor registada." }, { status: 409 });
      }

      const check = await garantirInstanciaGestorNoServidor(row, tenantId, persistGestor);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 502 });
      }
      await recarregarLinha();

      if (!check.remotoExiste) {
        return NextResponse.json({
          ok: false,
          action: "verify_remote",
          encontrada: false,
          limpeza_local: true,
          error: "Instância não existe no servidor UAZAPI — registo local limpo. Crie de novo.",
        });
      }

      const verif = await verificarInstanciaNoUazapi({
        instanceId: idInstancia(row),
        instanceName: nomeInstancia(row),
        instanceToken: tokenInstancia(row),
      });

      return NextResponse.json({
        ok: true,
        action: "verify_remote",
        encontrada: true,
        uazapi_instance_name: verif.ok && verif.encontrada ? verif.nome ?? name : name,
        uazapi_instance_id: verif.ok && verif.encontrada ? verif.id ?? id : id,
      });
    }

    if (action === "list_proxy_cities") {
      const country = (body.proxy_managed_country || "br").trim().toLowerCase() || "br";
      const stateQ =
        typeof body.proxy_managed_state === "string" ? body.proxy_managed_state.trim().toLowerCase() : "";
      const search = typeof body.search === "string" ? body.search.trim() : "";
      const qs = new URLSearchParams({ country });
      if (stateQ) qs.set("state", stateQ);
      if (search) qs.set("search", search);

      const catalogAuth = await resolverTokenCatalogoProxyCidades(tokenInstancia(row));
      if (!catalogAuth.ok) {
        return NextResponse.json({ error: catalogAuth.error }, { status: catalogAuth.status });
      }

      const out = await uazapiFetchJson<Record<string, unknown>>(`/proxy-managed/cities?${qs.toString()}`, {
        method: "GET",
        instanceToken: catalogAuth.token,
      });
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

    if (action === "save_proxy") {
      const fromBody = proxyFromRequestBody(body);
      if (!fromBody) {
        return NextResponse.json({ error: "Informe a cidade do proxy (proxy_managed_city)." }, { status: 400 });
      }
      await persistGestor(persistPatchFromProxy(fromBody));
      return NextResponse.json({
        ok: true,
        action: "save_proxy",
        uazapi_proxy_country: fromBody.proxy_managed_country,
        uazapi_proxy_state: fromBody.proxy_managed_state ?? null,
        uazapi_proxy_city: fromBody.proxy_managed_city,
      });
    }

    const tokenInst = tokenInstancia(row);
    if (!tokenInst) {
      return NextResponse.json(
        { error: "Crie primeiro a instância UAZAPI (botão «Criar ligação WhatsApp»)." },
        { status: 409 }
      );
    }

    if (action === "connect") {
      const check = await garantirInstanciaGestorNoServidor(row, tenantId, persistGestor);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 502 });
      }
      if (!check.remotoExiste) {
        return NextResponse.json(
          {
            error:
              "A instância não existe no servidor UAZAPI. Clique «Criar ligação WhatsApp» para registar de novo.",
            uazapi_auth_failed: true,
          },
          { status: 409 }
        );
      }
      await recarregarLinha();

      const tokenAtual = tokenInstancia(row);
      const fromBody = proxyFromRequestBody(body);
      const stored = proxyFromStoredRow(row);
      if (fromBody) {
        await persistGestor(persistPatchFromProxy(fromBody));
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
        instanceToken: tokenAtual,
      });
      const stPre = statusPre.ok ? statusFromPayloadUazapi(statusPre.data) : "disconnected";

      const precisaLimparSessao = resetSession || stPre === "connecting" || stPre !== "connected";
      if (precisaLimparSessao) {
        await uazapiFetchJson<Record<string, unknown>>("/instance/disconnect", {
          method: "POST",
          instanceToken: tokenAtual,
        });
        await new Promise((r) => setTimeout(r, 1200));
      }

      const payload = buildUazapiInstanceConnectBody({
        browser: typeof body.browser === "string" ? body.browser : undefined,
        phone: typeof body.phone === "string" ? body.phone : undefined,
        systemName:
          typeof body.systemName === "string" && body.systemName.trim()
            ? body.systemName.trim()
            : "waje-gestor",
        proxy: merged,
      });

      const out = await uazapiFetchJson<Record<string, unknown>>("/instance/connect", {
        method: "POST",
        instanceToken: tokenAtual,
        body: payload,
      });

      if (!out.ok) {
        return responderErroUazapi(action, out);
      }

      const st = statusFromPayloadUazapi(out.data);
      await persistGestor({ uazapi_connection_status: st });
      const webhookSync = await syncWebhooksUazapiGestor(request, tokenAtual);
      const webhookWarning = formatGestorWebhookSyncWarnings(webhookSync);

      const qrPack = await resolverQrRespostaUazapi(out.data, tokenAtual);
      const paircode = extrairPaircodeDePayloadUazapi(out.data);
      const diag = extrairDiagnosticoInstanciaUazapi(out.data);

      return NextResponse.json({
        ok: true,
        action: "connect",
        uazapi_connection_status: st,
        proxy_applied: merged,
        session_reset: precisaLimparSessao,
        qr_valid_seconds: 120,
        ...(qrPack.qrcode ? { qrcode: qrPack.qrcode } : {}),
        ...(qrPack.qr_invalid ? { qr_invalid: true } : {}),
        ...(paircode ? { paircode } : {}),
        ...diag,
        webhook_sync: {
          instance: webhookSync.instance.ok,
        },
        ...(webhookWarning ? { webhook_warning: webhookWarning } : {}),
        ...(paircode
          ? {
              connect_hint:
                "Código gerado. WhatsApp → Aparelhos conectados → Conectar com número. Digite o código no telefone; expira em ~5 minutos.",
              paircode_valid_seconds: 300,
            }
          : qrPack.qr_invalid
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
      const check = await garantirInstanciaGestorNoServidor(row, tenantId, persistGestor);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 502 });
      }
      if (!check.remotoExiste) {
        return NextResponse.json({
          ok: true,
          action: "status",
          uazapi_connection_status: "disconnected",
          uazapi_auth_failed: true,
          orphan_cleared: true,
        });
      }
      await recarregarLinha();

      const tokenAtual = tokenInstancia(row);
      const out = await uazapiFetchJson<Record<string, unknown>>("/instance/status", {
        method: "GET",
        instanceToken: tokenAtual,
      });

      if (!out.ok) {
        return responderErroUazapi(action, out);
      }

      const st = statusFromPayloadUazapi(out.data);
      await persistGestor({ uazapi_connection_status: st });

      let webhookWarning: string | undefined;
      let webhookSync: Awaited<ReturnType<typeof syncWebhooksUazapiGestor>> | undefined;
      if (st === "connected") {
        webhookSync = await syncWebhooksUazapiGestor(request, tokenAtual);
        webhookWarning = formatGestorWebhookSyncWarnings(webhookSync);
      }

      const inst = pickInstanceFromResponse(out.data);
      const qrPack = st === "connecting" ? await resolverQrRespostaUazapi(out.data, tokenAtual) : {};
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
              },
            }
          : {}),
        ...(webhookWarning ? { webhook_warning: webhookWarning } : {}),
        webhook_url: publicGestorWebhookUrlFromRequest(request),
        webhook_url_display: (() => {
          const u = publicGestorWebhookUrlFromRequest(request);
          return u ? maskWebhookUrlForUi(u) : null;
        })(),
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
      await persistGestor({ uazapi_connection_status: st || "disconnected" });

      return NextResponse.json({ ok: true, action: "disconnect", uazapi_connection_status: st });
    }

    if (action === "sync_webhook") {
      const webhookSync = await syncWebhooksUazapiGestor(request, tokenInst);
      const webhookWarning = formatGestorWebhookSyncWarnings(webhookSync);
      if (!webhookSync.instance.ok) {
        return NextResponse.json(
          { error: webhookWarning || "Falha ao sincronizar webhook gestor", webhook_sync: webhookSync },
          { status: 502 }
        );
      }
      const webhookUrl = publicGestorWebhookUrlFromRequest(request);
      return NextResponse.json({
        ok: true,
        action: "sync_webhook",
        webhook_sync: {
          instance: webhookSync.instance.ok,
        },
        webhook_url: webhookUrl,
        webhook_url_display: webhookUrl ? maskWebhookUrlForUi(webhookUrl) : null,
        ...(webhookWarning ? { webhook_warning: webhookWarning } : {}),
      });
    }

    if (action === "delete_remote") {
      const del = await deleteUazapiInstanceForAgent({
        instanceToken: tokenInst,
        instanceId: idInstancia(row),
        instanceName: nomeInstancia(row) || nomeInstanciaGestorUazapi(tenantId),
      });
      if (!del.ok) {
        return NextResponse.json({ error: del.error, action: "delete_remote" }, { status: 502 });
      }

      await limparInstanciaGestorLocal(persistGestor);

      return NextResponse.json({ ok: true, action: "delete_remote", deleted: del.deleted });
    }

    return NextResponse.json({ error: `Action desconhecida: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro_uazapi_gestor";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
