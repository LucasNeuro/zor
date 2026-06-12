"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  Loader2,
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
import { emailFromPermitidoParaResend } from "@/lib/email/resend-config";

export type AgenteResendSnapshot = {
  email_from?: string | null;
  email_from_name?: string | null;
  email_inbound?: string | null;
  email_ativo?: boolean;
};

export type AgenteResendBlockProps = {
  agenteSlug: string;
  snapshot: AgenteResendSnapshot;
  onSnapshotPatch?: (patch: Partial<AgenteResendSnapshot>) => void;
  agenteNome?: string;
  bloqueado?: boolean;
  layout?: "card" | "painel" | "inline";
};

type ErroCtx = { titulo: string; detalhes: string[] };

type ResendStatus = {
  resend_configured?: boolean;
  domain_hint?: string | null;
  default_from_email?: string | null;
  resend_setup_hint?: string | null;
  inbound_webhook_url?: string | null;
};

function detalhesErroResend(titulo: string): string[] {
  if (!/domain is not verified|resend\.com\/domains/i.test(titulo)) return [];
  return [
    "A verificação é no painel Resend (resend.com/domains), não no Render.",
    "Adicione o domínio (ex. waje.com.br), configure os registos DNS no seu provedor e aguarde «Verified».",
    "Ative também «Receiving» no domínio para e-mails de entrada (webhook).",
    "É uma configuração única por domínio — todos os agentes @waje.com.br usam o mesmo domínio verificado.",
  ];
}

