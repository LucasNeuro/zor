"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  Unplug,
} from "lucide-react";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { normalizarSrcImagemQrUazapi } from "@/lib/whatsapp/qr-uazapi";

export type AgenteUazapiSnapshot = {
  uazapi_instance_id?: string | null;
  uazapi_instance_name?: string | null;
  uazapi_connection_status?: string | null;
  uazapi_has_instance_token?: boolean;
  uazapi_proxy_country?: string | null;
  uazapi_proxy_state?: string | null;
  uazapi_proxy_city?: string | null;
};

type CidadeProxyUazapi = {
  value: string;
  label: string;
  state?: string;
};

export type AgenteUazapiBlockProps = {
  agenteSlug: string;
  snapshot: AgenteUazapiSnapshot;
  onRefresh: () => Promise<void> | void;
  /** Enquanto o wizard grava modo_operacao no servidor (evita 409 na criação). */
  bloqueado?: boolean;
};

function badgeCor(status?: string | null): { bg: string; fg: string; bar: string } {
  const s = (status || "").toLowerCase();
  if (s === "connected") return { bg: "#23863633", fg: "#3fb950", bar: "#3fb950" };
  if (s === "connecting") return { bg: "#bb800926", fg: "#e6c06a", bar: "#e6c06a" };
  return { bg: "#30363d", fg: "#8b949e", bar: "#484f58" };
}

type ErroCtx = { titulo: string; detalhes: string[] };
type VerificacaoTempoReal = {
  status: "connected" | "connecting" | "disconnected";
  fonte: "uazapi" | "erro";
  authFailed?: boolean;
};

function formatarDataHoraPtBr(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function montarErroDoCorpo(data: Record<string, unknown>, status: number): ErroCtx {
  const titulo =
    typeof data.error === "string" && data.error.trim()
      ? data.error.trim()
      : `Erro HTTP ${status}`;
  const detalhes: string[] = [];
  if (typeof data.detail === "string" && data.detail.trim()) detalhes.push(data.detail.trim());

  const ur = data.uazapi_request;
  if (ur && typeof ur === "object" && ur !== null) {
    const o = ur as Record<string, unknown>;
    if (typeof o.origin === "string" && typeof o.pathname === "string") {
      detalhes.push(`Pedido externo: ${o.origin}${o.pathname}`);
    }
  }

  if (status === 404) {
    detalhes.push(
      "404 costuma indicar URL base errada na UAZAPI ou rota do Hub inacessível. Confirme UAZAPI_BASE_URL (ex.: https://subdominio.uazapi.com, sem /api no fim) e reinicie o servidor Next.js."
    );
  }
  return { titulo, detalhes };
}

async function lerCorpoApi(res: Response): Promise<Record<string, unknown>> {
  const raw = await res.text();
  if (!raw.trim()) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
  } catch {
    const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 380);
    return { error: snippet || `Resposta não JSON (HTTP ${res.status})` };
  }
}

