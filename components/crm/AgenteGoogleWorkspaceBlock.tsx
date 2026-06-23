"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Calendar, Check, ChevronRight, Loader2, Plug, Video } from "lucide-react";
import { CrmToggleSwitch } from "@/components/crm/CrmToggleSwitch";
import { IntegracaoMarcaIcon } from "@/components/crm/IntegracaoMarcaIcon";
import { CrmIntegracaoSideoverShell } from "@/components/crm/AgenteUazapiBlock";
import { CRM_ACCENT, crmBtnPrimaryLg } from "@/lib/crm/crm-button-styles";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
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
  agenteNome?: string;
  theme?: "dark" | "light";
  usoFerramentas: Record<string, boolean>;
  onUsoSynced?: (patch: Record<string, boolean>) => void;
  oauthEmail?: string | null;
  onOauthEmail?: (email: string | null) => void;
  contexto?: "agendamento" | "padrao";
  secaoIndice?: number;
  /** Retorno OAuth após autorizar (ficha do agente). */
  returnToPath?: string;
  /** `card` — resumo + sideover (ficha). `painel` — bloco completo inline (wizard). */
  layout?: "card" | "painel";
};

type GoogleTestResult = {
  ok: boolean;
  gmail_email?: string;
  mensagem?: string;
  error?: string;
  detalhe?: unknown;
  calendar?: { total?: number; eventos?: unknown[] };
};

function googleBadge(ligado: boolean): { bg: string; fg: string; bar: string; rotulo: string } {
  if (ligado) {
    return { bg: "#23863633", fg: "#3fb950", bar: "#3fb950", rotulo: "LIGADO" };
  }
  return { bg: "#dcebd8", fg: "#5d7a67", bar: "#484f58", rotulo: "NÃO LIGADO" };
}

