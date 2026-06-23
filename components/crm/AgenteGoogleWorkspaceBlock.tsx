"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, Check, Loader2, Plug } from "lucide-react";
import { CRM_ACCENT } from "@/lib/crm/crm-button-styles";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";
import {
  GOOGLE_INTEGRADOR_FERRAMENTA_KEYS,
  googleOAuthErroAmigavel,
  googleOAuthTesteErroAmigavel,
  saveWizardOAuthResume,
  wizardGoogleOAuthReturnTo,
} from "@/lib/hub/agente-wizard-google";
import { mergeUsoFerramentasComPadraoPreservandoCustom } from "@/lib/hub/agente-ferramentas-registry";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";

export type AgenteGoogleWorkspaceBlockProps = {
  agenteSlug: string;
  theme?: "dark" | "light";
  usoFerramentas: Record<string, boolean>;
  onUsoSynced?: (patch: Record<string, boolean>) => void;
  oauthEmail?: string | null;
  onOauthEmail?: (email: string | null) => void;
  contexto?: "agendamento" | "padrao";
  secaoIndice?: number;
  /** Retorno OAuth após autorizar (ficha do agente). */
  returnToPath?: string;
};

type GoogleTestResult = {
  ok: boolean;
  gmail_email?: string;
  mensagem?: string;
  error?: string;
  detalhe?: unknown;
  calendar?: { total?: number; eventos?: unknown[] };
};