function montarErroDoCorpo(data: Record<string, unknown>, status: number): ErroCtx {
  const titulo =
    typeof data.error === "string" && data.error.trim()
      ? data.error.trim()
      : `Erro HTTP ${status}`;
  const detalhes: string[] = [];
  if (typeof data.detail === "string" && data.detail.trim()) detalhes.push(data.detail.trim());
  for (const d of detalhesErroResend(titulo)) {
    if (!detalhes.includes(d)) detalhes.push(d);
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

function patchEmailDoCorpo(data: Record<string, unknown>): Partial<AgenteResendSnapshot> | null {
  const patch: Partial<AgenteResendSnapshot> = {};
  let has = false;

  if (typeof data.email_from === "string") {
    patch.email_from = data.email_from.trim() || null;
    has = true;
  }
  if (typeof data.email_from_name === "string") {
    patch.email_from_name = data.email_from_name.trim() || null;
    has = true;
  }
  if (typeof data.email_inbound === "string") {
    patch.email_inbound = data.email_inbound.trim() || null;
    has = true;
  }
  if (typeof data.email_ativo === "boolean") {
    patch.email_ativo = data.email_ativo;
    has = true;
  }

  return has ? patch : null;
}

function AgenteResendSideoverShell({
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
  footer: ReactNode;
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
        <div
          style={{
            borderTop: "1px solid #dcebd8",
            padding: "14px 18px 18px",
            background: "#f8fcf6",
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

export function AgenteResendBlock({
  agenteSlug,
  snapshot,
  onSnapshotPatch,
  agenteNome,
  bloqueado = false,
  layout = "card",
}: AgenteResendBlockProps) {
  const darkSideover = layout === "card";
  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [fromName, setFromName] = useState(snapshot.email_from_name?.trim() || "");
  const [fromEmail, setFromEmail] = useState(snapshot.email_from?.trim() || "");
  const [inbound, setInbound] = useState(snapshot.email_inbound?.trim() || "");
  const [ativo, setAtivo] = useState(snapshot.email_ativo !== false);
  const [resendStatus, setResendStatus] = useState<ResendStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<ErroCtx | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const acoesOff = loading !== null || bloqueado || statusLoading;
  const fromCheck = fromEmail.trim() ? emailFromPermitidoParaResend(fromEmail) : null;
  const fromInvalido = fromCheck !== null && !fromCheck.ok ? fromCheck.error : null;
  const emailConfigurado = Boolean(fromEmail.trim() && inbound.trim() && !fromInvalido);

  useEffect(() => {
    setFromName(snapshot.email_from_name?.trim() || "");
    setFromEmail(snapshot.email_from?.trim() || "");
    setInbound(snapshot.email_inbound?.trim() || "");
    setAtivo(snapshot.email_ativo !== false);
  }, [snapshot.email_from, snapshot.email_from_name, snapshot.email_inbound, snapshot.email_ativo]);

  const onSnapshotPatchRef = useRef(onSnapshotPatch);
  onSnapshotPatchRef.current = onSnapshotPatch;

  const carregarStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/email`, {
        headers: await crmApiHeaders(),
      });
      const data = await lerCorpoApi(res);
      if (!res.ok) {
        setResendStatus(null);
        return;
      }
      setResendStatus({
        resend_configured: data.resend_configured === true,
        domain_hint:
          typeof data.domain_hint === "string" && data.domain_hint.trim() ? data.domain_hint.trim() : null,
        default_from_email:
          typeof data.default_from_email === "string" && data.default_from_email.trim()
            ? data.default_from_email.trim()
            : null,
        resend_setup_hint:
          typeof data.resend_setup_hint === "string" && data.resend_setup_hint.trim()
            ? data.resend_setup_hint.trim()
            : null,
        inbound_webhook_url:
          typeof data.inbound_webhook_url === "string" && data.inbound_webhook_url.trim()
            ? data.inbound_webhook_url.trim()
            : null,
      });
      const patch = patchEmailDoCorpo(data);
      if (patch && onSnapshotPatchRef.current) onSnapshotPatchRef.current(patch);
      if (typeof data.email_from === "string") setFromEmail(data.email_from.trim());
      if (typeof data.email_from_name === "string") setFromName(data.email_from_name.trim());
      if (typeof data.email_inbound === "string") setInbound(data.email_inbound.trim());
      if (typeof data.email_ativo === "boolean") setAtivo(data.email_ativo);
    } catch {
      setResendStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, [agenteSlug]);

  useEffect(() => {
    void carregarStatus();
  }, [carregarStatus, agenteSlug]);

  useEffect(() => {
    if (!sideoverOpen && layout === "card") return;
    void carregarStatus();
  }, [sideoverOpen, layout, carregarStatus]);

  const fieldStyle: CSSProperties = darkSideover
    ? {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 9,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: RF_BORDER_STRONG,
        background: "rgba(6, 13, 8, 0.85)",
        color: RF_TEXT_PRIMARY,
        fontSize: 13,
        boxSizing: "border-box",
      }
    : {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 9,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "#dcebd8",
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

  const btnBase = (disabled: boolean, variant: "default" | "primary" = "default"): CSSProperties => {
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

  async function persistirEmail(opts?: { mensagemSucesso?: string | null }): Promise<boolean> {
    if (fromInvalido) {
      setErr({ titulo: fromInvalido, detalhes: ["Altere o remetente para um @waje.com.br verificado no Resend."] });
      return false;
    }
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify({
          email_from: fromEmail.trim() || null,
          email_from_name: fromName.trim() || null,
          email_inbound: inbound.trim() || null,
          email_ativo: ativo,
        }),
      });
      const data = await lerCorpoApi(res);
      if (!res.ok) {
        setErr(montarErroDoCorpo(data, res.status));
        return false;
      }
      const patch = patchEmailDoCorpo(data) ?? {
        email_from: fromEmail.trim() || null,
        email_from_name: fromName.trim() || null,
        email_inbound: inbound.trim() || null,
        email_ativo: ativo,
      };
      onSnapshotPatchRef.current?.(patch);
      if (opts?.mensagemSucesso) setSucesso(opts.mensagemSucesso);
      void carregarStatus();
      return true;
    } catch {
      setErr({
        titulo: "Falha de rede ao guardar.",
        detalhes: ["Verifique a ligação e se o servidor Next.js está a correr."],
      });
      return false;
    }
  }

  async function salvar() {
    setErr(null);
    setSucesso(null);
    setLoading("save");
    const ok = await persistirEmail({ mensagemSucesso: "Configuração de e-mail guardada." });
    setLoading(null);
    if (!ok) return;
  }

  async function enviarTeste() {
    if (fromInvalido) {
      setErr({
        titulo: fromInvalido,
        detalhes: [
          "O Resend não envia de Gmail/Outlook. Use o mesmo domínio da entrada (ex.: atendimento@waje.com.br).",
        ],
      });
      return;
    }
    const destino = fromEmail.trim() || inbound.trim();
    if (!destino) {
      setErr({
        titulo: "Informe o e-mail de envio (from) ou de entrada antes de testar.",
        detalhes: ["Guarde a configuração e use um endereço válido no domínio verificado no Resend."],
      });
      return;
    }
    setErr(null);
    setSucesso(null);
    setLoading("test");
    const saved = await persistirEmail({ mensagemSucesso: null });
    if (!saved) {
      setLoading(null);
      return;
    }
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/email/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify({ to: destino.trim() }),
      });
      const data = await lerCorpoApi(res);
      if (!res.ok) {
        setErr(montarErroDoCorpo(data, res.status));
        return;
      }
      setSucesso(
        typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : `E-mail de teste enviado para ${destino.trim()}.`
      );
    } catch {
      setErr({
        titulo: "Falha de rede ao enviar teste.",
        detalhes: ["Verifique a ligação e a configuração Resend no servidor."],
      });
    } finally {
      setLoading(null);
    }
  }

  const rotuloEstado = ativo ? (emailConfigurado ? "ATIVO" : "INCOMPLETO") : "INATIVO";
  const badge =
    !ativo
      ? { bg: "#dcebd8", fg: "#5d7a67", bar: "#484f58" }
      : emailConfigurado
        ? { bg: "#23863633", fg: "#3fb950", bar: "#3fb950" }
        : { bg: "#bb800926", fg: "#e6c06a", bar: "#e6c06a" };

  const botoesFooter = (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <button type="button" disabled={acoesOff} style={btnBase(acoesOff, "primary")} onClick={() => void salvar()}>
          {loading === "save" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Guardar
        </button>
        <button
          type="button"
          disabled={acoesOff || !emailConfigurado}
          style={btnBase(acoesOff || !emailConfigurado, "default")}
          title={
            fromEmail.trim()
              ? `Envia teste para ${fromEmail.trim()}`
              : inbound.trim()
                ? `Envia teste para ${inbound.trim()}`
                : "Preencha o e-mail de envio ou de entrada"
          }
          onClick={() => void enviarTeste()}
        >
          {loading === "test" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Enviar teste
        </button>
      </div>
      {layout === "card" ? (
        <button type="button" disabled={acoesOff} style={btnBase(acoesOff)} onClick={() => setSideoverOpen(false)}>
          Fechar
        </button>
      ) : null}
    </div>
  );

  const painelSubtitle =
    "Só agentes no modo «Atendimento (E-mail)». Remetente = quem envia; Entrada = caixa que o cliente usa (correlaciona webhook → este agente).";

  const formulario = (
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
          {statusLoading ? (
            <span style={{ fontSize: 10, color: "#5d7a67" }}>A carregar estado Resend…</span>
          ) : resendStatus?.resend_configured === true ? (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
                background: "#23863633",
                color: "#3fb950",
              }}
            >
              Resend configurado
            </span>
          ) : resendStatus?.resend_configured === false ? (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
                background: "#bb800926",
                color: "#e6c06a",
              }}
            >
              Resend pendente
            </span>
          ) : null}
        </div>
        {resendStatus?.domain_hint ? (
          <p style={{ margin: "10px 0 0", paddingLeft: 12, fontSize: 11, color: "#5d7a67", lineHeight: 1.5 }}>
            <strong style={{ color: darkSideover ? RF_TEXT_SECONDARY : BRAND_TEXT_DARK }}>Domínio Resend:</strong>{" "}
            {resendStatus.domain_hint}
            {resendStatus.default_from_email ? (
              <>
                {" "}
                · sugerido: <code style={{ fontSize: 10 }}>{resendStatus.default_from_email}</code>
              </>
            ) : null}
          </p>
        ) : null}
        {resendStatus?.domain_hint ? (
          <p style={{ margin: "8px 0 0", paddingLeft: 12, fontSize: 11, color: "#5d7a67", lineHeight: 1.5 }}>
            Verifique <strong>{resendStatus.domain_hint}</strong> em{" "}
            <a
              href="https://resend.com/domains"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#79c0ff", textDecoration: "underline" }}
            >
              resend.com/domains
            </a>{" "}
            (DNS + Receiving). Uma vez por domínio — não é no Render nem por agente.
          </p>
        ) : null}
        {resendStatus?.resend_configured === false && resendStatus.resend_setup_hint ? (
          <p
            style={{
              margin: "10px 0 0",
              paddingLeft: 12,
              fontSize: 11,
              color: "#e6c06a",
              lineHeight: 1.55,
            }}
          >
            {resendStatus.resend_setup_hint}
          </p>
        ) : null}
      </div>

      <div style={{ padding: "14px 16px", ...cardSurface }}>
        <p style={{ margin: "0 0 12px", color: CRM_ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 0.06 }}>
          REMETENTE
        </p>
        <label style={{ display: "block", color: "#5d7a67", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
          Nome do remetente
        </label>
        <input
          value={fromName}
          onChange={(e) => setFromName(e.target.value)}
          placeholder="Ex: Ana — Waje Atendimento"
          style={{ ...fieldStyle, marginBottom: 12 }}
        />
        <label style={{ display: "block", color: "#5d7a67", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
          E-mail de envio (from)
        </label>
        <input
          type="email"
          value={fromEmail}
          onChange={(e) => setFromEmail(e.target.value)}
          placeholder={
            resendStatus?.default_from_email?.trim() || "atendimento@empresa.com (domínio verificado no Resend)"
          }
          style={{
            ...fieldStyle,
            ...(fromInvalido
              ? { borderColor: "#f85149", boxShadow: "0 0 0 1px rgba(248, 81, 73, 0.35)" }
              : {}),
          }}
        />
        {fromInvalido ? (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(248, 81, 73, 0.45)",
              background: "rgba(248, 81, 73, 0.12)",
              fontSize: 11,
              lineHeight: 1.5,
              color: "#ffb4af",
            }}
          >
            <p style={{ margin: 0 }}>{fromInvalido}</p>
            {resendStatus?.default_from_email ? (
              <button
                type="button"
                disabled={acoesOff}
                onClick={() => setFromEmail(resendStatus.default_from_email!.trim())}
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(248, 81, 73, 0.5)",
                  background: "transparent",
                  color: "#ffb4af",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: acoesOff ? "not-allowed" : "pointer",
                }}
              >
                Usar sugerido: {resendStatus.default_from_email}
              </button>
            ) : null}
          </div>
        ) : (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#5d7a67", lineHeight: 1.45 }}>
            Não use Gmail/Outlook pessoal — o Resend só envia de domínios verificados (ex.{" "}
            <strong>@waje.com.br</strong>).
          </p>
        )}
      </div>

      <div style={{ padding: "14px 16px", ...cardSurface }}>
        <p style={{ margin: "0 0 12px", color: CRM_ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 0.06 }}>
          ENTRADA
        </p>
        <label style={{ display: "block", color: "#5d7a67", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
          Endereço de entrada (inbound)
        </label>
        <input
          type="email"
          value={inbound}
          onChange={(e) => setInbound(e.target.value)}
          placeholder="respostas@inbound.empresa.com"
          style={{ ...fieldStyle, marginBottom: 8 }}
        />
        <p style={{ margin: "0 0 12px", fontSize: 11, color: "#5d7a67", lineHeight: 1.45 }}>
          E-mails enviados para este endereço são roteados para <strong>este agente</strong> (campo único no CRM).
          Leads criados por e-mail aparecem com aba <strong>E-mail</strong> no painel do lead — separada do WhatsApp.
        </p>
        <ol style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 11, color: "#5d7a67", lineHeight: 1.5 }}>
          <li>Verifique o domínio no Resend (Receiving ativo).</li>
          <li>Preencha remetente + entrada abaixo e guarde.</li>
          <li>Configure o webhook <code style={{ fontSize: 10 }}>email.received</code> (ver «Dicas de webhook»).</li>
          <li>
            «Enviar teste» envia para o e-mail de envio (from) — sem popup. Depois, teste a entrada com um e-mail
            real para o endereço inbound.
          </li>
        </ol>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: acoesOff ? "not-allowed" : "pointer",
            color: darkSideover ? RF_TEXT_PRIMARY : "#0b2210",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={ativo}
            disabled={acoesOff}
            onChange={(e) => setAtivo(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: CRM_ACCENT }}
          />
          Canal de e-mail ativo
        </label>
      </div>

      <details
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: darkSideover ? `1px solid ${RF_BORDER}` : "1px solid #dcebd8",
          background: darkSideover ? "rgba(6, 13, 8, 0.55)" : "#f8fcf6",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            color: "#5d7a67",
            fontSize: 12,
            fontWeight: 700,
            listStyle: "none",
            userSelect: "none",
          }}
        >
          Dicas de webhook
        </summary>
        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.55, color: "#5d7a67" }}>
          <p style={{ margin: 0 }}>
            No painel Resend → Webhooks, use o evento <strong>email.received</strong> e a URL abaixo (Endpoint
            URL):
          </p>
          {resendStatus?.inbound_webhook_url ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 11,
                wordBreak: "break-all",
                fontFamily: "ui-monospace, monospace",
                color: "#79c0ff",
              }}
            >
              {resendStatus.inbound_webhook_url}
            </p>
          ) : (
            <p style={{ margin: "8px 0 0", fontSize: 11 }}>
              Defina <code style={{ fontSize: 10 }}>EMAIL_INBOUND_WEBHOOK_SECRET</code> no Render e{" "}
              <code style={{ fontSize: 10 }}>NEXT_PUBLIC_APP_URL</code> para gerar a URL completa aqui.
            </p>
          )}
          <p style={{ margin: "8px 0 0", fontSize: 11 }}>
            Cada e-mail recebido no endereço inbound dispara o ciclo de interação deste agente.
          </p>
        </div>
      </details>

      {sucesso ? (
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

  if (layout === "inline") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {formulario}
        {botoesFooter}
      </div>
    );
  }

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
              background: "linear-gradient(90deg, #3f9848, #2d6a4f, #1f6feb)",
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
                    background: "linear-gradient(145deg, #3f984833, #2d6a4f18)",
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
                    E-mail (Resend)
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#5d7a67", fontSize: 12, lineHeight: 1.45 }}>
                    {fromEmail.trim() ? `${fromName.trim() ? `${fromName} · ` : ""}${fromEmail}` : "Configure remetente e entrada · "}
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
                  {inbound.trim() ? (
                    <p style={{ margin: "6px 0 0", color: "#6e7681", fontSize: 11 }}>
                      Entrada: <strong style={{ color: "#2d4a38" }}>{inbound}</strong>
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
                Configurar canal
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AgenteResendSideoverShell
        embedded={layout === "painel"}
        open={layout === "painel" ? true : sideoverOpen}
        onClose={() => setSideoverOpen(false)}
        title={agenteNome?.trim() || agenteSlug}
        subtitle={painelSubtitle}
        footer={botoesFooter}
      >
        {formulario}
      </AgenteResendSideoverShell>
    </>
  );
}