export function AgenteGoogleWorkspaceBlock({
  agenteSlug,
  agenteNome,
  theme = "light",
  usoFerramentas,
  onUsoSynced,
  oauthEmail,
  onOauthEmail,
  contexto = "padrao",
  secaoIndice,
  returnToPath,
  layout = "painel",
}: AgenteGoogleWorkspaceBlockProps) {
  const isCard = layout === "card";
  const isDark = isCard ? true : theme === "dark";
  const agendamento = contexto === "agendamento";
  const border = isDark ? RF_BORDER : "#dcebd8";
  const cardBg = isDark ? "rgba(6, 13, 8, 0.72)" : "#ffffff";
  const title = isDark ? RF_TEXT_PRIMARY : "#0b2210";
  const body = isDark ? RF_TEXT_SECONDARY : "#5d7a67";
  const muted = isDark ? RF_TEXT_MUTED : "#6e7781";
  const accent = isDark ? RF_ACCENT : CRM_ACCENT;

  const tituloIntegracao = agendamento ? "Google Calendar + Meet" : "Gmail + Agenda (Google Meet)";
  const subtituloCard = agendamento
    ? "Agenda da empresa · Gmail e reuniões Meet"
    : "Gmail e Google Calendar · OAuth do tenant";

  const [sideoverOpen, setSideoverOpen] = useState(false);
  const [ligado, setLigado] = useState(false);
  const [email, setEmail] = useState<string | null>(oauthEmail ?? null);
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [teste, setTeste] = useState<GoogleTestResult | null>(null);
  const [agendaCfg, setAgendaCfg] = useState({
    duracao_reserva_min: 90,
    abertura: "11:30",
    fechamento: "23:00",
    timezone: "America/Sao_Paulo",
    com_meet: false,
  });
  const [agendaCfgCarregando, setAgendaCfgCarregando] = useState(false);
  const [agendaCfgSalvo, setAgendaCfgSalvo] = useState(false);

  const badge = googleBadge(ligado);

  const carregarAgendaConfig = useCallback(async () => {
    setAgendaCfgCarregando(true);
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/agenda-config", { headers });
      const data = (await res.json().catch(() => ({}))) as {
        config?: typeof agendaCfg;
      };
      if (res.ok && data.config) {
        setAgendaCfg({
          duracao_reserva_min: data.config.duracao_reserva_min ?? 90,
          abertura: data.config.abertura ?? "11:30",
          fechamento: data.config.fechamento ?? "23:00",
          timezone: data.config.timezone ?? "America/Sao_Paulo",
          com_meet: data.config.com_meet === true,
        });
      }
    } catch {
      /* mantém defaults */
    } finally {
      setAgendaCfgCarregando(false);
    }
  }, []);

  const salvarAgendaConfig = useCallback(async () => {
    setBusy(true);
    setErro("");
    setAgendaCfgSalvo(false);
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/agenda-config", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(agendaCfg),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; config?: typeof agendaCfg };
      if (!res.ok) throw new Error(data.error || "Falha ao gravar horários da agenda.");
      if (data.config) setAgendaCfg(data.config);
      setAgendaCfgSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gravar agenda.");
    } finally {
      setBusy(false);
    }
  }, [agendaCfg]);

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
    void carregarAgendaConfig();
  }, [refreshStatus, carregarAgendaConfig]);

  useEffect(() => {
    if (sideoverOpen) void carregarAgendaConfig();
  }, [sideoverOpen, carregarAgendaConfig]);

  useEffect(() => {
    if (oauthEmail) setEmail(oauthEmail);
  }, [oauthEmail]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_oauth") === "connected" || params.get("email_oauth") === "connected") {
      void refreshStatus();
      if (isCard) setSideoverOpen(true);
    }
    if (params.get("google_oauth") !== "error" && params.get("email_oauth") !== "error") return;
    const raw = params.get("email_oauth_error") || params.get("email_oauth_message");
    setErro(googleOAuthErroAmigavel(raw));
    if (isCard) setSideoverOpen(true);
    params.delete("google_oauth");
    params.delete("email_oauth");
    params.delete("email_oauth_error");
    params.delete("email_oauth_message");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
  }, [isCard, refreshStatus]);

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

  const btnPrimaryDark = (disabled: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 8,
    border: "none",
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "#4a6356" : BRAND_TEXT_DARK,
    color: disabled ? "#c8dcc8" : BRAND_GREEN_BRIGHT,
    boxShadow: disabled ? "none" : "0 2px 8px rgba(11, 31, 16, 0.12)",
  });

  const btnSecondaryDark = (disabled: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    minHeight: 40,
    padding: "9px 14px",
    borderRadius: 8,
    border: `1px solid ${RF_BORDER_STRONG}`,
    background: "rgba(6, 13, 8, 0.72)",
    color: disabled ? RF_TEXT_MUTED : RF_TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  const painelConteudo = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          position: "relative",
          padding: "14px 16px",
          borderRadius: 12,
          border: `1px solid ${isCard ? RF_BORDER : border}`,
          background: isCard ? "rgba(6, 13, 8, 0.72)" : cardBg,
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
        <div style={{ paddingLeft: 12 }}>
          <span
            style={{
              display: "inline-block",
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              background: badge.bg,
              color: badge.fg,
            }}
          >
            {carregando ? "A VERIFICAR…" : badge.rotulo}
          </span>
          {email ? (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: isCard ? RF_TEXT_SECONDARY : body, lineHeight: 1.5 }}>
              Conta: <strong style={{ color: isCard ? RF_TEXT_PRIMARY : title }}>{email}</strong>
            </p>
          ) : null}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: isCard ? RF_TEXT_SECONDARY : body, lineHeight: 1.55 }}>
        {agendamento
          ? "Autorize o e-mail Google da empresa contratante. O agente consulta horários e cria reservas com link Meet quando o cliente pedir pelo WhatsApp."
          : "Uma autorização OAuth liga envio de e-mail e criação de eventos com link Meet para este tenant."}
      </p>

      {erro ? (
        <p style={{ margin: 0, color: "#f85149", fontSize: 12, lineHeight: 1.45 }}>{erro}</p>
      ) : null}

      {!isCard ? (
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
      ) : null}

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

      <div
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: `1px solid ${isCard ? RF_BORDER : border}`,
          background: isCard ? "rgba(6, 13, 8, 0.45)" : "#f8fbf8",
        }}
      >
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 800, color: isCard ? RF_TEXT_PRIMARY : title }}>
          Horário da agenda (esta empresa)
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 11, color: muted, lineHeight: 1.45 }}>
          Cada cliente Waje define duração da reserva e funcionamento. O agente calcula vagas com estes valores.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: muted }}>
            Duração (min)
            <input
              type="number"
              min={15}
              max={480}
              step={15}
              value={agendaCfg.duracao_reserva_min}
              disabled={busy || agendaCfgCarregando}
              onChange={(e) => {
                setAgendaCfgSalvo(false);
                setAgendaCfg((c) => ({ ...c, duracao_reserva_min: Number(e.target.value) || 90 }));
              }}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, fontSize: 12 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: muted }}>
            Fuso
            <input
              type="text"
              value={agendaCfg.timezone}
              disabled={busy || agendaCfgCarregando}
              onChange={(e) => {
                setAgendaCfgSalvo(false);
                setAgendaCfg((c) => ({ ...c, timezone: e.target.value }));
              }}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, fontSize: 12 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: muted }}>
            Abertura
            <input
              type="time"
              value={agendaCfg.abertura}
              disabled={busy || agendaCfgCarregando}
              onChange={(e) => {
                setAgendaCfgSalvo(false);
                setAgendaCfg((c) => ({ ...c, abertura: e.target.value }));
              }}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, fontSize: 12 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: muted }}>
            Fechamento
            <input
              type="time"
              value={agendaCfg.fechamento}
              disabled={busy || agendaCfgCarregando}
              onChange={(e) => {
                setAgendaCfgSalvo(false);
                setAgendaCfg((c) => ({ ...c, fechamento: e.target.value }));
              }}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, fontSize: 12 }}
            />
          </label>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${
              agendaCfg.com_meet
                ? isDark
                  ? "rgba(63, 152, 72, 0.45)"
                  : "#388bfd44"
                : isDark
                  ? RF_BORDER
                  : border
            }`,
            background: agendaCfg.com_meet
              ? isDark
                ? "rgba(146, 255, 0, 0.08)"
                : "rgba(56, 139, 253, 0.06)"
              : isDark
                ? "rgba(6, 13, 8, 0.85)"
                : "#ffffff",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: agendaCfg.com_meet
                ? isDark
                  ? "rgba(146, 255, 0, 0.14)"
                  : "rgba(56, 139, 253, 0.18)"
                : isDark
                  ? "rgba(11, 31, 16, 0.9)"
                  : "#eef7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: agendaCfg.com_meet ? (isDark ? "#86efac" : "#0969da") : muted,
            }}
            aria-hidden
          >
            <Video size={20} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              id="label-google-meet-agenda"
              style={{ color: isDark ? RF_TEXT_PRIMARY : title, fontSize: 13, fontWeight: 700 }}
            >
              Link Google Meet
            </span>
            <span
              style={{
                display: "block",
                color: isDark ? RF_TEXT_SECONDARY : body,
                fontWeight: 400,
                fontSize: 12,
                marginTop: 2,
                lineHeight: 1.45,
              }}
            >
              Reuniões online com videoconferência · desligado para reservas de restaurante
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: agendaCfg.com_meet ? "#3fb950" : muted,
              }}
            >
              {agendaCfg.com_meet ? "ACTIVO" : "INACTIVO"}
            </span>
            <CrmToggleSwitch
              checked={agendaCfg.com_meet}
              disabled={busy || agendaCfgCarregando}
              labelledBy="label-google-meet-agenda"
              variant={isDark ? "dark" : "light"}
              onCheckedChange={(v) => {
                setAgendaCfgSalvo(false);
                setAgendaCfg((c) => ({ ...c, com_meet: v }));
              }}
            />
          </div>
        </div>
        <button
          type="button"
          disabled={busy || agendaCfgCarregando}
          style={{ ...btnSecondaryDark(busy || agendaCfgCarregando), marginTop: 10 }}
          onClick={() => void salvarAgendaConfig()}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          Guardar horários da agenda
        </button>
        {agendaCfgSalvo ? (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#3fb950" }}>Configuração gravada para este tenant.</p>
        ) : null}
      </div>

      <p style={{ margin: 0, fontSize: 11, color: muted, lineHeight: 1.5 }}>
        Ferramentas activadas no agente: enviar e-mail, criar evento com Meet e listar compromissos. O modelo usa estas
        funções quando o cliente pedir reunião ou contacto por e-mail.
      </p>
    </div>
  );

  const sideoverFooter = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        type="button"
        disabled={busy}
        style={btnPrimaryDark(busy)}
        onClick={() => void ligarContaGoogle()}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Plug size={15} />}
        Ligar conta Google da empresa
      </button>
      <button
        type="button"
        disabled={busy || carregando}
        style={btnSecondaryDark(busy || carregando)}
        onClick={() => void testarIntegracao()}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Calendar size={15} />}
        Testar Gmail + Calendar
      </button>
      {isCard ? (
        <button
          type="button"
          style={btnSecondaryDark(false)}
          onClick={() => setSideoverOpen(false)}
        >
          Fechar
        </button>
      ) : null}
    </div>
  );

  const painelSubtitle = ligado
    ? "Conta Google ligada — teste Gmail e Calendar ou volte a autorizar outro e-mail."
    : "Autorize o e-mail Google da empresa para o agente enviar e-mails e criar reuniões Meet.";

  if (isCard) {
    return (
      <>
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
              background: "linear-gradient(90deg, #4285f4, #ea4335, #fbbc04, #34a853)",
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
                    background: "linear-gradient(145deg, #4285f422, #34a85318)",
                    border: "1px solid #4285f444",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IntegracaoMarcaIcon
                    variant={agendamento ? "google-calendar" : "google"}
                    size={22}
                  />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, color: "#0b2210", fontSize: 14, fontWeight: 800 }}>
                    {tituloIntegracao}
                  </p>
                  <p style={{ margin: "4px 0 0", color: "#5d7a67", fontSize: 12, lineHeight: 1.45 }}>
                    {subtituloCard} ·{" "}
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
                      {carregando ? "…" : badge.rotulo}
                    </span>
                  </p>
                  {email ? (
                    <p style={{ margin: "6px 0 0", color: "#6e7681", fontSize: 11 }}>
                      Conta: <strong style={{ color: "#2d4a38" }}>{email}</strong>
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSideoverOpen(true)}
                style={{
                  ...crmBtnPrimaryLg(false),
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

        <CrmIntegracaoSideoverShell
          open={sideoverOpen}
          onClose={() => setSideoverOpen(false)}
          title={agenteNome?.trim() || agenteSlug}
          subtitle={painelSubtitle}
          footer={sideoverFooter}
          theme="dark"
          sectionLabel="Google Workspace"
        >
          {painelConteudo}
        </CrmIntegracaoSideoverShell>
      </>
    );
  }

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
          <IntegracaoMarcaIcon
            variant={agendamento ? "google-calendar" : "google"}
            size={24}
          />
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
            {tituloIntegracao}
          </h3>
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

      <div style={{ padding: "14px 16px" }}>{painelConteudo}</div>
    </section>
  );
}
