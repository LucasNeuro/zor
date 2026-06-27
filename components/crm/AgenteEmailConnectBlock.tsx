"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { CRM_ACCENT, crmBtnPrimaryLg } from "@/lib/crm/crm-button-styles";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import {
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfCloseButtonStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import type { AgenteEmailSnapshot } from "@/lib/email/agente-email-types";

export type { AgenteEmailSnapshot };

export type EmailOAuthStatus = {
  connected: boolean;
  provider: "google" | "microsoft" | null;
  email: string | null;
  display_name: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  mode: "oauth" | null;
};

export type AgenteEmailConnectBlockProps = {
  agenteSlug: string;
  snapshot: AgenteEmailSnapshot;
  onSnapshotPatch?: (patch: Partial<AgenteEmailSnapshot>) => void;
  agenteNome?: string;
  bloqueado?: boolean;
  layout?: "card" | "painel";
};

type ErroCtx = { titulo: string; detalhes: string[] };

type ProvidersAvailable = { google: boolean; microsoft: boolean };

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

function parseOAuthStatus(data: Record<string, unknown>): EmailOAuthStatus {
  const modeRaw =
    data.email_mode ?? data.email_provider_mode ?? data.provider_mode ?? data.email_provider;
  const mode =
    modeRaw === "oauth" || modeRaw === "google" || modeRaw === "oauth_google" || modeRaw === "microsoft"
      ? "oauth"
      : null;

  const connected =
    data.oauth_connected === true ||
    data.email_oauth_connected === true ||
    (typeof data.oauth_email === "string" && data.oauth_email.trim().length > 0) ||
    (typeof data.email_oauth_email === "string" && data.email_oauth_email.trim().length > 0);

  const email =
    (typeof data.oauth_email === "string" && data.oauth_email.trim()) ||
    (typeof data.email_oauth_email === "string" && data.email_oauth_email.trim()) ||
    null;

  const displayName =
    (typeof data.oauth_display_name === "string" && data.oauth_display_name.trim()) ||
    (typeof data.email_oauth_display_name === "string" && data.email_oauth_display_name.trim()) ||
    null;

  const connectedAt =
    (typeof data.oauth_connected_at === "string" && data.oauth_connected_at.trim()) ||
    (typeof data.email_oauth_connected_at === "string" && data.email_oauth_connected_at.trim()) ||
    null;

  const lastSync =
    (typeof data.oauth_last_sync_at === "string" && data.oauth_last_sync_at.trim()) ||
    (typeof data.email_oauth_last_sync_at === "string" && data.email_oauth_last_sync_at.trim()) ||
    (typeof data.email_last_sync_at === "string" && data.email_last_sync_at.trim()) ||
    null;

  const providerRaw = data.oauth_provider ?? data.email_oauth_provider;
  const provider =
    providerRaw === "microsoft"
      ? "microsoft"
      : providerRaw === "google" || connected
        ? "google"
        : null;

  return {
    connected,
    provider,
    email,
    display_name: displayName,
    connected_at: connectedAt,
    last_sync_at: lastSync,
    mode: connected && !mode ? "oauth" : mode,
  };
}

