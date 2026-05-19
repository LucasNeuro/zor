"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  Unplug,
  X,
} from "lucide-react";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { normalizarSrcImagemQrUazapi } from "@/lib/whatsapp/qr-uazapi";

/** UAZAPI: QR expira em ~2 min (doc OpenAPI). */
const UAZAPI_QR_VALID_MS = 120_000;

function formatarContagemQr(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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
  /** Atualiza só campos UAZAPI no pai (sem recarregar a página). */
  onSnapshotPatch?: (patch: Partial<AgenteUazapiSnapshot>) => void;
  /** Fallback legado — evite na ficha do agente (provoca ecrã de carregamento). */
  onRefresh?: () => Promise<void> | void;
  /** Título do sideover (nome do agente). */
  agenteNome?: string;
  /** Enquanto o wizard grava modo_operacao no servidor (evita 409 na criação). */
  bloqueado?: boolean;
};

function AgenteUazapiSideoverShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Fechar painel WhatsApp"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          background: "rgba(0,0,0,0.55)",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(600px, 100vw)",
          zIndex: 100,
          background: "#0f1620",
          borderLeft: "1px solid #2d394b",
          boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <header
          style={{
            borderBottom: "1px solid #2d394b",
            padding: 16,
            background: "linear-gradient(180deg,#121a26 0%, #101722 100%)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, color: "#8ea1ba", fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                WHATSAPP · UAZAPI
              </p>
              <h2 style={{ margin: "4px 0 0", color: "#e6edf3", fontSize: 17, fontWeight: 800 }}>{title}</h2>
              {subtitle ? (
                <p style={{ margin: "6px 0 0", color: "#8b949e", fontSize: 12, lineHeight: 1.45 }}>{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1px solid #30363d",
                background: "#21262d",
                color: "#8b949e",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="panel-scroll" style={{ flex: 1, overflowY: "auto", padding: 16, minHeight: 0 }}>
          {children}
        </div>
        <div
          style={{
            flexShrink: 0,
            borderTop: "1px solid #2d394b",
            padding: "14px 18px 18px",
            background: "rgba(6, 10, 16, 0.92)",
          }}
        >
          {footer}
        </div>
      </aside>
    </>
  );
}

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

const ACOES_COM_PATCH_PAI = new Set(["create", "save_proxy", "delete_remote", "disconnect"]);

function patchUazapiDoCorpo(
  data: Record<string, unknown>,
  action: string
): Partial<AgenteUazapiSnapshot> | null {
  if (action === "delete_remote") {
    return {
      uazapi_instance_id: null,
      uazapi_instance_name: null,
      uazapi_connection_status: null,
      uazapi_has_instance_token: false,
      uazapi_proxy_country: null,
      uazapi_proxy_state: null,
      uazapi_proxy_city: null,
    };
  }

  const patch: Partial<AgenteUazapiSnapshot> = {};
  let has = false;

  if (typeof data.uazapi_instance_id === "string" && data.uazapi_instance_id.trim()) {
    patch.uazapi_instance_id = data.uazapi_instance_id.trim();
    has = true;
  }
  if (typeof data.uazapi_instance_name === "string") {
    patch.uazapi_instance_name = data.uazapi_instance_name.trim() || null;
    has = true;
  }
  if (typeof data.uazapi_connection_status === "string") {
    patch.uazapi_connection_status = data.uazapi_connection_status;
    has = true;
  }
  if (data.uazapi_has_instance_token === true) {
    patch.uazapi_has_instance_token = true;
    has = true;
  }
  if (typeof data.uazapi_proxy_country === "string") {
    patch.uazapi_proxy_country = data.uazapi_proxy_country;
    has = true;
  }
  if (data.uazapi_proxy_state === "string" || data.uazapi_proxy_state === null) {
    patch.uazapi_proxy_state =
      typeof data.uazapi_proxy_state === "string" ? data.uazapi_proxy_state : null;
    has = true;
  }
  if (typeof data.uazapi_proxy_city === "string") {
    patch.uazapi_proxy_city = data.uazapi_proxy_city;
    has = true;
  }

  if (action === "create" && has) {
    patch.uazapi_has_instance_token = true;
  }

  return has ? patch : null;
}

export function AgenteUazapiBlock({
  agenteSlug,
  snapshot,
  onSnapshotPatch,
  onRefresh,
  agenteNome,
  bloqueado = false,
}: AgenteUazapiBlockProps) {
  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [proxyCity, setProxyCity] = useState("");
  const [proxyState, setProxyState] = useState("");
  const [cidadesProxy, setCidadesProxy] = useState<CidadeProxyUazapi[]>([]);
  const [cidadesProxyErro, setCidadesProxyErro] = useState<string | null>(null);
  const [proxyAviso, setProxyAviso] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<ErroCtx | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [qrGeradoEm, setQrGeradoEm] = useState<number | null>(null);
  const [qrExpiradoUi, setQrExpiradoUi] = useState(false);
  const [qrRelogio, setQrRelogio] = useState(0);
  const [uazapiDiag, setUazapiDiag] = useState<{
    lastDisconnectReason?: string;
    connectHint?: string;
  } | null>(null);
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

  const regiaoGuardada = (snapshot.uazapi_proxy_city?.trim() || proxyCity.trim()).toLowerCase();
  const regiaoLabel = useMemo(() => {
    if (!regiaoGuardada) return null;
    const found = cidadesProxy.find((c) => c.value.toLowerCase() === regiaoGuardada);
    return found?.label || regiaoGuardada;
  }, [regiaoGuardada, cidadesProxy]);

  useEffect(() => {
    setStatusTempoReal(null);
    setUltimaVerificacaoAt(null);
    setUltimaVerificacaoResultado(null);
  }, [snapshot.uazapi_instance_id, snapshot.uazapi_connection_status]);

  useEffect(() => {
    setProxyCity(snapshot.uazapi_proxy_city?.trim() || "");
    setProxyState(snapshot.uazapi_proxy_state?.trim() || "");
  }, [snapshot.uazapi_proxy_city, snapshot.uazapi_proxy_state]);

  const carregarCidadesProxy = useCallback(async () => {
    setCidadesProxyErro(null);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/uazapi`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ action: "list_proxy_cities", proxy_managed_country: "br" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : typeof data.detail === "string"
              ? data.detail
              : "Não foi possível carregar cidades.";
        setCidadesProxyErro(msg);
        setCidadesProxy([]);
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
      if (parsed.length === 0) {
        setCidadesProxyErro("A UAZAPI não devolveu cidades para o Brasil. Tente de novo ou confira o painel.");
      } else {
        setCidadesProxyErro(null);
      }
    } catch {
      setCidadesProxyErro("Falha de rede ao carregar cidades UAZAPI.");
      setCidadesProxy([]);
    }
  }, [agenteSlug]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    void carregarCidadesProxy();
  }, [carregarCidadesProxy, snapshot.uazapi_instance_id, snapshot.uazapi_has_instance_token]);

  useEffect(() => {
    if (!sideoverOpen) return;
    void carregarCidadesProxy();
  }, [sideoverOpen, carregarCidadesProxy]);

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

  const onSnapshotPatchRef = useRef(onSnapshotPatch);
  onSnapshotPatchRef.current = onSnapshotPatch;

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const carregarCidadesProxyRef = useRef(carregarCidadesProxy);
  carregarCidadesProxyRef.current = carregarCidadesProxy;

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
            }
          }
          return data;
        }
        if (data.qr_invalid === true) {
          setQrcode(null);
          setQrGeradoEm(null);
          if (!opts?.silent) {
            setErr({
              titulo: "QR inválido",
              detalhes: [
                typeof data.connect_hint === "string" && data.connect_hint.trim()
                  ? data.connect_hint.trim()
                  : "A UAZAPI não devolveu uma imagem QR válida. Desligue a sessão, guarde a região e gere outro código.",
              ],
            });
          }
        } else if (typeof data.qrcode === "string" && data.qrcode.trim()) {
          const norm = normalizarSrcImagemQrUazapi(data.qrcode);
          if (norm) {
            setQrcode(norm);
            if (action === "connect") {
              setQrGeradoEm(Date.now());
              setQrExpiradoUi(false);
            }
          } else if (!opts?.silent && action === "connect") {
            setQrcode(null);
            setQrGeradoEm(null);
            setErr({
              titulo: "QR inválido",
              detalhes: ["O servidor enviou um QR que não é uma imagem PNG/JPEG válida. Gere outro código."],
            });
          }
        } else if (!opts?.silent && (action === "connect" || action === "status")) {
          setQrcode(null);
          setQrGeradoEm(null);
        }

        const lastReason =
          typeof data.lastDisconnectReason === "string" ? data.lastDisconnectReason.trim() : "";
        const connectHint =
          typeof data.connect_hint === "string" ? data.connect_hint.trim() : "";
        if (lastReason || connectHint) {
          setUazapiDiag({
            ...(lastReason ? { lastDisconnectReason: lastReason } : {}),
            ...(connectHint ? { connectHint } : {}),
          });
        } else if (action === "connect" && !opts?.silent) {
          setUazapiDiag(null);
        }
        if (action === "delete_remote") {
          setQrcode(null);
        }
        if (action === "disconnect") {
          setQrcode(null);
          setQrGeradoEm(null);
          setQrExpiradoUi(false);
          setUazapiDiag(null);
        }
        if (action === "connect" && typeof data.qrcode === "string" && data.qrcode.trim()) {
          setSideoverOpen(true);
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
        if (nextStatusRaw === "connected") {
          setQrcode(null);
          setQrGeradoEm(null);
          setQrExpiradoUi(false);
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
        if (!opts?.silent) {
          if (ACOES_COM_PATCH_PAI.has(action) && onSnapshotPatchRef.current) {
            const patch = patchUazapiDoCorpo(data, action);
            if (patch) onSnapshotPatchRef.current(patch);
          } else if (!onSnapshotPatchRef.current && onRefreshRef.current) {
            await onRefreshRef.current();
          }
        }
        if (action === "create") {
          void carregarCidadesProxyRef.current();
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
    [agenteSlug, temInstancia]
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

  const fieldStyle: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 9,
    border: "1px solid #30363d",
    background: "#0d1117",
    color: "#e6edf3",
    fontSize: 13,
    boxSizing: "border-box",
  };

  const btnBase = (disabled: boolean, variant: "default" | "primary" | "danger" = "default"): CSSProperties => {
    const base: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "9px 14px",
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      minHeight: 38,
      whiteSpace: "nowrap",
    };
    if (variant === "primary") {
      return {
        ...base,
        border: "1px solid #58a6ff",
        background: disabled ? "#161b22" : "#1f6feb22",
        color: disabled ? "#484f58" : "#58a6ff",
      };
    }
    if (variant === "danger") {
      return {
        ...base,
        border: "1px solid #f8514966",
        background: disabled ? "#161b22" : "#f8514910",
        color: disabled ? "#484f58" : "#f85149",
      };
    }
    return {
      ...base,
      border: "1px solid #30363d",
      background: disabled ? "#161b22" : "#21262d",
      color: disabled ? "#484f58" : "#e6edf3",
    };
  };

  const btnGroupShell: CSSProperties = {
    display: "grid",
    borderRadius: 10,
    border: "1px solid #30363d",
    overflow: "hidden",
    background: "#161b22",
  };

  const btnInGroup = (
    disabled: boolean,
    variant: "default" | "primary" | "danger",
    withRightDivider: boolean
  ): CSSProperties => {
    const b = btnBase(disabled, variant);
    return {
      ...b,
      width: "100%",
      minHeight: 42,
      borderRadius: 0,
      border: "none",
      borderRight: withRightDivider ? "1px solid #30363d" : undefined,
      boxShadow: "none",
    };
  };

  const mostrarQr =
    qrcode && (qrcode.startsWith("data:image") || /^https?:\/\//i.test(qrcode));

  useEffect(() => {
    if (!qrGeradoEm || !qrcode) return;
    const id = window.setInterval(() => setQrRelogio((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [qrGeradoEm, qrcode]);

  useEffect(() => {
    if (!qrGeradoEm || !qrcode) return;
    const restante = UAZAPI_QR_VALID_MS - (Date.now() - qrGeradoEm);
    if (restante <= 0) {
      setQrcode(null);
      setQrExpiradoUi(true);
      return;
    }
    const t = window.setTimeout(() => {
      setQrcode(null);
      setQrExpiradoUi(true);
    }, restante);
    return () => window.clearTimeout(t);
  }, [qrGeradoEm, qrcode]);

  const qrRestanteMs =
    qrGeradoEm != null ? UAZAPI_QR_VALID_MS - (Date.now() - qrGeradoEm) : null;
  void qrRelogio;
  const qrSegundosRestantes =
    qrRestanteMs != null ? Math.max(0, Math.ceil(qrRestanteMs / 1000)) : null;
  const qrExpirado =
    qrExpiradoUi || (qrGeradoEm != null && (qrRestanteMs ?? 0) <= 0);
  const mostrarQrAtivo = Boolean(mostrarQr && !qrExpirado);
  const precisaReconectar =
    temInstancia &&
    String(statusExibido).toLowerCase() !== "connected" &&
    (qrExpirado || (String(statusExibido).toLowerCase() === "connecting" && !mostrarQrAtivo));

  const reconectarWhatsApp = useCallback(() => {
    void postAction("connect", { ...proxyConnectExtra(), reset_session: true });
  }, [postAction, proxyConnectExtra]);

  const botoesFooter = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: 0, color: "#6e7681", fontSize: 10, fontWeight: 700, letterSpacing: 0.06 }}>
        AÇÕES
      </p>
      <div style={{ ...btnGroupShell, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <button
          type="button"
          disabled={acoesOff || temInstancia}
          style={btnInGroup(acoesOff || temInstancia, "primary", true)}
          onClick={() => postAction("create")}
        >
          {loading === "create" ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
          Criar instância
        </button>
        <button
          type="button"
          disabled={acoesOff || !temInstancia || !regiaoGuardada}
          style={btnInGroup(acoesOff || !temInstancia || !regiaoGuardada, "primary", true)}
          onClick={() => reconectarWhatsApp()}
        >
          {loading === "connect" ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
          {precisaReconectar ? "Reconectar" : "Gerar QR"}
        </button>
        <button
          type="button"
          disabled={loading !== null || !temInstancia}
          style={btnInGroup(loading !== null || !temInstancia, "default", false)}
          onClick={() => postAction("status")}
        >
          {loading === "status" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Actualizar estado
        </button>
      </div>
      <div style={{ ...btnGroupShell, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <button
          type="button"
          disabled={acoesOff || !temInstancia}
          style={btnInGroup(acoesOff || !temInstancia, "default", true)}
          onClick={() => postAction("sync_webhook")}
        >
          {loading === "sync_webhook" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Sincronizar webhook
        </button>
        <button
          type="button"
          disabled={acoesOff || !temInstancia}
          style={btnInGroup(acoesOff || !temInstancia, "default", false)}
          onClick={() => postAction("disconnect")}
        >
          {loading === "disconnect" ? <Loader2 size={15} className="animate-spin" /> : <Unplug size={15} />}
          Desligar sessão
        </button>
      </div>
      {precisaReconectar ? (
        <button
          type="button"
          disabled={acoesOff || !regiaoGuardada}
          style={{
            ...btnBase(acoesOff || !regiaoGuardada, "primary"),
            width: "100%",
            minHeight: 44,
          }}
          onClick={() => reconectarWhatsApp()}
        >
          {loading === "connect" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Reconectar WhatsApp (novo QR)
        </button>
      ) : null}
      <button
        type="button"
        disabled={acoesOff || !temInstancia}
        style={{
          ...btnBase(acoesOff || !temInstancia, "danger"),
          width: "100%",
          minHeight: 42,
        }}
        onClick={() => setDialogExcluirUazapi(true)}
      >
        {loading === "delete_remote" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
        Eliminar na UAZAPI
      </button>
    </div>
  );

  return (
    <>
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
        <div style={{ padding: "14px 16px 16px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, minWidth: 0, alignItems: "center" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "linear-gradient(145deg, #25d36633, #128c7e18)",
                  border: "1px solid #25d36644",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <MessageCircle size={20} style={{ color: "#25d366" }} aria-hidden />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: "#e6edf3", fontSize: 14, fontWeight: 800 }}>WhatsApp</p>
                <p style={{ margin: "4px 0 0", color: "#8b949e", fontSize: 12, lineHeight: 1.45 }}>
                  Ligação por QR ·{" "}
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 800,
                      background: badge.bg,
                      color: badge.fg,
                    }}
                  >
                    {rotuloEstado}
                  </span>
                </p>
                <p style={{ margin: "6px 0 0", color: "#6e7681", fontSize: 11 }}>
                  {regiaoLabel ? (
                    <>
                      Região: <strong style={{ color: "#aebccf" }}>{regiaoLabel}</strong>
                    </>
                  ) : (
                    <span style={{ color: "#e6c06a" }}>Defina a região antes do QR</span>
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={bloqueado}
              onClick={() => setSideoverOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 14px",
                borderRadius: 8,
                border: "1px solid #58a6ff",
                background: bloqueado ? "#161b22" : "#1f6feb22",
                color: bloqueado ? "#484f58" : "#58a6ff",
                fontSize: 12,
                fontWeight: 700,
                cursor: bloqueado ? "not-allowed" : "pointer",
              }}
            >
              Configurar ligação
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <AgenteUazapiSideoverShell
        open={sideoverOpen}
        onClose={() => setSideoverOpen(false)}
        title={agenteNome?.trim() || agenteSlug}
        subtitle="Conexão só por QR. Guarde a cidade (proxy) antes de gerar o código."
        footer={botoesFooter}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              position: "relative",
              padding: "14px 16px",
              borderRadius: 12,
              background: "#161b22",
              border: "1px solid #30363d",
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
            <div style={{ paddingLeft: 12, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <span
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  background: badge.bg,
                  color: badge.fg,
                }}
              >
                {rotuloEstado}
              </span>
              {ultimaVerificacaoAt ? (
                <span style={{ fontSize: 10, color: "#8b949e" }}>
                  {ultimaVerificacaoResultado === "erro" ? "Últ. verificação: erro" : "Últ. verificação: ok"} ·{" "}
                  {formatarDataHoraPtBr(ultimaVerificacaoAt)}
                </span>
              ) : null}
            </div>
            {temInstancia ? (
              <p style={{ margin: "10px 0 0", paddingLeft: 12, fontSize: 11, color: "#8b949e" }}>
                Instância: <code style={{ color: "#e6edf3" }}>{snapshot.uazapi_instance_id}</code>
              </p>
            ) : (
              <p style={{ margin: "10px 0 0", paddingLeft: 12, fontSize: 12, color: "#8b949e" }}>
                Sem instância — use <strong style={{ color: "#c9d1d9" }}>Criar instância</strong> no rodapé.
              </p>
            )}
          </div>

          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid #30363d",
              background: "#161b22",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <p style={{ margin: 0, color: "#8b949e", fontSize: 11, fontWeight: 700, letterSpacing: 0.06 }}>
                REGIÃO DO NÚMERO (PROXY)
              </p>
              <button
                type="button"
                onClick={() => void carregarCidadesProxy()}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#58a6ff",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <RefreshCw size={12} aria-hidden />
                Actualizar lista
              </button>
            </div>
            <label style={{ display: "block", color: "#8b949e", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
              Cidade
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 10,
                alignItems: "start",
              }}
            >
              <select
                  value={proxyCity}
                  onChange={(e) => {
                    const v = e.target.value;
                    setProxyCity(v);
                    const found = cidadesProxy.find((c) => c.value === v);
                    if (found?.state) setProxyState(found.state);
                  }}
                  style={fieldStyle}
                >
                  <option value="">— Selecione a cidade —</option>
                  {cidadesProxy.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                      {c.state ? ` (${c.state.toUpperCase()})` : ""}
                    </option>
                  ))}
                </select>
              <button
                type="button"
                disabled={acoesOff || !proxyCity.trim()}
                style={{
                  ...btnBase(acoesOff || !proxyCity.trim(), "primary"),
                  whiteSpace: "nowrap",
                  minHeight: 42,
                  alignSelf: "start",
                }}
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
            {cidadesProxyErro ? (
              <p style={{ margin: "8px 0 0", color: "#f85149", fontSize: 11 }}>{cidadesProxyErro}</p>
            ) : null}
            {proxyState ? (
              <p style={{ margin: "6px 0 0", color: "#6e7781", fontSize: 11 }}>
                Estado: <strong style={{ color: "#8b949e" }}>{proxyState.toUpperCase()}</strong>
              </p>
            ) : null}
          </div>

          {mostrarQrAtivo ? (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                border: "1px solid #30363d",
                background: "#161b22",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                  gap: 8,
                }}
              >
                <p style={{ margin: 0, color: "#8b949e", fontSize: 11, fontWeight: 700 }}>QR WHATSAPP</p>
                {qrSegundosRestantes != null && qrSegundosRestantes > 0 ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: qrSegundosRestantes <= 30 ? "#f85149" : "#58a6ff",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    Expira em {formatarContagemQr(qrSegundosRestantes)}
                  </span>
                ) : null}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="QR WhatsApp"
                src={qrcode!}
                style={{
                  maxWidth: "100%",
                  width: 260,
                  height: "auto",
                  borderRadius: 10,
                  border: "1px solid #30363d",
                  margin: "0 auto",
                  display: "block",
                }}
              />
              <p style={{ margin: "12px 0 0", color: "#8b949e", fontSize: 11, lineHeight: 1.5 }}>
                WhatsApp → Aparelhos ligados → Ligar com QR. Quando o tempo acabar, use{" "}
                <strong style={{ color: "#e6edf3" }}>Reconectar</strong>.
              </p>
            </div>
          ) : null}

          {precisaReconectar ? (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                border: "1px solid #f8514966",
                background: "rgba(248, 81, 73, 0.08)",
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 8px", color: "#f85149", fontSize: 12, fontWeight: 800 }}>
                QR EXPIRADO OU SESSÃO PENDENTE
              </p>
              <p style={{ margin: "0 0 14px", color: "#8b949e", fontSize: 11, lineHeight: 1.55 }}>
                O código anterior já não serve. Só funciona após gerar um <strong style={{ color: "#e6edf3" }}>novo QR</strong>{" "}
                (o antigo deixa de ligar).
              </p>
              <button
                type="button"
                disabled={acoesOff || !regiaoGuardada}
                style={{ ...btnBase(acoesOff || !regiaoGuardada, "primary"), width: "100%" }}
                onClick={() => reconectarWhatsApp()}
              >
                {loading === "connect" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <RefreshCw size={15} />
                )}
                Reconectar WhatsApp
              </button>
            </div>
          ) : null}

          {uazapiDiag?.lastDisconnectReason ? (
            <p style={{ margin: 0, color: "#f85149", fontSize: 11, lineHeight: 1.5 }}>
              Última desconexão UAZAPI: <strong>{uazapiDiag.lastDisconnectReason}</strong>
            </p>
          ) : null}
          {uazapiDiag?.connectHint ? (
            <p style={{ margin: 0, color: "#e6c06a", fontSize: 11, lineHeight: 1.5 }}>{uazapiDiag.connectHint}</p>
          ) : null}

          <details
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #30363d",
              background: "#0d1117",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                color: "#8b949e",
                fontSize: 12,
                fontWeight: 700,
                listStyle: "none",
                userSelect: "none",
              }}
            >
              Dicas de webhook
            </summary>
            <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.55, color: "#8b949e" }}>
              <p style={{ margin: 0 }}>
                <code style={{ fontSize: 11, color: "#79c0ff" }}>/api/whatsapp/webhook?wh=…</code>
              </p>
              <p style={{ margin: "8px 0 0", color: "#e6c06a", fontSize: 11 }}>
                Excluir: wasSentByApi e isGroupYes. Não use wasNotSentByApi.
              </p>
            </div>
          </details>

          {proxyAviso ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #bb800966",
                background: "#bb80091a",
                fontSize: 12,
                color: "#e6c06a",
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
                fontSize: 12,
                color: "#7ee787",
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
              }}
            >
              <AlertCircle size={20} style={{ color: "#f85149", flexShrink: 0 }} aria-hidden />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: "#ff7b72", fontSize: 13, fontWeight: 700 }}>{err.titulo}</p>
                {err.detalhes.length ? (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#e6c06a", fontSize: 12 }}>
                    {err.detalhes.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </AgenteUazapiSideoverShell>

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
          A instância WhatsApp será removida no painel UAZAPI e a ligação deste agente no Hub será limpa.
        </p>
        <p style={{ margin: "10px 0 0", color: "#b3261e", fontWeight: 600, fontSize: 12 }}>
          Esta operação não pode ser desfeita na UAZAPI.
        </p>
      </CrmConfirmDialog>
    </>
  );

}