export function AgenteGoogleWorkspaceBlock({
  agenteSlug,
  theme = "light",
  usoFerramentas,
  onUsoSynced,
  oauthEmail,
  onOauthEmail,
  contexto = "padrao",
  secaoIndice,
  returnToPath,
}: AgenteGoogleWorkspaceBlockProps) {
  const isDark = theme === "dark";
  const agendamento = contexto === "agendamento";
  const border = isDark ? RF_BORDER : "#dcebd8";
  const cardBg = isDark ? "rgba(6, 13, 8, 0.72)" : "#ffffff";
  const title = isDark ? RF_TEXT_PRIMARY : "#0b2210";
  const body = isDark ? RF_TEXT_SECONDARY : "#5d7a67";
  const muted = isDark ? RF_TEXT_MUTED : "#6e7781";
  const accent = isDark ? RF_ACCENT : CRM_ACCENT;

  const [ligado, setLigado] = useState(false);
  const [email, setEmail] = useState<string | null>(oauthEmail ?? null);
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [teste, setTeste] = useState<GoogleTestResult | null>(null);

  const refreshStatus = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores", { headers });
      const data = (await res.json().catch(() => ({}))) as {
        conexoes?: Record<string, { configurado?: boolean }>;
      };
      if (!res.ok) throw new Error("Não foi possível ler integrações.");
      const gmailOk = data.conexoes?.gmail?.configurado === true;
      const calOk = data.conexoes?.google_calendar?.configurado === true;
      setLigado(gmailOk && calOk);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar status.");
      setLigado(false);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (oauthEmail) setEmail(oauthEmail);
  }, [oauthEmail]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_oauth") !== "error" && params.get("email_oauth") !== "error") return;
    const raw = params.get("email_oauth_error") || params.get("email_oauth_message");
    setErro(googleOAuthErroAmigavel(raw));
    params.delete("google_oauth");
    params.delete("email_oauth");
    params.delete("email_oauth_error");
    params.delete("email_oauth_message");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
  }, []);

  const syncFerramentasNoAgente = useCallback(async () => {
    const uso = mergeUsoFerramentasComPadraoPreservandoCustom(usoFerramentas);
    const patch: Record<string, boolean> = {};
    for (const key of GOOGLE_INTEGRADOR_FERRAMENTA_KEYS) {
      if (uso[key] === true) patch[key] = true;
    }
    if (Object.keys(patch).length === 0) {
      for (const key of GOOGLE_INTEGRADOR_FERRAMENTA_KEYS) {
        patch[key] = true;
      }
    }

    const headers = await crmApiHeaders();
    const body = {
      motor_ferramentas_habilitado: true,
      uso_ferramentas_ia: { ...uso, ...patch },
    };
    const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j: unknown = await res.json().catch(() => null);
      const msg =
        j && typeof j === "object" && "error" in j && typeof (j as { error?: string }).error === "string"
          ? (j as { error: string }).error
          : "Falha ao gravar ferramentas no agente.";
      throw new Error(msg);
    }
    onUsoSynced?.(patch);
  }, [agenteSlug, onUsoSynced, usoFerramentas]);

  const ligarContaGoogle = useCallback(async () => {
    setBusy(true);
    setErro("");
    try {
      saveWizardOAuthResume({ passo: secaoIndice != null ? 8 : 9, agenteSlug });
      const headers = await crmApiHeaders();
      const returnTo =
        returnToPath?.trim() ||
        wizardGoogleOAuthReturnTo(agenteSlug);
      const res = await fetch(
        `/api/hub/integradores/oauth/google/start?json=1&agente_slug=${encodeURIComponent(agenteSlug)}&return_to=${encodeURIComponent(returnTo)}`,
        { headers }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.authorize_url !== "string") {
        throw new Error(typeof data?.error === "string" ? data.error : "Não foi possível iniciar OAuth Google.");
      }
      window.location.href = data.authorize_url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao ligar Google");
      setBusy(false);
    }
  }, [agenteSlug, returnToPath, secaoIndice]);

  const testarIntegracao = useCallback(async () => {
    setBusy(true);
    setErro("");
    setTeste(null);
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/oauth/google/test", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as GoogleTestResult;
      if (!res.ok || !data.ok) {
        throw new Error(googleOAuthTesteErroAmigavel(data.error, data.detalhe));
      }
      setTeste(data);
      if (data.gmail_email) {
        setEmail(data.gmail_email);
        onOauthEmail?.(data.gmail_email);
      }
      await syncFerramentasNoAgente();
      setLigado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro no teste");
    } finally {
      setBusy(false);
    }
  }, [onOauthEmail, syncFerramentasNoAgente]);

  return (
    <section
      style={{
        borderRadius: 14,
        border: `1px solid ${border}`,
        background: cardBg,
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: "14px 16px",
          borderBottom: `1px solid ${border}`,
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: isDark ? "rgba(146, 255, 0, 0.12)" : "#eef7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accent,
            flexShrink: 0,
          }}
        >
          <Plug size={22} strokeWidth={2} aria-hidden />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {secaoIndice != null ? (
            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: muted, letterSpacing: 0.06 }}>
              SECÇÃO {secaoIndice}
            </p>
          ) : null}
          <p
            style={{
              margin: secaoIndice != null ? "2px 0 0" : 0,
              fontSize: 11,
              fontWeight: 700,
              color: accent,
              letterSpacing: 0.04,
            }}
          >
            {agendamento ? "AGENDA DA EMPRESA" : "GOOGLE WORKSPACE"}
          </p>
          <h3 style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 800, color: title }}>
            {agendamento ? "Google Calendar + Meet" : "Gmail + Agenda (Google Meet)"}
          </h3>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: body, lineHeight: 1.5 }}>
            {agendamento
              ? "Autorize o e-mail Google da empresa contratante. O agente consulta horários e cria reservas com link Meet quando o cliente pedir pelo WhatsApp."
              : "Uma autorização OAuth liga envio de e-mail e criação de eventos com link Meet para este tenant."}
          </p>
          {carregando ? (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: muted }}>A verificar ligação…</p>
          ) : ligado ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginTop: 8,
                fontSize: 10,
                fontWeight: 700,
                color: "#3fb950",
              }}
            >
              <Check size={12} />
              Ligado{email ? ` · ${email}` : ""}
            </span>
          ) : (
            <span style={{ display: "block", marginTop: 8, fontSize: 11, color: "#c9a24a", fontWeight: 600 }}>
              Conta Google ainda não ligada
            </span>
          )}
        </div>
      </header>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {erro ? (
          <p style={{ margin: 0, color: "#f85149", fontSize: 12, lineHeight: 1.45 }}>{erro}</p>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            onClick={() => void ligarContaGoogle()}
            disabled={busy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${accent}`,
              background: isDark ? "rgba(146, 255, 0, 0.1)" : "#2d6a4f12",
              color: accent,
              fontWeight: 700,
              fontSize: 13,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? <Loader2 size={16} /> : <Plug size={16} />}
            Ligar conta Google da empresa
          </button>

          <button
            type="button"
            onClick={() => void testarIntegracao()}
            disabled={busy || carregando}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: "transparent",
              color: title,
              fontWeight: 700,
              fontSize: 13,
              cursor: busy || carregando ? "wait" : "pointer",
            }}
          >
            {busy ? <Loader2 size={16} /> : <Calendar size={16} />}
            Testar Gmail + Calendar
          </button>
        </div>

        {teste?.ok ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #23863644",
              background: "#23863618",
              fontSize: 12,
              color: "#3fb950",
              lineHeight: 1.5,
            }}
          >
            <strong>{teste.mensagem ?? "Teste OK"}</strong>
            {teste.gmail_email ? (
              <>
                <br />
                E-mail: {teste.gmail_email}
              </>
            ) : null}
            {typeof teste.calendar?.total === "number" ? (
              <>
                <br />
                Próximos eventos na agenda: {teste.calendar.total}
              </>
            ) : null}
          </div>
        ) : null}

        <p style={{ margin: 0, fontSize: 11, color: muted, lineHeight: 1.5 }}>
          Ferramentas activadas no agente: enviar e-mail, criar evento com Meet e listar compromissos. O modelo usa
          estas funções quando o cliente pedir reunião ou contacto por e-mail.
        </p>
      </div>
    </section>
  );
}