function formatarDataPt(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AgenteEmailSideoverShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  embedded = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  embedded?: boolean;
}) {
  if (!open && !embedded) return null;

  if (embedded) {
    return (
      <section
        style={{
          borderRadius: 14,
          border: "1px solid #dcebd8",
          background: "#ffffff",
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(11, 31, 16, 0.06)",
        }}
      >
        <header
          style={{
            borderBottom: "1px solid #dcebd8",
            padding: "14px 16px",
            background: "linear-gradient(180deg, #f8fcf6 0%, #ffffff 100%)",
          }}
        >
          <p style={{ margin: 0, color: CRM_ACCENT, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
            E-mail
          </p>
          <h2 style={{ margin: "4px 0 0", color: BRAND_TEXT_DARK, fontSize: 17, fontWeight: 800 }}>{title}</h2>
          {subtitle ? (
            <p style={{ margin: "6px 0 0", color: "#5d7a67", fontSize: 12, lineHeight: 1.45 }}>{subtitle}</p>
          ) : null}
        </header>
        <div style={{ padding: 16 }}>{children}</div>
        {footer ? (
          <div
            style={{
              borderTop: "1px solid #dcebd8",
              padding: "14px 18px 18px",
              background: "#f8fcf6",
            }}
          >
            {footer}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Fechar painel E-mail"
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
          width: "min(560px, 100vw)",
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
                E-mail
              </p>
              <h2 style={{ margin: "4px 0 0", color: RF_TEXT_PRIMARY, fontSize: 17, fontWeight: 800 }}>{title}</h2>
              {subtitle ? (
                <p style={{ margin: "6px 0 0", color: RF_TEXT_MUTED, fontSize: 12, lineHeight: 1.45 }}>{subtitle}</p>
              ) : null}
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" style={rfCloseButtonStyle()}>
              <X size={18} />
            </button>
          </div>
        </header>
        <div
          className="panel-scroll"
          style={{ flex: 1, overflowY: "auto", padding: 16, minHeight: 0, background: "#060d08" }}
        >
          {children}
        </div>
        {footer ? (
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
        ) : null}
      </aside>
    </>
  );
}

export function AgenteEmailConnectBlock({
  agenteSlug,
  snapshot,
  onSnapshotPatch,
  agenteNome,
  bloqueado = false,
  layout = "card",
}: AgenteEmailConnectBlockProps) {
  const darkSideover = layout === "card";
  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<EmailOAuthStatus | null>(null);
  const [providersAvailable, setProvidersAvailable] = useState<ProvidersAvailable>({
    google: false,
    microsoft: false,
  });
  const [statusLoading, setStatusLoading] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<ErroCtx | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const oauthHandledRef = useRef(false);

  const onSnapshotPatchRef = useRef(onSnapshotPatch);
  onSnapshotPatchRef.current = onSnapshotPatch;

  const oauthConectado = oauthStatus?.connected === true;
  const modoActivo: "oauth" | "none" = oauthConectado ? "oauth" : "none";

  const emailExibicao =
    oauthConectado && oauthStatus?.email
      ? oauthStatus.email
      : snapshot.email_from?.trim() || snapshot.email_inbound?.trim() || null;

  const carregarOAuthStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      // TODO(Agent 1): GET /api/hub/agentes/{slug}/email/oauth — status OAuth dedicado
      let data: Record<string, unknown> = {};
      const oauthRes = await fetch(
        `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/email/oauth`,
        { headers: await crmApiHeaders() }
      );
      if (oauthRes.ok) {
        data = await lerCorpoApi(oauthRes);
      } else if (oauthRes.status === 404) {
        const emailRes = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/email`, {
          headers: await crmApiHeaders(),
        });
        if (emailRes.ok) {
          data = await lerCorpoApi(emailRes);
        }
      }
      const parsed = parseOAuthStatus(data);
      setOauthStatus(parsed);
      const pa = data.providers_available;
      if (pa && typeof pa === "object" && !Array.isArray(pa)) {
        const o = pa as Record<string, unknown>;
        setProvidersAvailable({
          google: o.google === true,
          microsoft: o.microsoft === true,
        });
      }
      if (parsed.connected && parsed.email && onSnapshotPatchRef.current) {
        onSnapshotPatchRef.current({
          email_from: parsed.email,
          email_inbound: parsed.email,
          email_ativo: true,
        });
      }
    } catch {
      setOauthStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [agenteSlug]);

  useEffect(() => {
    void carregarOAuthStatus();
  }, [carregarOAuthStatus]);

  useEffect(() => {
    if (!sideoverOpen && layout === "card") return;
    void carregarOAuthStatus();
  }, [sideoverOpen, layout, carregarOAuthStatus]);

  useEffect(() => {
    if (typeof window === "undefined" || oauthHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("email_oauth");
    if (!flag) return;
    oauthHandledRef.current = true;

    if (flag === "connected" || flag === "success") {
      setSucesso("Conta de e-mail ligada com sucesso.");
      if (layout === "card") setSideoverOpen(true);
      void carregarOAuthStatus();
    } else if (flag === "error") {
      const msg = params.get("email_oauth_message") || params.get("email_oauth_error");
      setErr({
        titulo: msg?.trim() || "Não foi possível ligar a conta.",
        detalhes: [],
      });
      if (layout === "card") setSideoverOpen(true);
    }

    params.delete("email_oauth");
    params.delete("email_oauth_error");
    params.delete("email_oauth_message");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }, [carregarOAuthStatus, layout]);

  const acoesOff = loading !== null || bloqueado || statusLoading;

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
      width: "100%",
    };
    if (variant === "primary") {
      return {
        ...base,
        border: "none",
        background: disabled ? "#4a6356" : BRAND_TEXT_DARK,
        color: disabled ? "#c8dcc8" : BRAND_GREEN_BRIGHT,
      };
    }
    if (variant === "danger") {
      return {
        ...base,
        border: "1px solid rgba(248, 81, 73, 0.45)",
        background: disabled ? "rgba(248, 81, 73, 0.08)" : "rgba(248, 81, 73, 0.12)",
        color: disabled ? RF_TEXT_MUTED : "#ffb4af",
      };
    }
    return {
      ...base,
      border: darkSideover ? `1px solid ${RF_BORDER_STRONG}` : "1px solid #dcebd8",
      background: darkSideover ? "rgba(6, 13, 8, 0.72)" : "#eef7eb",
      color: darkSideover ? RF_TEXT_PRIMARY : "#0b2210",
    };
  };

  function conectarGoogle() {
    if (acoesOff) return;
    window.location.href = `/crm/agentes/${encodeURIComponent(agenteSlug)}/connect-email/google`;
  }

  function conectarMicrosoft() {
    if (acoesOff) return;
    setErr({
      titulo: "Microsoft 365 em breve.",
      detalhes: ["Defina MICROSOFT_OAUTH_CLIENT_ID e MICROSOFT_OAUTH_CLIENT_SECRET no servidor quando estiver disponível."],
    });
  }

  async function enviarTesteOAuth() {
    const destino = oauthStatus?.email?.trim() || snapshot.email_from?.trim();
    if (!destino) {
      setErr({ titulo: "Ligue a conta Google antes de testar.", detalhes: [] });
      return;
    }
    setErr(null);
    setSucesso(null);
    setLoading("test");
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify({ to: destino }),
      });
      const data = await lerCorpoApi(res);
      if (!res.ok) {
        setErr({
          titulo:
            typeof data.error === "string" && data.error.trim()
              ? data.error.trim()
              : `Erro HTTP ${res.status}`,
          detalhes:
            typeof data.detail === "string" && data.detail.trim() ? [data.detail.trim()] : [],
        });
        return;
      }
      setSucesso(`E-mail de teste enviado para ${destino} via Gmail.`);
    } catch {
      setErr({ titulo: "Falha de rede ao enviar teste.", detalhes: [] });
    } finally {
      setLoading(null);
    }
  }

  async function desconectarGoogle() {
    setErr(null);
    setSucesso(null);
    setLoading("disconnect");
    try {
      // TODO(Agent 1): DELETE /api/hub/agentes/{slug}/email/oauth
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/email/oauth`, {
        method: "DELETE",
        headers: await crmApiHeaders(),
      });
      const data = await lerCorpoApi(res);
      if (!res.ok) {
        const titulo =
          typeof data.error === "string" && data.error.trim()
            ? data.error.trim()
            : res.status === 404
              ? "API de desligar OAuth ainda não disponível."
              : `Erro HTTP ${res.status}`;
        setErr({ titulo, detalhes: [] });
        return;
      }
      const parsed = parseOAuthStatus(data);
      setOauthStatus(parsed);
      setSucesso("Conta Google desligada.");
      onSnapshotPatchRef.current?.({
        email_from: null,
        email_inbound: null,
      });
      void carregarOAuthStatus();
    } catch {
      setErr({ titulo: "Falha de rede ao desligar.", detalhes: [] });
    } finally {
      setLoading(null);
    }
  }

  const rotuloEstado = oauthConectado
    ? "LIGADO"
    : snapshot.email_ativo !== false && emailExibicao
      ? "ATIVO"
      : "NÃO CONFIGURADO";

  const badge = oauthConectado
    ? { bg: "#23863633", fg: "#3fb950", bar: "#3fb950" }
    : emailExibicao && snapshot.email_ativo !== false
      ? { bg: "#23863633", fg: "#3fb950", bar: "#3fb950" }
      : { bg: "#bb800926", fg: "#e6c06a", bar: "#e6c06a" };

  const painelSubtitle = "Ligue a caixa de e-mail do cliente (Google ou Microsoft).";

  const googleDisponivel = providersAvailable.google;
  const microsoftDisponivel = providersAvailable.microsoft;

  const oauthPainel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ position: "relative", padding: "14px 16px", ...cardSurface }}>
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
        <div style={{ paddingLeft: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
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
              {oauthConectado ? "CONECTADO" : "DESCONECTADO"}
            </span>
            {statusLoading ? (
              <span style={{ fontSize: 10, color: RF_TEXT_MUTED }}>A verificar ligação…</span>
            ) : null}
          </div>

          {oauthConectado && oauthStatus?.email ? (
            <div style={{ marginTop: 12 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: darkSideover ? RF_TEXT_PRIMARY : BRAND_TEXT_DARK,
                }}
              >
                Conectado como <span style={{ color: CRM_ACCENT }}>{oauthStatus.email}</span>
              </p>
              {oauthStatus.provider ? (
                <p style={{ margin: "6px 0 0", fontSize: 11, color: RF_TEXT_MUTED }}>
                  Provedor: {oauthStatus.provider === "microsoft" ? "Microsoft 365" : "Google"}
                </p>
              ) : null}
              {formatarDataPt(oauthStatus.last_sync_at) ? (
                <p style={{ margin: "8px 0 0", fontSize: 11, color: RF_TEXT_MUTED }}>
                  Último sync: {formatarDataPt(oauthStatus.last_sync_at)}
                </p>
              ) : null}
            </div>
          ) : !googleDisponivel && !microsoftDisponivel ? (
            <p style={{ margin: "12px 0 0", fontSize: 11, color: "#e6c06a", lineHeight: 1.5 }}>
              OAuth não configurado no servidor. Defina GOOGLE_OAUTH_* e HUB_CREDENTIALS_ENCRYPTION_KEY no .env /
              Render.
            </p>
          ) : null}
        </div>
      </div>

      {oauthConectado ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            disabled={acoesOff}
            style={btnBase(acoesOff, "primary")}
            onClick={() => void enviarTesteOAuth()}
          >
            {loading === "test" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Enviar teste
          </button>
          <button
            type="button"
            disabled={acoesOff}
            style={btnBase(acoesOff, "default")}
            onClick={() => void carregarOAuthStatus()}
          >
            {statusLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Atualizar estado
          </button>
          <button
            type="button"
            disabled={acoesOff}
            style={btnBase(acoesOff, "danger")}
            onClick={() => void desconectarGoogle()}
          >
            {loading === "disconnect" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <LogOut size={15} />
            )}
            Desconectar
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            disabled={acoesOff || !googleDisponivel}
            onClick={conectarGoogle}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid #dadce0",
              background: acoesOff || !googleDisponivel ? "#f1f3f4" : "#ffffff",
              color: acoesOff || !googleDisponivel ? "#9aa0a6" : "#3c4043",
              fontSize: 13,
              fontWeight: 700,
              cursor: acoesOff || !googleDisponivel ? "not-allowed" : "pointer",
              boxShadow: acoesOff || !googleDisponivel ? "none" : "0 1px 2px rgba(60,64,67,0.15)",
            }}
          >
            <GoogleMark />
            Conectar com Google
          </button>
          <button
            type="button"
            disabled={acoesOff || !microsoftDisponivel}
            onClick={conectarMicrosoft}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid #dadce0",
              background: acoesOff || !microsoftDisponivel ? "#f1f3f4" : "#ffffff",
              color: acoesOff || !microsoftDisponivel ? "#9aa0a6" : "#0078d4",
              fontSize: 13,
              fontWeight: 700,
              cursor: acoesOff || !microsoftDisponivel ? "not-allowed" : "pointer",
            }}
          >
            <MicrosoftMark />
            Conectar com Microsoft
          </button>
        </div>
      )}

      {sucesso ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #238636",
            background: "#23863618",
            fontSize: 12,
            color: "#7ee787",
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          {sucesso}
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
  );

  const footerSideover =
    layout === "card" ? (
      <button type="button" disabled={acoesOff} style={btnBase(acoesOff)} onClick={() => setSideoverOpen(false)}>
        Fechar
      </button>
    ) : null;

  const resumoModo =
    modoActivo === "oauth"
      ? oauthStatus?.provider === "microsoft"
        ? "Microsoft"
        : "Google"
      : "Não configurado";
 
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
              background: "linear-gradient(90deg, #4285f4, #3f9848, #2d6a4f)",
              opacity: 0.95,
            }}
            aria-hidden
          />
          <div style={{ padding: "14px 16px 16px" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", gap: 12, minWidth: 0, alignItems: "center" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "linear-gradient(145deg, #4285f418, #3f984818)",
                    border: "1px solid #3f984844",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Mail size={20} style={{ color: CRM_ACCENT }} aria-hidden />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, color: "#0b2210", fontSize: 14, fontWeight: 800 }}>
                    E-mail
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#5d7a67", fontSize: 12, lineHeight: 1.45 }}>
                    {emailExibicao ? (
                      <>
                        {oauthStatus?.display_name ? `${oauthStatus.display_name} · ` : ""}
                        {emailExibicao}
                      </>
                    ) : (
                      "Ligue Google ou Microsoft · "
                    )}
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
                    Modo: <strong style={{ color: "#2d4a38" }}>{resumoModo}</strong>
                    {formatarDataPt(oauthStatus?.last_sync_at)
                      ? ` · sync ${formatarDataPt(oauthStatus?.last_sync_at)}`
                      : null}
                  </p>
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
                Configurar canal
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AgenteEmailSideoverShell
        embedded={layout === "painel"}
        open={layout === "painel" ? true : sideoverOpen}
        onClose={() => setSideoverOpen(false)}
        title={agenteNome?.trim() || agenteSlug}
        subtitle={painelSubtitle}
        footer={footerSideover}
      >
        {oauthPainel}
      </AgenteEmailSideoverShell>
    </>
  );
}

function MicrosoftMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden>
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
      <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
      <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