export function AgenteUazapiBlock({ agenteSlug, snapshot, onRefresh, bloqueado = false }: AgenteUazapiBlockProps) {
  const [phonePair, setPhonePair] = useState("");
  const [proxyCity, setProxyCity] = useState("");
  const [proxyState, setProxyState] = useState("");
  const [cidadesProxy, setCidadesProxy] = useState<CidadeProxyUazapi[]>([]);
  const [cidadesProxyErro, setCidadesProxyErro] = useState<string | null>(null);
  const [proxyAviso, setProxyAviso] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<ErroCtx | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [paircode, setPaircode] = useState<string | null>(null);
  const [statusTempoReal, setStatusTempoReal] = useState<VerificacaoTempoReal | null>(null);
  const [webhookAviso, setWebhookAviso] = useState<string | null>(null);
  const [ultimaVerificacaoAt, setUltimaVerificacaoAt] = useState<string | null>(null);
  const [ultimaVerificacaoResultado, setUltimaVerificacaoResultado] = useState<"sucesso" | "erro" | null>(null);
  const [dialogExcluirUazapi, setDialogExcluirUazapi] = useState(false);

  const statusExibido = statusTempoReal?.status ?? snapshot.uazapi_connection_status ?? "—";
  const temInstancia = Boolean(snapshot.uazapi_instance_id?.trim());
  const badge = badgeCor(statusExibido);
  const acoesOff = loading !== null || bloqueado;

  const rotuloEstado = useMemo(() => {
    if (statusTempoReal?.authFailed) return "TOKEN INVÁLIDO";
    if (temInstancia) return String(statusExibido).toUpperCase();
    return "SEM INSTÂNCIA";
  }, [temInstancia, statusExibido, statusTempoReal]);

  useEffect(() => {
    setStatusTempoReal(null);
    setUltimaVerificacaoAt(null);
    setUltimaVerificacaoResultado(null);
  }, [snapshot.uazapi_instance_id, snapshot.uazapi_connection_status]);

  useEffect(() => {
    setProxyCity(snapshot.uazapi_proxy_city?.trim() || "");
    setProxyState(snapshot.uazapi_proxy_state?.trim() || "");
  }, [snapshot.uazapi_proxy_city, snapshot.uazapi_proxy_state]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/uazapi`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...internalApiHeaders() },
          body: JSON.stringify({ action: "list_proxy_cities", proxy_managed_country: "br" }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setCidadesProxyErro(typeof data.error === "string" ? data.error : "Não foi possível carregar cidades.");
          return;
        }
        const raw = Array.isArray(data.cities) ? data.cities : [];
        const parsed: CidadeProxyUazapi[] = [];
        for (const c of raw) {
          if (!c || typeof c !== "object") continue;
          const o = c as Record<string, unknown>;
          const value = typeof o.value === "string" ? o.value.trim() : "";
          const label = typeof o.label === "string" ? o.label.trim() : value;
          if (!value) continue;
          parsed.push({
            value,
            label: label || value,
            state: typeof o.state === "string" ? o.state.trim() : undefined,
          });
        }
        parsed.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
        setCidadesProxy(parsed);
        setCidadesProxyErro(null);
      } catch {
        if (!cancelled) setCidadesProxyErro("Falha de rede ao carregar cidades UAZAPI.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agenteSlug]);

  const proxyConnectExtra = useCallback((): Record<string, unknown> => {
    const extra: Record<string, unknown> = { proxy_managed_country: "br" };
    const city = proxyCity.trim().toLowerCase();
    const state = proxyState.trim().toLowerCase();
    if (city) {
      extra.proxy_managed_city = city;
      if (state) extra.proxy_managed_state = state;
    }
    return extra;
  }, [proxyCity, proxyState]);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const postAction = useCallback(
    async (
      action: string,
      extra?: Record<string, unknown>,
      opts?: { silent?: boolean }
    ) => {
      if (!opts?.silent) {
        setErr(null);
        setWebhookAviso(null);
        setProxyAviso(null);
        setLoading(action);
      }
      try {
        const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/uazapi`, {
          method: "POST",
          headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        });
        const data = await lerCorpoApi(res);
        if (!res.ok) {
          setUltimaVerificacaoAt(new Date().toISOString());
          setUltimaVerificacaoResultado("erro");
          const hintedStatus =
            typeof data.uazapi_connection_status === "string" ? data.uazapi_connection_status.toLowerCase() : "";
          const hintedStatusNorm =
            hintedStatus === "connected" || hintedStatus === "connecting" || hintedStatus === "disconnected"
              ? hintedStatus
              : null;
          const authFailed = data.uazapi_auth_failed === true;
          if (hintedStatusNorm) {
            setStatusTempoReal({
              status: hintedStatusNorm,
              fonte: "erro",
              ...(authFailed ? { authFailed: true } : {}),
            });
          } else if (authFailed && temInstancia) {
            setStatusTempoReal({ status: "disconnected", fonte: "erro", authFailed: true });
          }
          if (!opts?.silent) {
            setErr(montarErroDoCorpo(data, res.status));
            if (action === "connect" || action === "status") {
              setQrcode(null);
              setPaircode(null);
            }
          }
          return data;
        }
        if (typeof data.qrcode === "string" && data.qrcode.trim()) {
          setQrcode(normalizarSrcImagemQrUazapi(data.qrcode));
        } else if (action === "connect" || action === "status") {
          setQrcode(null);
        }
        if (typeof data.paircode === "string" && data.paircode.trim()) {
          setPaircode(data.paircode.trim());
        } else if (action === "connect") {
          setPaircode(null);
        }
        if (action === "delete_remote") {
          setQrcode(null);
          setPaircode(null);
        }
        if (action === "disconnect") {
          setQrcode(null);
          setPaircode(null);
        }
        const nextStatusRaw =
          typeof data.uazapi_connection_status === "string" ? data.uazapi_connection_status.toLowerCase() : "";
        if (
          nextStatusRaw === "connected" ||
          nextStatusRaw === "connecting" ||
          nextStatusRaw === "disconnected"
        ) {
          setStatusTempoReal({ status: nextStatusRaw, fonte: "uazapi" });
        } else {
          setStatusTempoReal(null);
        }
        setUltimaVerificacaoAt(new Date().toISOString());
        setUltimaVerificacaoResultado("sucesso");
        if (typeof data.webhook_warning === "string" && data.webhook_warning.trim()) {
          setWebhookAviso(data.webhook_warning.trim());
        }
        if (typeof data.proxy_warning === "string" && data.proxy_warning.trim()) {
          setProxyAviso(data.proxy_warning.trim());
        } else if (
          data.webhook_sync &&
          typeof data.webhook_sync === "object" &&
          (data.webhook_sync as { instance?: boolean }).instance === true
        ) {
          setWebhookAviso(
            "Webhook UAZAPI sincronizado (URL com segredo, filtros wasSentByApi + isGroupYes). Envie uma mensagem de teste."
          );
        }
        const prevStatus = (snapshot.uazapi_connection_status || "").toLowerCase();
        const deveSincronizarPai =
          !opts?.silent ||
          (nextStatusRaw === "connected" && prevStatus !== "connected");
        if (deveSincronizarPai) {
          await onRefreshRef.current();
        }
        return data;
      } catch {
        if (!opts?.silent) {
          setErr({
            titulo: "Falha de rede ao falar com o servidor.",
            detalhes: ["Verifique a ligação e se o servidor Next.js está a correr."],
          });
        }
        return null;
      } finally {
        if (!opts?.silent) setLoading(null);
      }
    },
    [agenteSlug, snapshot.uazapi_connection_status, temInstancia]
  );

  const postActionRef = useRef(postAction);
  postActionRef.current = postAction;

  const syncPollRef = useRef(0);
  useEffect(() => {
    if (!temInstancia) return;
    const s = (snapshot.uazapi_connection_status || "").toLowerCase();
    if (s === "connected") return;

    void postActionRef.current("status", undefined, { silent: true });

    if (s !== "connecting") return;

    syncPollRef.current += 1;
    const gen = syncPollRef.current;
    const id = window.setInterval(() => {
      if (gen !== syncPollRef.current) return;
      void postActionRef.current("status", undefined, { silent: true });
    }, 6000);

    return () => {
      syncPollRef.current += 1;
      window.clearInterval(id);
    };
  }, [temInstancia, snapshot.uazapi_instance_id, snapshot.uazapi_connection_status]);

  const btnBase = (disabled: boolean, primario?: boolean): CSSProperties =>
    ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "10px 14px",
      borderRadius: 9,
      fontSize: 12,
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      border: primario ? "1px solid #58a6ff" : "1px solid #30363d",
      background: disabled ? "#161b22" : primario ? "#1f6feb22" : "#21262d",
      color: disabled ? "#484f58" : primario ? "#58a6ff" : "#e6edf3",
      boxShadow: primario && !disabled ? "inset 0 1px 0 rgba(255,255,255,0.06)" : undefined,
      transition: "background 0.15s, border-color 0.15s, opacity 0.15s",
      minHeight: 40,
    }) as CSSProperties;

  const mostrarQr =
    qrcode && (qrcode.startsWith("data:image") || /^https?:\/\//i.test(qrcode));

  return (
    <div
      style={{
        marginBottom: 18,
        borderRadius: 14,
        border: "1px solid #30363d",
        background: "linear-gradient(180deg, #151a22 0%, #0d1117 48px, #0d1117 100%)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 3,
          background: "linear-gradient(90deg, #25d366, #128c7e, #1f6feb)",
          opacity: 0.95,
        }}
        aria-hidden
      />

      <div style={{ padding: "16px 18px 18px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 14,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(145deg, #25d36633, #128c7e18)",
                border: "1px solid #25d36644",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <MessageCircle size={22} style={{ color: "#25d366" }} aria-hidden />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, color: "#e6edf3", fontSize: 14, fontWeight: 800, letterSpacing: 0.02 }}>
                WhatsApp
              </p>
              <p style={{ margin: "4px 0 0", color: "#8b949e", fontSize: 12, lineHeight: 1.5 }}>
                Linha dedicada a este agente. Só mensagens com instância{" "}
                <strong style={{ color: "#c9d1d9" }}>connected</strong> disparam a IA neste número.
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: mostrarQr ? "minmax(0,1fr) minmax(0,260px)" : "1fr",
            gap: 18,
            alignItems: "start",
          }}
        >
          <div>
            <div
              style={{
                position: "relative",
                padding: "14px 16px",
                borderRadius: 12,
                background: "#161b22",
                border: "1px solid #30363d",
                marginBottom: 16,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 10,
                  bottom: 10,
                  width: 3,
                  borderRadius: "0 4px 4px 0",
                  background: badge.bar,
                }}
                aria-hidden
              />
              <div style={{ paddingLeft: 12, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <span
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.04,
                    background: badge.bg,
                    color: badge.fg,
                  }}
                >
                  {rotuloEstado}
                </span>
                {ultimaVerificacaoAt ? (
                  <span
                    title={`Última verificação em tempo real: ${formatarDataHoraPtBr(ultimaVerificacaoAt)}`}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.03,
                      border: `1px solid ${
                        ultimaVerificacaoResultado === "erro" ? "#f8514955" : "#1f6feb55"
                      }`,
                      background: ultimaVerificacaoResultado === "erro" ? "#f8514914" : "#1f6feb1a",
                      color: ultimaVerificacaoResultado === "erro" ? "#ff7b72" : "#79c0ff",
                    }}
                  >
                    {ultimaVerificacaoResultado === "erro" ? "Últ. verificação: erro" : "Últ. verificação: ok"} ·{" "}
                    {formatarDataHoraPtBr(ultimaVerificacaoAt)}
                  </span>
                ) : null}
                {temInstancia ? (
                  <div style={{ fontSize: 12, color: "#8b949e" }}>
                    <span style={{ display: "block", fontWeight: 600, color: "#aebccf", marginBottom: 2 }}>Instância</span>
                    <code style={{ color: "#e6edf3", fontSize: 11 }}>{snapshot.uazapi_instance_id}</code>
                    {snapshot.uazapi_instance_name ? (
                      <span style={{ marginLeft: 8, color: "#6e7681" }}>
                        ({snapshot.uazapi_instance_name})
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span style={{ color: "#8b949e", fontSize: 12 }}>
                    Ainda não há instância no painel UAZAPI — use <strong style={{ color: "#c9d1d9" }}>Criar instância</strong>.
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #30363d",
                background: "#0d1117",
                marginBottom: 16,
              }}
            >
              <p style={{ margin: 0, color: "#6e7781", fontSize: 11, fontWeight: 700, letterSpacing: 0.06 }}>
                CONFIGURAÇÃO
              </p>
              <p style={{ margin: "8px 0 0", color: "#8b949e", fontSize: 12, lineHeight: 1.55 }}>
                Webhook (global + instância):{" "}
                <code style={{ fontSize: 11, color: "#79c0ff" }}>/api/whatsapp/webhook?wh=…</code>. Use{" "}
                <strong style={{ color: "#c9d1d9" }}>Actualizar estado</strong> ou{" "}
                <strong style={{ color: "#c9d1d9" }}>Sincronizar webhook</strong> para alinhar o painel UAZAPI.
              </p>
              <p style={{ margin: "8px 0 0", color: "#e6c06a", fontSize: 11, lineHeight: 1.5 }}>
                Em <strong>Excluir eventos</strong>, use <code style={{ color: "#79c0ff" }}>wasSentByApi</code> e{" "}
                <code style={{ color: "#79c0ff" }}>isGroupYes</code>.{" "}
                <strong>Não use wasNotSentByApi</strong> — bloqueia mensagens dos clientes e o Render não recebe POST.
              </p>
              <p style={{ margin: "8px 0 0", color: "#79c0ff", fontSize: 11, lineHeight: 1.5 }}>
                Cada agente tem a <strong>sua cidade de proxy</strong> (região do número). Guarde antes do QR. O{" "}
                <code style={{ color: "#79c0ff" }}>WEBHOOK_SECRET</code> no Render protege o endpoint; é independente da cidade.
              </p>
            </div>

            {proxyAviso ? (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #bb800966",
                  background: "#bb80091a",
                  marginBottom: 16,
                  fontSize: 12,
                  color: "#e6c06a",
                  lineHeight: 1.5,
                }}
              >
                {proxyAviso}
              </div>
            ) : null}

            {webhookAviso ? (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #238636",
                  background: "#23863618",
                  marginBottom: 16,
                  fontSize: 12,
                  color: "#7ee787",
                  lineHeight: 1.5,
                }}
              >
                {webhookAviso}
              </div>
            ) : null}

            {err ? (
              <div
                role="alert"
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #f8514966",
                  background: "#f851490d",
                  marginBottom: 16,
                }}
              >
                <AlertCircle size={20} style={{ color: "#f85149", flexShrink: 0, marginTop: 2 }} aria-hidden />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, color: "#ff7b72", fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{err.titulo}</p>
                  {err.detalhes.length ? (
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#e6c06a", fontSize: 12, lineHeight: 1.5 }}>
                      {err.detalhes.map((d, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          {d}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <button
                type="button"
                disabled={acoesOff || temInstancia}
                style={btnBase(acoesOff || temInstancia, true)}
                onClick={() => postAction("create")}
              >
                {loading === "create" ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
                Criar instância
              </button>

              <button
                type="button"
                disabled={acoesOff || !temInstancia}
                style={btnBase(acoesOff || !temInstancia)}
                onClick={() => {
                  const extra: Record<string, unknown> = { ...proxyConnectExtra() };
                  if (phonePair.trim().length >= 10) extra.phone = phonePair.replace(/\D/g, "");
                  postAction("connect", extra);
                }}
              >
                {loading === "connect" ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
                QR / pareamento
              </button>

              <button
                type="button"
                disabled={loading !== null || !temInstancia}
                style={btnBase(loading !== null || !temInstancia)}
                onClick={() => postAction("status")}
              >
                {loading === "status" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Actualizar estado
              </button>

              <button
                type="button"
                disabled={acoesOff || !temInstancia}
                style={btnBase(acoesOff || !temInstancia)}
                onClick={() => postAction("sync_webhook")}
              >
                {loading === "sync_webhook" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Sincronizar webhook
              </button>

              <button
                type="button"
                disabled={acoesOff || !temInstancia}
                style={btnBase(acoesOff || !temInstancia)}
                onClick={() => postAction("disconnect")}
              >
                {loading === "disconnect" ? <Loader2 size={15} className="animate-spin" /> : <Unplug size={15} />}
                Desligar sessão
              </button>

              <button
                type="button"
                disabled={acoesOff || !temInstancia}
                style={{
                  ...btnBase(acoesOff || !temInstancia),
                  borderColor: "#f8514966",
                  color: acoesOff || !temInstancia ? "#484f58" : "#f85149",
                  gridColumn: "1 / -1",
                }}
                onClick={() => setDialogExcluirUazapi(true)}
              >
                {loading === "delete_remote" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Eliminar na UAZAPI
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 12,
                marginBottom: 4,
              }}
            >
              <div>
                <label style={{ display: "block", color: "#8b949e", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                  Cidade do proxy (região do número — por agente)
                </label>
                <select
                  value={proxyCity}
                  onChange={(e) => {
                    const v = e.target.value;
                    setProxyCity(v);
                    const found = cidadesProxy.find((c) => c.value === v);
                    if (found?.state) setProxyState(found.state);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 9,
                    border: "1px solid #30363d",
                    background: "#0d1117",
                    color: "#e6edf3",
                    fontSize: 13,
                  }}
                >
                  <option value="">— Selecione a cidade —</option>
                  {cidadesProxy.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                      {c.state ? ` (${c.state.toUpperCase()})` : ""}
                    </option>
                  ))}
                </select>
                {cidadesProxyErro ? (
                  <p style={{ margin: "6px 0 0", color: "#f85149", fontSize: 11 }}>{cidadesProxyErro}</p>
                ) : null}
                {proxyState ? (
                  <p style={{ margin: "6px 0 0", color: "#6e7781", fontSize: 11 }}>
                    Estado: <strong style={{ color: "#8b949e" }}>{proxyState.toUpperCase()}</strong>
                  </p>
                ) : null}
              </div>
              <div>
                <button
                  type="button"
                  disabled={acoesOff || !proxyCity.trim()}
                  style={btnBase(acoesOff || !proxyCity.trim())}
                  onClick={() => postAction("save_proxy", proxyConnectExtra())}
                >
                  {loading === "save_proxy" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <RefreshCw size={15} />
                  )}
                  Guardar região
                </button>
              </div>
              <div>
                <label style={{ display: "block", color: "#8b949e", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                  Telefone (opcional, pareamento por código)
                </label>
                <input
                  value={phonePair}
                  onChange={(e) => setPhonePair(e.target.value)}
                  placeholder="Vazio = só QR"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 9,
                    border: "1px solid #30363d",
                    background: "#0d1117",
                    color: "#e6edf3",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            {paircode ? (
              <p style={{ color: "#e6c06a", fontSize: 14, fontWeight: 700, margin: "14px 0 0", letterSpacing: 0.02 }}>
                Código: {paircode}
              </p>
            ) : null}
          </div>

          {mostrarQr ? (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                border: "1px solid #30363d",
                background: "#161b22",
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 10px", color: "#8b949e", fontSize: 11, fontWeight: 700 }}>QR WHATSAPP</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="QR WhatsApp"
                src={qrcode!}
                style={{
                  maxWidth: "100%",
                  width: 240,
                  height: "auto",
                  borderRadius: 10,
                  border: "1px solid #30363d",
                  margin: "0 auto",
                  display: "block",
                }}
              />
            </div>
          ) : null}
        </div>
      </div>

      <CrmConfirmDialog
        open={dialogExcluirUazapi}
        title="Eliminar instância na UAZAPI?"
        danger
        confirmLabel="Eliminar definitivamente"
        cancelLabel="Cancelar"
        loading={loading === "delete_remote"}
        onCancel={() => !loading && setDialogExcluirUazapi(false)}
        onConfirm={() => {
          setDialogExcluirUazapi(false);
          void postAction("delete_remote");
        }}
      >
        <p style={{ margin: 0, color: "#9cb0c9", fontSize: 13, lineHeight: 1.55 }}>
          A instância WhatsApp será removida no painel UAZAPI e a ligação deste agente no Hub será limpa. Pode criar
          uma nova instância depois com <strong style={{ color: "#e6edf3" }}>Criar instância</strong>.
        </p>
        <p style={{ margin: "10px 0 0", color: "#b3261e", fontWeight: 600, fontSize: 12 }}>
          Esta operação não pode ser desfeita na UAZAPI.
        </p>
      </CrmConfirmDialog>
    </div>
  );
}
