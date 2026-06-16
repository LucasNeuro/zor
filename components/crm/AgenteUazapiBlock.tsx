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
import { CRM_ACCENT, crmBtnPrimaryLg } from "@/lib/crm/crm-button-styles";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfCloseButtonStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { normalizarSrcImagemQrUazapi } from "@/lib/whatsapp/qr-uazapi";
import {
  formatUazapiDisconnectReasonForUi,
  isBenignUazapiDisconnectReason,
} from "@/lib/whatsapp/uazapi-connect-hints";
import {
  formatProxyCityDisplay,
  formatProxyCityLabel,
} from "@/lib/whatsapp/uazapi-proxy-city-label";
import { UazapiProxyCityPicker } from "@/components/crm/UazapiProxyCityPicker";

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
  /**
   * `painel` — fluxo UAZAPI completo inline (wizard passo Canal).
   * `card` — resumo + sideover deslizante (ficha do agente).
   */
  layout?: "card" | "painel";
};

function AgenteUazapiSideoverShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  embedded = false,
  theme = "light",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
  /** Painel fixo no wizard (sem overlay escuro). */
  embedded?: boolean;
  theme?: "dark" | "light";
}) {
  if (!open && !embedded) return null;

  const isDark = theme === "dark";

  if (embedded) {
    return (
      <section
        style={{
          borderRadius: 14,
          border: isDark ? `1px solid ${RF_BORDER_STRONG}` : "1px solid #dcebd8",
          background: isDark ? "#060d08" : "#ffffff",
          overflow: "hidden",
          boxShadow: isDark ? "0 4px 16px rgba(0, 0, 0, 0.35)" : "0 4px 16px rgba(11, 31, 16, 0.06)",
        }}
      >
        <header
          style={{
            borderBottom: isDark ? `1px solid ${RF_BORDER}` : "1px solid #dcebd8",
            padding: "14px 16px",
            background: isDark
              ? "linear-gradient(180deg, #0b1f10 0%, #060d08 100%)"
              : "linear-gradient(180deg, #f8fcf6 0%, #ffffff 100%)",
          }}
        >
          <p style={{ margin: 0, color: CRM_ACCENT, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
            WhatsApp
          </p>
          <h2
            style={{
              margin: "4px 0 0",
              color: isDark ? RF_TEXT_PRIMARY : BRAND_TEXT_DARK,
              fontSize: 17,
              fontWeight: 800,
            }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p
              style={{
                margin: "6px 0 0",
                color: isDark ? RF_TEXT_MUTED : "#5d7a67",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </header>
        <div
          style={{
            padding: 16,
            background: isDark ? "#060d08" : "#ffffff",
          }}
        >
          {children}
        </div>
        <div
          style={{
            borderTop: isDark ? `1px solid ${RF_BORDER}` : "1px solid #dcebd8",
            padding: "14px 18px 18px",
            background: isDark ? "#0b1f10" : "#f8fcf6",
          }}
        >
          {footer}
        </div>
      </section>
    );
  }

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
          background: "rgba(11, 31, 16, 0.32)",
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
          background: "#060d08",
          borderLeft: "1px solid rgba(63, 152, 72, 0.42)",
          boxShadow: "-12px 0 32px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <header
          style={{
            borderBottom: "1px solid rgba(146, 255, 0, 0.16)",
            padding: 16,
            background: "#0b1f10",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, color: CRM_ACCENT, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                WhatsApp
              </p>
              <h2 style={{ margin: "4px 0 0", color: RF_TEXT_PRIMARY, fontSize: 17, fontWeight: 800 }}>{title}</h2>
              {subtitle ? (
                <p style={{ margin: "6px 0 0", color: RF_TEXT_MUTED, fontSize: 12, lineHeight: 1.45 }}>{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={rfCloseButtonStyle()}
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="panel-scroll" style={{ flex: 1, overflowY: "auto", padding: 16, minHeight: 0, background: "#060d08" }}>
          {children}
        </div>
        <div
          style={{
            flexShrink: 0,
            borderTop: "1px solid rgba(146, 255, 0, 0.16)",
            padding: "14px 18px 18px",
            background: "#0b1f10",
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
  return { bg: "#dcebd8", fg: "#5d7a67", bar: "#484f58" };
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
      "Não foi possível contactar o serviço de ligação WhatsApp. Verifique a configuração do servidor e tente de novo."
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
  layout = "card",
}: AgenteUazapiBlockProps) {
  const darkSideover = layout === "card" || layout === "painel";
  const textMuted = darkSideover ? RF_TEXT_MUTED : "#5d7a67";
  const textStrong = darkSideover ? RF_TEXT_PRIMARY : "#0b2210";
  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [proxyCity, setProxyCity] = useState("");
  const [proxyState, setProxyState] = useState("");
  const [cidadesProxyErro, setCidadesProxyErro] = useState<string | null>(null);
  const [proxyAviso, setProxyAviso] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<ErroCtx | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [paircode, setPaircode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingMode, setPairingMode] = useState<"qr" | "code">("qr");
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
    const st = (snapshot.uazapi_proxy_state?.trim() || proxyState.trim()).toUpperCase();
    return formatProxyCityDisplay(formatProxyCityLabel(regiaoGuardada), st);
  }, [regiaoGuardada, snapshot.uazapi_proxy_state, proxyState]);

  useEffect(() => {
    setStatusTempoReal(null);
    setUltimaVerificacaoAt(null);
    setUltimaVerificacaoResultado(null);
  }, [snapshot.uazapi_instance_id, snapshot.uazapi_connection_status]);

  useEffect(() => {
    setProxyCity(snapshot.uazapi_proxy_city?.trim() || "");
    setProxyState(snapshot.uazapi_proxy_state?.trim() || "");
  }, [snapshot.uazapi_proxy_city, snapshot.uazapi_proxy_state]);

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
        if (data.qr_invalid === true) {
          setQrcode(null);
          setPaircode(null);
          setQrGeradoEm(null);
          if (!opts?.silent) {
            setErr({
              titulo: "QR inválido",
              detalhes: [
                typeof data.connect_hint === "string" && data.connect_hint.trim()
                  ? data.connect_hint.trim()
                  : "Não foi possível gerar o QR. Desligue a sessão, guarde a região e tente outra vez.",
              ],
            });
          }
        } else if (typeof data.qrcode === "string" && data.qrcode.trim()) {
          const norm = normalizarSrcImagemQrUazapi(data.qrcode);
          if (norm) {
            setQrcode(norm);
            setPaircode(null);
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

        if (typeof data.paircode === "string" && data.paircode.trim()) {
          setPaircode(data.paircode.trim());
          setQrcode(null);
          setQrGeradoEm(null);
          setQrExpiradoUi(false);
        } else if (!opts?.silent && (action === "connect" || action === "status")) {
          setPaircode(null);
        }

        const lastReason =
          typeof data.lastDisconnectReason === "string" ? data.lastDisconnectReason.trim() : "";
        const connectHint =
          typeof data.connect_hint === "string" ? data.connect_hint.trim() : "";

        const qrAcabouDeSerGerado =
          action === "connect" && typeof data.qrcode === "string" && data.qrcode.trim();

        if (lastReason || connectHint) {
          const benign = isBenignUazapiDisconnectReason(lastReason);
          if (opts?.silent && benign) {
            /* não sobrescrever diag durante poll com motivo stale */
          } else if (qrAcabouDeSerGerado && benign) {
            setUazapiDiag(
              connectHint
                ? { connectHint }
                : {
                    connectHint:
                      "QR gerado. Abra WhatsApp → Aparelhos ligados → Ligar com QR e escaneie antes do tempo expirar.",
                  }
            );
          } else {
            setUazapiDiag({
              ...(lastReason && !(qrAcabouDeSerGerado && benign)
                ? { lastDisconnectReason: lastReason }
                : {}),
              ...(connectHint ? { connectHint } : {}),
            });
          }
        } else if (action === "connect" && !opts?.silent) {
          setUazapiDiag(null);
        }
        if (action === "delete_remote") {
          setQrcode(null);
          setPaircode(null);
        }
        if (action === "disconnect") {
          setQrcode(null);
          setPaircode(null);
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
          setPaircode(null);
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
            "Webhook WhatsApp configurado. Envie uma mensagem de teste."
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
          setCidadesProxyErro(null);
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

  const fieldStyle: CSSProperties = darkSideover
    ? {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 9,
        border: `1px solid ${RF_BORDER_STRONG}`,
        background: "rgba(6, 13, 8, 0.85)",
        color: RF_TEXT_PRIMARY,
        fontSize: 13,
        boxSizing: "border-box",
      }
    : {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 9,
        border: "1px solid #dcebd8",
        background: "#f8fcf6",
        color: "#0b2210",
        fontSize: 13,
        boxSizing: "border-box",
      };

  const cardSurface: CSSProperties = darkSideover
    ? {
        borderRadius: 12,
        background: "rgba(11, 31, 16, 0.92)",
        border: `1px solid ${RF_BORDER_STRONG}`,
      }
    : {
        borderRadius: 12,
        background: "#ffffff",
        border: "1px solid #dcebd8",
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
        border: "none",
        background: disabled ? "#4a6356" : BRAND_TEXT_DARK,
        color: disabled ? "#c8dcc8" : BRAND_GREEN_BRIGHT,
        boxShadow: disabled ? "none" : "0 2px 8px rgba(11, 31, 16, 0.12)",
      };
    }
    if (variant === "danger") {
      return {
        ...base,
        border: "1px solid #f8514966",
        background: disabled ? (darkSideover ? "rgba(6, 13, 8, 0.5)" : "#ffffff") : "#f8514910",
        color: disabled ? RF_TEXT_MUTED : "#f85149",
      };
    }
    return {
      ...base,
      border: darkSideover ? `1px solid ${RF_BORDER_STRONG}` : "1px solid #dcebd8",
      background: disabled
        ? darkSideover
          ? "rgba(6, 13, 8, 0.5)"
          : "#ffffff"
        : darkSideover
          ? "rgba(6, 13, 8, 0.72)"
          : "#eef7eb",
      color: disabled ? RF_TEXT_MUTED : darkSideover ? RF_TEXT_PRIMARY : "#0b2210",
    };
  };

  const btnGroupShell: CSSProperties = {
    display: "grid",
    borderRadius: 10,
    border: darkSideover ? `1px solid ${RF_BORDER_STRONG}` : "1px solid #dcebd8",
    overflow: "hidden",
    background: darkSideover ? "rgba(6, 13, 8, 0.72)" : "#ffffff",
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
      borderRight: withRightDivider
        ? darkSideover
          ? `1px solid ${RF_BORDER_STRONG}`
          : "1px solid #dcebd8"
        : undefined,
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
  const paircodeAtivo = Boolean(paircode?.trim());
  const pairingPhoneDigits = pairingPhone.replace(/\D/g, "");
  const podeConectarPorCodigo = pairingPhoneDigits.length >= 10 && pairingPhoneDigits.length <= 15;
  const precisaReconectar =
    temInstancia &&
    String(statusExibido).toLowerCase() !== "connected" &&
    (qrExpirado || (String(statusExibido).toLowerCase() === "connecting" && !mostrarQrAtivo && !paircodeAtivo));
  const conectarBloqueado =
    acoesOff ||
    loading === "connect" ||
    !temInstancia ||
    !regiaoGuardada ||
    (pairingMode === "code" && !podeConectarPorCodigo);

  const conectado = String(statusExibido).toLowerCase() === "connected";

  const reconectarWhatsApp = useCallback(() => {
    void postAction("connect", {
      ...proxyConnectExtra(),
      reset_session: true,
      ...(pairingMode === "code" && podeConectarPorCodigo ? { phone: pairingPhoneDigits } : {}),
    });
  }, [postAction, proxyConnectExtra, pairingMode, pairingPhoneDigits, podeConectarPorCodigo]);

  const botoesFooter = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!temInstancia ? (
        <>
          <p style={{ margin: 0, color: CRM_ACCENT, fontSize: 10, fontWeight: 800, letterSpacing: 0.08 }}>
            PASSO 1 — CADASTRAR INSTÂNCIA
          </p>
          <p style={{ margin: 0, color: textMuted, fontSize: 11, lineHeight: 1.45 }}>
            Crie a ligação WhatsApp com o botão abaixo. Depois escolha a cidade e use «Guardar região». O QR para ligar
            o telefone fica no passo 2.
          </p>
          <button
            type="button"
            disabled={acoesOff}
            style={{
              ...btnBase(acoesOff, "primary"),
              width: "100%",
              minHeight: 44,
            }}
            onClick={() => postAction("create")}
          >
            {loading === "create" ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
            Criar ligação WhatsApp
          </button>
          {!regiaoGuardada && temInstancia ? (
            <p style={{ margin: 0, color: "#e6c06a", fontSize: 11 }}>
              Instância criada — seleccione a cidade acima e use «Guardar região» antes de gerar o QR.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p style={{ margin: 0, color: CRM_ACCENT, fontSize: 10, fontWeight: 800, letterSpacing: 0.08 }}>
            PASSO 2 — LIGAR WHATSAPP
          </p>
          <div style={{ ...btnGroupShell, gridTemplateColumns: conectado ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))" }}>
            {!conectado ? (
              <button
                type="button"
                disabled={conectarBloqueado}
                style={btnInGroup(conectarBloqueado, "primary", true)}
                onClick={() => reconectarWhatsApp()}
              >
                {loading === "connect" ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
                {precisaReconectar ? "Reconectar" : pairingMode === "code" ? "Gerar código" : "Gerar QR"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={loading !== null}
              style={btnInGroup(loading !== null, "default", !conectado)}
              onClick={() => postAction("status")}
            >
              {loading === "status" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Actualizar estado
            </button>
            <button
              type="button"
              disabled={acoesOff}
              style={btnInGroup(acoesOff, "default", false)}
              onClick={() => postAction("disconnect")}
            >
              {loading === "disconnect" ? <Loader2 size={15} className="animate-spin" /> : <Unplug size={15} />}
              Desligar sessão
            </button>
          </div>
          {!conectado ? (
            <div
              style={{
                ...btnGroupShell,
                gridTemplateColumns:
                  layout === "card" ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
              }}
            >
              <button
                type="button"
                disabled={acoesOff}
                style={btnInGroup(acoesOff, "default", layout === "card")}
                onClick={() => postAction("sync_webhook")}
              >
                {loading === "sync_webhook" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Sincronizar webhook
              </button>
              {layout === "card" ? (
                <button
                  type="button"
                  disabled={acoesOff}
                  style={btnInGroup(acoesOff, "default", false)}
                  onClick={() => setSideoverOpen(false)}
                >
                  Fechar
                </button>
              ) : null}
            </div>
          ) : null}
          {precisaReconectar && !conectado ? (
            <button
              type="button"
              disabled={conectarBloqueado}
              style={{ ...btnBase(conectarBloqueado, "primary"), width: "100%", minHeight: 44 }}
              onClick={() => reconectarWhatsApp()}
            >
              {loading === "connect" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Reconectar WhatsApp
            </button>
          ) : null}
          <button
            type="button"
            disabled={acoesOff}
            style={{ ...btnBase(acoesOff, "danger"), width: "100%", minHeight: 42 }}
            onClick={() => setDialogExcluirUazapi(true)}
          >
            {loading === "delete_remote" ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Eliminar ligação WhatsApp
          </button>
        </>
      )}
    </div>
  );

  const painelSubtitle = temInstancia
    ? "Passo 2: ligue o WhatsApp com QR ou código (instância já cadastrada)."
    : "Passo 1: criar ligação WhatsApp. Depois escolha a cidade; QR no passo 2.";

  return (
    <>
      {layout === "card" ? (
      <div
        style={{
          marginBottom: 18,
          borderRadius: 14,
          border: "1px solid #dcebd8",
          background: "#ffffff",
          boxShadow: "0 4px 16px rgba(11, 31, 16, 0.06)",
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
                <p style={{ margin: 0, color: "#0b2210", fontSize: 14, fontWeight: 800 }}>WhatsApp</p>
                <p style={{ margin: "4px 0 0", color: "#5d7a67", fontSize: 12, lineHeight: 1.45 }}>
                  {temInstancia
                    ? conectado
                      ? "Telefone ligado · "
                      : "Instância criada — ligue o telefone (passo 2) · "
                    : "Passo 1: cadastro · "}
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
                {regiaoLabel ? (
                  <p style={{ margin: "6px 0 0", color: "#6e7681", fontSize: 11 }}>
                    Região: <strong style={{ color: "#2d4a38" }}>{regiaoLabel}</strong>
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              disabled={bloqueado}
              onClick={() => setSideoverOpen(true)}
              style={{
                ...crmBtnPrimaryLg(bloqueado),
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                flex: "none",
                padding: "9px 14px",
              }}
            >
              Configurar ligação
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>
      ) : null}

      <AgenteUazapiSideoverShell
        embedded={layout === "painel"}
        theme={darkSideover ? "dark" : "light"}
        open={layout === "painel" ? true : sideoverOpen}
        onClose={() => setSideoverOpen(false)}
        title={agenteNome?.trim() || agenteSlug}
        subtitle={painelSubtitle}
        footer={botoesFooter}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${!temInstancia ? `${CRM_ACCENT}66` : darkSideover ? RF_BORDER : "#dcebd8"}`,
                background: !temInstancia ? "#3f984818" : darkSideover ? "rgba(6, 13, 8, 0.72)" : "#f8fcf6",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: !temInstancia ? CRM_ACCENT : "#6e7681" }}>
                1. Cadastro
              </p>
            </div>
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${temInstancia ? `${CRM_ACCENT}66` : darkSideover ? RF_BORDER : "#dcebd8"}`,
                background: temInstancia ? "#3f984818" : darkSideover ? "rgba(6, 13, 8, 0.72)" : "#f8fcf6",
                textAlign: "center",
                opacity: temInstancia ? 1 : 0.72,
              }}
            >
              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: temInstancia ? CRM_ACCENT : textMuted }}>
                2. Ligar WhatsApp
              </p>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              padding: "14px 16px",
              ...cardSurface,
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
                <span style={{ fontSize: 10, color: textMuted }}>
                  {ultimaVerificacaoResultado === "erro" ? "Últ. verificação: erro" : "Últ. verificação: ok"} ·{" "}
                  {formatarDataHoraPtBr(ultimaVerificacaoAt)}
                </span>
              ) : null}
            </div>
            {!temInstancia ? (
              <p style={{ margin: "10px 0 0", paddingLeft: 12, fontSize: 12, color: textMuted }}>
                Conclua o <strong style={{ color: textStrong }}>passo 1</strong> abaixo para ligar o WhatsApp.
              </p>
            ) : null}
          </div>

          <div style={{ padding: "14px 16px", ...cardSurface }}>
            <p style={{ margin: "0 0 12px", color: CRM_ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 0.06 }}>
              PASSO 1 — REGIÃO E INSTÂNCIA
            </p>
            <p style={{ margin: "0 0 12px", color: textMuted, fontSize: 11, fontWeight: 700, letterSpacing: 0.06 }}>
              REGIÃO DO NÚMERO
            </p>
            <UazapiProxyCityPicker
              agenteSlug={agenteSlug}
              cityValue={proxyCity}
              stateValue={proxyState}
              disabled={acoesOff}
              saving={loading === "save_proxy"}
              dark={darkSideover}
              temInstancia={temInstancia}
              externalError={cidadesProxyErro}
              onSelect={(c) => {
                setProxyCity(c.value);
                if (c.state) setProxyState(c.state.toUpperCase());
                setCidadesProxyErro(null);
              }}
              onSave={() => void postAction("save_proxy", proxyConnectExtra())}
            />
            {snapshot.uazapi_proxy_city?.trim() &&
            proxyCity.trim().toLowerCase() === snapshot.uazapi_proxy_city.trim().toLowerCase() ? (
              <p style={{ margin: "8px 0 0", color: "#3fb950", fontSize: 11, fontWeight: 600 }}>
                Região guardada no agente.
              </p>
            ) : null}
          </div>

          {!temInstancia ? (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                border: darkSideover ? `1px dashed ${RF_BORDER_STRONG}` : "1px dashed #d4ecd0",
                background: darkSideover ? "rgba(6, 13, 8, 0.55)" : "#f8fcf6",
              }}
            >
              <p style={{ margin: 0, color: textMuted, fontSize: 12, lineHeight: 1.5 }}>
                O <strong style={{ color: textStrong }}>QR e o pareamento</strong> ficam disponíveis depois de criar a
                instância (passo 2). Use os botões no rodapé deste painel.
              </p>
            </div>
          ) : conectado ? (
            <div
              style={{
                padding: "16px",
                borderRadius: 12,
                border: "1px solid #3fb95044",
                background: "#23863618",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, color: "#3fb950", fontSize: 13, fontWeight: 800 }}>
                WhatsApp conectado
              </p>
              <p style={{ margin: "8px 0 0", color: textMuted, fontSize: 11 }}>
                A instância está ativa. Para trocar de número, desligue a sessão e gere um novo QR.
              </p>
            </div>
          ) : (
          <div style={{ padding: "14px 16px", ...cardSurface }}>
            <p style={{ margin: "0 0 10px", color: "#c9a24a", fontSize: 11, fontWeight: 800, letterSpacing: 0.06 }}>
              PASSO 2 — LIGAR O TELEFONE
            </p>
            <p
              style={{
                margin: "0 0 10px",
                color: textMuted,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.06,
              }}
            >
              MODO DE CONEXÃO
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <button
                type="button"
                disabled={acoesOff || !temInstancia}
                style={btnInGroup(acoesOff || !temInstancia, pairingMode === "qr" ? "primary" : "default", true)}
                onClick={() => setPairingMode("qr")}
              >
                <QrCode size={15} />
                QR
              </button>
              <button
                type="button"
                disabled={acoesOff || !temInstancia}
                style={btnInGroup(acoesOff || !temInstancia, pairingMode === "code" ? "primary" : "default", false)}
                onClick={() => setPairingMode("code")}
              >
                <Smartphone size={15} />
                Código
              </button>
            </div>
            {pairingMode === "code" ? (
              <div style={{ marginTop: 12 }}>
                <label
                  style={{ display: "block", color: textMuted, fontSize: 11, fontWeight: 700, marginBottom: 8 }}
                >
                  Número do WhatsApp (com DDI)
                </label>
                <input
                  value={pairingPhone}
                  onChange={(e) => setPairingPhone(e.target.value)}
                  placeholder="5511999999999"
                  inputMode="numeric"
                  style={fieldStyle}
                />
                <p style={{ margin: "8px 0 0", color: textMuted, fontSize: 11 }}>
                  Use o código de pareamento para ligar o telefone sem QR.
                </p>
                {pairingPhone.trim() && !podeConectarPorCodigo ? (
                  <p style={{ margin: "6px 0 0", color: "#f85149", fontSize: 11 }}>
                    Informe de 10 a 15 dígitos (ex.: 5511999999999).
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          )}

          {temInstancia && !conectado && mostrarQrAtivo ? (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                ...cardSurface,
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
                <p style={{ margin: 0, color: textMuted, fontSize: 11, fontWeight: 700 }}>QR WHATSAPP</p>
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
                  border: darkSideover ? `1px solid ${RF_BORDER_STRONG}` : "1px solid #dcebd8",
                  margin: "0 auto",
                  display: "block",
                }}
              />
              <p style={{ margin: "12px 0 0", color: textMuted, fontSize: 11, lineHeight: 1.5 }}>
                WhatsApp → Aparelhos ligados → Ligar com QR. Quando o tempo acabar, use{" "}
                <strong style={{ color: textStrong }}>Reconectar</strong>.
              </p>
            </div>
          ) : null}

          {temInstancia && !conectado && paircodeAtivo ? (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                border: "1px solid #58a6ff66",
                background: "rgba(31, 111, 235, 0.14)",
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 8px", color: "#79c0ff", fontSize: 11, fontWeight: 700 }}>CÓDIGO DE PAREAMENTO</p>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: 1.2,
                  color: darkSideover ? RF_TEXT_PRIMARY : "#0b2210",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {paircode}
              </p>
              <p style={{ margin: 0, color: textMuted, fontSize: 11, lineHeight: 1.5 }}>
                WhatsApp → Aparelhos conectados → Conectar com número. Digite este código no app.
              </p>
            </div>
          ) : null}

          {temInstancia && !conectado && precisaReconectar ? (
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
              <p style={{ margin: "0 0 14px", color: textMuted, fontSize: 11, lineHeight: 1.55 }}>
                O código anterior já não serve. Só funciona após gerar um <strong style={{ color: textStrong }}>novo QR</strong>{" "}
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
            <p
              style={{
                margin: 0,
                color: isBenignUazapiDisconnectReason(uazapiDiag.lastDisconnectReason)
                  ? "#e6c06a"
                  : "#f85149",
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              {isBenignUazapiDisconnectReason(uazapiDiag.lastDisconnectReason) ? (
                formatUazapiDisconnectReasonForUi(uazapiDiag.lastDisconnectReason)
              ) : (
                <>
                  Última desconexão WhatsApp: <strong>{uazapiDiag.lastDisconnectReason}</strong>
                </>
              )}
            </p>
          ) : null}
          {uazapiDiag?.connectHint ? (
            <p style={{ margin: 0, color: "#e6c06a", fontSize: 11, lineHeight: 1.5 }}>{uazapiDiag.connectHint}</p>
          ) : null}

          <details
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: darkSideover ? `1px solid ${RF_BORDER_STRONG}` : "1px solid #dcebd8",
              background: darkSideover ? "rgba(6, 13, 8, 0.72)" : "#f8fcf6",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                color: textMuted,
                fontSize: 12,
                fontWeight: 700,
                listStyle: "none",
                userSelect: "none",
              }}
            >
              Dicas de webhook
            </summary>
            <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.55, color: textMuted }}>
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
        title="Eliminar ligação WhatsApp?"
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
          A ligação WhatsApp deste agente será removida.
        </p>
        <p style={{ margin: "10px 0 0", color: "#b3261e", fontWeight: 600, fontSize: 12 }}>
          Esta operação não pode ser desfeita.
        </p>
      </CrmConfirmDialog>
    </>
  );

}
