"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plug, Save, X } from "lucide-react";
import { CrmFerramentaAgentesPanel } from "@/components/crm/CrmFerramentaAgentesPanel";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_INPUT_STYLE,
  RF_LABEL_STYLE,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfAsideBodyStyle,
  rfAsideFooterStyle,
  rfAsideHeaderStyle,
  rfAsideStyle,
  rfCloseButtonStyle,
  rfInnerPanelStyle,
  rfOverlayStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import type { IntegradorCatalogoEntry } from "@/lib/hub/integradores-catalogo";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { mergeUsoFerramentasComPadraoPreservandoCustom } from "@/lib/hub/agente-ferramentas-registry";
import type { AgenteFerramentaSyncRow } from "@/lib/hub/sync-ferramenta-agentes";
import { syncFerramentaEmAgentes } from "@/lib/hub/sync-ferramenta-agentes";

type Props = {
  open: boolean;
  integrador: IntegradorCatalogoEntry | null;
  configurado: boolean;
  agentes?: AgenteFerramentaSyncRow[];
  agentesNomes?: Record<string, string>;
  onClose: () => void;
  onSaved?: () => void;
};

export function CrmIntegradorSideover({
  open,
  integrador,
  configurado,
  agentes = [],
  agentesNomes = {},
  onClose,
  onSaved,
}: Props) {
  const [principal, setPrincipal] = useState("");
  const [extra, setExtra] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [agentesSel, setAgentesSel] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setPrincipal("");
      setExtra("");
      setEmail("");
      setErro("");
      setBusy(false);
      setAgentesSel(new Set());
      return;
    }
    if (integrador && agentes.length > 0) {
      const keys = integrador.ferramentas.map((f) => f.ferramenta_key);
      const sel = new Set<string>();
      for (const a of agentes) {
        const slug = a.agente_slug?.trim();
        if (!slug) continue;
        const uso = mergeUsoFerramentasComPadraoPreservandoCustom(a.uso_ferramentas_ia);
        if (keys.some((k) => uso[k] === true)) sel.add(slug);
      }
      setAgentesSel(sel);
    }
  }, [open, integrador?.id, agentes]);

  const conectar = useCallback(async () => {
    if (!integrador) return;
    setBusy(true);
    setErro("");
    try {
      const headers = await crmApiHeaders();
      const res = await fetch("/api/hub/integradores/conectar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          integrador_id: integrador.id,
          credencial_principal: principal.trim(),
          credencial_extra: extra.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Falha ao ligar integração.");
      }

      for (const f of integrador.ferramentas) {
        await syncFerramentaEmAgentes(headers, f.ferramenta_key, [...agentesSel], agentes, {
          ligarMotor: true,
        });
      }
      onSaved?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }, [integrador, principal, extra, email, agentesSel, agentes, onSaved]);

  if (!open || !integrador) return null;

  const precisaExtra = integrador.authModo === "zendesk";

  return (
    <>
      <button type="button" aria-label="Fechar" onClick={onClose} style={rfOverlayStyle(212)} />
      <aside role="dialog" aria-modal="true" style={rfAsideStyle("min(520px, 100vw)", 213)}>
        <header style={rfAsideHeaderStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>INTEGRAÇÃO · AGENTE IA</p>
                <h2 style={{ margin: "4px 0 0", fontSize: 17, fontWeight: 800, color: RF_TEXT_PRIMARY }}>
                  {integrador.nome}
                </h2>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: RF_TEXT_SECONDARY, lineHeight: 1.45 }}>
                  {integrador.descricao}
                </p>
                {configurado ? (
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
                    Ligado
                  </span>
                ) : null}
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" style={rfCloseButtonStyle()}>
              <X size={16} />
            </button>
          </div>
        </header>

        <div style={rfAsideBodyStyle()}>
          {erro ? <p style={{ margin: "0 0 12px", color: "#f85149", fontSize: 12 }}>{erro}</p> : null}

          <div style={rfInnerPanelStyle()}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>
                Credenciais (só o essencial)
              </p>
            </div>
            <div style={{ padding: "12px 14px" }}>
              <label style={{ display: "block", marginBottom: 14 }}>
                <span style={RF_LABEL_STYLE}>{integrador.authLabels.principal}</span>
                <input
                  type="password"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  placeholder={integrador.authLabels.principalPlaceholder}
                  disabled={busy}
                  style={{ ...RF_INPUT_STYLE, marginTop: 6, fontFamily: "ui-monospace, monospace" }}
                />
              </label>
              {precisaExtra ? (
                <>
                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={RF_LABEL_STYLE}>{integrador.authLabels.extra}</span>
                    <input
                      type="text"
                      value={extra}
                      onChange={(e) => setExtra(e.target.value)}
                      placeholder={integrador.authLabels.extraPlaceholder}
                      disabled={busy}
                      style={{ ...RF_INPUT_STYLE, marginTop: 6, fontFamily: "ui-monospace, monospace" }}
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <span style={RF_LABEL_STYLE}>E-mail Zendesk (opcional)</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="suporte@empresa.com"
                      disabled={busy}
                      style={{ ...RF_INPUT_STYLE, marginTop: 6 }}
                    />
                  </label>
                </>
              ) : null}
              <p style={{ margin: "12px 0 0", fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
                Google Calendar e Gmail usam token OAuth de curta duração. Gere no Google Cloud Console e renove quando
                expirar.
              </p>
            </div>
          </div>

          <div style={{ ...rfInnerPanelStyle(), marginTop: 12 }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>
                Funções incluídas (function calling)
              </p>
            </div>
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {integrador.ferramentas.map((f) => (
                <div
                  key={f.ferramenta_key}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${RF_BORDER}`,
                    background: "rgba(6,13,8,0.45)",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: RF_TEXT_PRIMARY }}>{f.titulo}</p>
                  <code style={{ display: "block", marginTop: 4, fontSize: 10, color: "#79c0ff" }}>
                    {f.ferramenta_key}
                  </code>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: RF_TEXT_MUTED }}>{f.descricao_curta}</p>
                </div>
              ))}
            </div>
          </div>

          {agentes.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <CrmFerramentaAgentesPanel
                ferramentaKey={integrador.ferramentas[0]?.ferramenta_key ?? null}
                agentes={agentes}
                nomes={agentesNomes}
                seleccionados={agentesSel}
                onToggle={(slug, ativo) => {
                  setAgentesSel((prev) => {
                    const next = new Set(prev);
                    if (ativo) next.add(slug);
                    else next.delete(slug);
                    return next;
                  });
                }}
                disabled={busy}
                theme="dark"
              />
              <p style={{ margin: "8px 0 0", fontSize: 10, color: RF_TEXT_MUTED }}>
                Ao guardar, todas as funções deste integrador são activadas nos agentes seleccionados.
              </p>
            </div>
          ) : null}
        </div>

        <footer style={rfAsideFooterStyle()}>
          <button
            type="button"
            onClick={() => void conectar()}
            disabled={busy || !principal.trim() || (precisaExtra && !extra.trim())}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(146,255,0,0.35)",
              background: "rgba(146,255,0,0.1)",
              color: RF_ACCENT,
              fontSize: 13,
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : configurado ? <Save size={16} /> : <Plug size={16} />}
            {configurado ? "Actualizar ligação" : "Ligar integração"}
          </button>
        </footer>
      </aside>
    </>
  );
}
