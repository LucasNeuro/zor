"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Loader2, Pencil, Save, Sparkles, Trash2, Wrench, X } from "lucide-react";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import {
  agentesComFerramentaKey,
  CrmFerramentaAgentesPanel,
} from "@/components/crm/CrmFerramentaAgentesPanel";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
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
import {
  HUB_AGENTE_FERRAMENTAS_CATALOGO,
  isHubAgenteFerramentaId,
  type HubAgenteFerramentaId,
} from "@/lib/hub/agente-ferramentas-registry";
import type { HubFerramentaCustomRow } from "@/lib/hub/ferramentas-custom-db";
import {
  emptyFerramentaCustomForm,
  ferramentaCustomRowToForm,
  type FerramentaCustomSideoverMode,
  type HubFerramentaCustomForm,
} from "@/lib/hub/ferramentas-ia-ui";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import type { AgenteFerramentaSyncRow } from "@/lib/hub/sync-ferramenta-agentes";
import { syncFerramentaEmAgentes } from "@/lib/hub/sync-ferramenta-agentes";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: FerramentaCustomSideoverMode;
  row: HubFerramentaCustomRow | null;
  agentes?: AgenteFerramentaSyncRow[];
  agentesNomes?: Record<string, string>;
  onSaved?: (row: HubFerramentaCustomRow) => void;
  onDeleted?: (id: string) => void;
  onRequestEdit?: () => void;
};

const SMART_OPTS = [
  { value: "none", titulo: "Nenhum", subtitulo: "Devolver o JSON bruto ao agente principal." },
  { value: "mistral", titulo: "Mistral", subtitulo: "Mini-agente Mistral para resumir ou formatar o JSON." },
  {
    value: "gemini",
    titulo: "Gemini",
    subtitulo: "Mini-agente Gemini (exige GOOGLE_AI_API_KEY ou GEMINI_API_KEY no servidor).",
  },
] as const;

function ReadOnlyBlock({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ ...RF_LABEL_STYLE, marginBottom: 6 }}>{label}</p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: RF_TEXT_SECONDARY,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: mono ? "ui-monospace, monospace" : undefined,
        }}
      >
        {value || "—"}
      </p>
    </div>
  );
}

export function CrmFerramentaCustomSideover({
  open,
  onClose,
  mode,
  row,
  agentes = [],
  agentesNomes = {},
  onSaved,
  onDeleted,
  onRequestEdit,
}: Props) {
  const [form, setForm] = useState<HubFerramentaCustomForm>(emptyFerramentaCustomForm);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [sugerindo, setSugerindo] = useState(false);
  const [iaProgressPct, setIaProgressPct] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [agentesSel, setAgentesSel] = useState<Set<string>>(new Set());

  const editavel = mode === "edit" || mode === "create";
  const tituloPainel =
    mode === "create" ? "Nova ferramenta custom" : row?.titulo?.trim() || "Ferramenta custom";

  useEffect(() => {
    if (!open) {
      setForm(emptyFerramentaCustomForm());
      setErro("");
      setSugerindo(false);
      setIaProgressPct(0);
      setConfirmDelete(false);
      setBusy(false);
      setAgentesSel(new Set());
      return;
    }
    if (mode === "create") {
      setForm(emptyFerramentaCustomForm());
      setErro("");
      setAgentesSel(new Set());
      return;
    }
    if (row) {
      setForm(ferramentaCustomRowToForm(row));
      setErro("");
      setAgentesSel(agentesComFerramentaKey(agentes, row.ferramenta_key));
    }
  }, [open, mode, row?.id, row?.atualizado_em, row?.ferramenta_key, agentes]);

  const sugerirComIa = useCallback(async () => {
    const titulo = form.titulo.trim();
    if (!titulo) {
      setErro("Escreva um título antes de pedir sugestão.");
      return;
    }
    setErro("");
    setIaProgressPct(6);
    setSugerindo(true);
    const tick = window.setInterval(() => {
      setIaProgressPct((p) => {
        if (p >= 92) return p;
        const step = Math.max(1, Math.round((92 - p) * (0.06 + Math.random() * 0.06)));
        return Math.min(92, p + step);
      });
    }, 180);
    let ok = false;
    try {
      const res = await fetch("/api/hub/ferramentas-custom/sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify({ titulo }),
      });
      const data = await res.json().catch(() => ({}));
      ok = res.ok;
      if (!res.ok) {
        setErro(typeof data?.error === "string" ? data.error : `Erro HTTP ${res.status}`);
        return;
      }
      const s = data?.sugestao as Partial<HubFerramentaCustomForm> | undefined;
      if (!s || typeof s !== "object") {
        setErro("Resposta sem sugestão.");
        ok = false;
        return;
      }
      setForm((f) => ({
        ...f,
        slug_curto: typeof s.slug_curto === "string" ? s.slug_curto : f.slug_curto,
        descricao_curta: typeof s.descricao_curta === "string" ? s.descricao_curta : f.descricao_curta,
        descricao_modelo: typeof s.descricao_modelo === "string" ? s.descricao_modelo : f.descricao_modelo,
        builtin_impl: typeof s.builtin_impl === "string" ? s.builtin_impl : f.builtin_impl,
        smart_provider: typeof s.smart_provider === "string" ? s.smart_provider : f.smart_provider,
        smart_prompt: typeof s.smart_prompt === "string" ? s.smart_prompt : f.smart_prompt,
      }));
    } finally {
      window.clearInterval(tick);
      if (ok) {
        setIaProgressPct(100);
        await new Promise((r) => setTimeout(r, 420));
      }
      setSugerindo(false);
      setIaProgressPct(0);
    }
  }, [form.titulo]);

  const salvar = useCallback(async () => {
    const titulo = form.titulo.trim();
    const descricao_modelo = form.descricao_modelo.trim();
    if (!titulo) {
      setErro("Título é obrigatório.");
      return;
    }
    if (!descricao_modelo) {
      setErro("A descrição para o modelo (quando invocar) é obrigatória.");
      return;
    }
    if (!isHubAgenteFerramentaId(form.builtin_impl)) {
      setErro("Função base inválida.");
      return;
    }

    setBusy(true);
    setErro("");
    try {
      const headers = await crmApiHeaders();
      let saved: HubFerramentaCustomRow | null = null;

      if (mode === "create") {
        const res = await fetch("/api/hub/ferramentas-custom", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            titulo,
            slug_curto: form.slug_curto.trim() || undefined,
            descricao_curta: form.descricao_curta.trim() || null,
            descricao_modelo,
            builtin_impl: form.builtin_impl,
            smart_provider: form.smart_provider,
            smart_model: form.smart_model.trim() || null,
            smart_prompt: form.smart_prompt.trim() || null,
            ativo: form.ativo,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as HubFerramentaCustomRow & { error?: string };
        if (!res.ok) throw new Error(data.error || "Falha ao criar.");
        saved = data;
      } else {
        if (!row?.id) return;
        const res = await fetch(`/api/hub/ferramentas-custom/${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({
            titulo,
            descricao_curta: form.descricao_curta.trim() || null,
            descricao_modelo,
            builtin_impl: form.builtin_impl as HubAgenteFerramentaId,
            smart_provider: form.smart_provider,
            smart_model: form.smart_model.trim() || null,
            smart_prompt: form.smart_prompt.trim() || null,
            ativo: form.ativo,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as HubFerramentaCustomRow & { error?: string };
        if (!res.ok) throw new Error(data.error || "Falha ao guardar.");
        saved = data;
      }

      const key = saved?.ferramenta_key;
      if (key) {
        await syncFerramentaEmAgentes(headers, key, [...agentesSel], agentes, { ligarMotor: true });
      }
      if (saved) onSaved?.(saved);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }, [form, mode, onSaved, row?.id, agentesSel, agentes]);

  const eliminar = useCallback(async () => {
    if (!row?.id) return;
    setBusy(true);
    setErro("");
    try {
      const res = await fetch(`/api/hub/ferramentas-custom/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        headers: await crmApiHeaders(),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Falha ao eliminar.");
      setConfirmDelete(false);
      onDeleted?.(row.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }, [onDeleted, row?.id]);

  if (!open) return null;
  if (mode !== "create" && !row) return null;

  const painelBusy = busy || sugerindo;
  const podeSugerir = editavel && Boolean(form.titulo.trim()) && !painelBusy;
  const builtinLabel =
    HUB_AGENTE_FERRAMENTAS_CATALOGO.find((t) => t.id === form.builtin_impl)?.titulo ?? form.builtin_impl;
  const smartLabel = SMART_OPTS.find((o) => o.value === form.smart_provider)?.titulo ?? form.smart_provider;

  return (
    <>
      <button type="button" aria-label="Fechar painel" onClick={onClose} style={rfOverlayStyle(212)} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={tituloPainel}
        style={rfAsideStyle("min(560px, 100vw)", 213)}
      >
        <header style={rfAsideHeaderStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(201,162,74,0.14)",
                  border: `1px solid ${RF_BORDER_STRONG}`,
                  flexShrink: 0,
                }}
              >
                <Wrench size={24} color="#e6c06a" strokeWidth={2} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                  FERRAMENTA CUSTOM · {mode === "create" ? "NOVO" : mode === "edit" ? "EDITAR" : "DETALHE"}
                </p>
                <h2
                  style={{
                    margin: "4px 0 0",
                    fontSize: 17,
                    fontWeight: 800,
                    color: RF_TEXT_PRIMARY,
                    lineHeight: 1.3,
                    wordBreak: "break-word",
                  }}
                >
                  {tituloPainel}
                </h2>
                {row?.ferramenta_key ? (
                  <code
                    style={{
                      display: "block",
                      marginTop: 6,
                      fontSize: 11,
                      color: "#79c0ff",
                      wordBreak: "break-all",
                    }}
                  >
                    {row.ferramenta_key}
                  </code>
                ) : null}
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" style={rfCloseButtonStyle()}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </header>

        <div style={rfAsideBodyStyle()}>
          {erro ? (
            <p style={{ margin: "0 0 12px", color: "#f85149", fontSize: 12 }}>{erro}</p>
          ) : null}

          {editavel && sugerindo ? (
            <div style={{ ...rfInnerPanelStyle(), marginBottom: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, color: "#e6c06a" }}>
                  <Loader2 size={14} className="animate-spin" />
                  A gerar sugestão…
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: RF_ACCENT }}>{iaProgressPct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "rgba(6,13,8,0.45)", border: `1px solid ${RF_BORDER}`, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${iaProgressPct}%`,
                    borderRadius: 999,
                    background: `linear-gradient(90deg, #3fb950 0%, ${RF_ACCENT} 100%)`,
                    transition: "width 0.22s ease-out",
                  }}
                />
              </div>
            </div>
          ) : null}

          <div style={rfInnerPanelStyle()}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>Identificação</p>
            </div>
            <div style={{ padding: "12px 14px" }}>
              {mode === "view" ? (
                <>
                  <ReadOnlyBlock label="Título" value={form.titulo} />
                  <ReadOnlyBlock label="Descrição curta (admin)" value={form.descricao_curta} />
                  <ReadOnlyBlock label="Descrição para o modelo" value={form.descricao_modelo} />
                  <ReadOnlyBlock label="Função base" value={`${form.builtin_impl} — ${builtinLabel}`} mono />
                  <ReadOnlyBlock label="Camada smart" value={smartLabel} />
                  {form.smart_provider !== "none" ? (
                    <>
                      <ReadOnlyBlock label="Modelo smart" value={form.smart_model || "(padrão)"} mono />
                      <ReadOnlyBlock label="Prompt smart" value={form.smart_prompt} />
                    </>
                  ) : null}
                  <ReadOnlyBlock label="Estado" value={form.ativo ? "Activa no catálogo" : "Inactiva no catálogo"} />
                </>
              ) : (
                <>
                  {mode === "create" ? (
                    <label style={{ display: "block", marginBottom: 14 }}>
                      <span style={RF_LABEL_STYLE}>Slug curto (opcional — gera hub_custom_*)</span>
                      <input
                        value={form.slug_curto}
                        onChange={(e) => setForm((p) => ({ ...p, slug_curto: e.target.value }))}
                        placeholder="ex.: resumo_vip"
                        disabled={painelBusy}
                        style={{ ...RF_INPUT_STYLE, marginTop: 6, fontFamily: "ui-monospace, monospace" }}
                      />
                    </label>
                  ) : row ? (
                    <ReadOnlyBlock label="Chave (só leitura)" value={row.ferramenta_key} mono />
                  ) : null}

                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={RF_LABEL_STYLE}>Título *</span>
                    <input
                      value={form.titulo}
                      onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                      disabled={painelBusy}
                      style={{ ...RF_INPUT_STYLE, marginTop: 6 }}
                    />
                  </label>

                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={RF_LABEL_STYLE}>Descrição curta (admin / CRM)</span>
                    <input
                      value={form.descricao_curta}
                      onChange={(e) => setForm((p) => ({ ...p, descricao_curta: e.target.value }))}
                      placeholder="Uma linha: o que esta ferramenta faz na prática"
                      disabled={painelBusy}
                      style={{ ...RF_INPUT_STYLE, marginTop: 6 }}
                    />
                  </label>

                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={RF_LABEL_STYLE}>Descrição para o modelo — quando deve invocar *</span>
                    <textarea
                      value={form.descricao_modelo}
                      onChange={(e) => setForm((p) => ({ ...p, descricao_modelo: e.target.value }))}
                      rows={4}
                      disabled={painelBusy}
                      style={{ ...RF_INPUT_STYLE, marginTop: 6, minHeight: 88, resize: "vertical" }}
                    />
                  </label>

                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={RF_LABEL_STYLE}>Função base (execução no servidor)</span>
                    <select
                      value={form.builtin_impl}
                      onChange={(e) => setForm((p) => ({ ...p, builtin_impl: e.target.value }))}
                      disabled={painelBusy}
                      style={{ ...RF_INPUT_STYLE, marginTop: 6 }}
                    >
                      {HUB_AGENTE_FERRAMENTAS_CATALOGO.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.id} — {t.titulo}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
          </div>

          {editavel ? (
            <>
              <div style={{ ...rfInnerPanelStyle(), marginTop: 12 }}>
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
                  <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>IA interna (camada smart)</p>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div role="radiogroup" aria-label="Provedor da camada smart" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {SMART_OPTS.map((opt) => {
                      const sel = form.smart_provider === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={sel}
                          disabled={painelBusy}
                          onClick={() => setForm((p) => ({ ...p, smart_provider: opt.value }))}
                          style={{
                            textAlign: "left",
                            cursor: painelBusy ? "not-allowed" : "pointer",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: `1px solid ${sel ? "rgba(201,162,74,0.55)" : RF_BORDER}`,
                            background: sel ? "rgba(201,162,74,0.1)" : "rgba(6,13,8,0.45)",
                            color: RF_TEXT_PRIMARY,
                            boxSizing: "border-box",
                            width: "100%",
                          }}
                        >
                          <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>{opt.titulo}</span>
                          <span style={{ display: "block", marginTop: 4, fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.4 }}>
                            {opt.subtitulo}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {form.smart_provider !== "none" ? (
                    <div style={{ marginTop: 14 }}>
                      <label style={{ display: "block", marginBottom: 14 }}>
                        <span style={RF_LABEL_STYLE}>Modelo opcional (vazio = padrão)</span>
                        <input
                          value={form.smart_model}
                          onChange={(e) => setForm((p) => ({ ...p, smart_model: e.target.value }))}
                          placeholder={form.smart_provider === "gemini" ? "gemini-2.0-flash" : "mistral-small-latest"}
                          disabled={painelBusy}
                          style={{ ...RF_INPUT_STYLE, marginTop: 6, fontFamily: "ui-monospace, monospace" }}
                        />
                      </label>
                      <label style={{ display: "block" }}>
                        <span style={RF_LABEL_STYLE}>Instruções para o modelo interno</span>
                        <textarea
                          value={form.smart_prompt}
                          onChange={(e) => setForm((p) => ({ ...p, smart_prompt: e.target.value }))}
                          rows={3}
                          disabled={painelBusy}
                          style={{ ...RF_INPUT_STYLE, marginTop: 6, minHeight: 72, resize: "vertical" }}
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ ...rfInnerPanelStyle(), marginTop: 12, padding: "12px 14px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: painelBusy ? "not-allowed" : "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    disabled={painelBusy}
                    onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: RF_ACCENT }}
                  />
                  <span style={{ fontSize: 12, color: RF_TEXT_PRIMARY }}>Ferramenta activa no catálogo</span>
                </label>
              </div>
            </>
          ) : null}

          {agentes.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <CrmFerramentaAgentesPanel
                ferramentaKey={row?.ferramenta_key ?? null}
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
                disabled={painelBusy}
                theme="dark"
              />
            </div>
          ) : null}
        </div>

        <footer style={{ ...rfAsideFooterStyle(), flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          {mode === "view" ? (
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <button
                type="button"
                onClick={() => onRequestEdit?.()}
                style={{ ...footerBtnStyle, flex: 1, background: "rgba(146,255,0,0.08)", color: RF_ACCENT }}
              >
                <Pencil size={14} />
                Editar
              </button>
            </div>
          ) : (
            <>
              {editavel ? (
                <button
                  type="button"
                  disabled={!podeSugerir}
                  onClick={() => void sugerirComIa()}
                  title={podeSugerir ? "Sugerir campos com IA (Mistral)" : "Preencha o título primeiro"}
                  style={{
                    ...footerBtnStyle,
                    width: "100%",
                    background: "rgba(201,162,74,0.1)",
                    color: "#e6c06a",
                    opacity: podeSugerir ? 1 : 0.45,
                  }}
                >
                  {sugerindo ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Sugerir com IA
                </button>
              ) : null}
              <div style={{ display: "flex", gap: 10, width: "100%" }}>
                <button
                  type="button"
                  disabled={painelBusy}
                  onClick={() => void salvar()}
                  style={{ ...footerBtnStyle, flex: 1, background: "rgba(146,255,0,0.08)", color: RF_ACCENT }}
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {mode === "create" ? "Criar ferramenta" : "Guardar alterações"}
                </button>
                {mode === "edit" && row ? (
                  <button
                    type="button"
                    disabled={painelBusy}
                    onClick={() => setConfirmDelete(true)}
                    style={{
                      ...footerBtnStyle,
                      flex: 1,
                      border: "1px solid rgba(248,81,73,0.35)",
                      background: "rgba(248,81,73,0.12)",
                      color: "#f85149",
                    }}
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                ) : null}
              </div>
            </>
          )}
        </footer>
      </aside>

      <CrmConfirmDialog
        open={confirmDelete}
        title="Eliminar ferramenta custom?"
        variant="destructive"
        theme="dark"
        zIndex={221}
        confirmLabel="Eliminar permanentemente"
        loading={busy}
        loadingLabel="A eliminar…"
        onCancel={() => !busy && setConfirmDelete(false)}
        onConfirm={() => void eliminar()}
      >
        {row ? (
          <>
            <p style={{ margin: "0 0 10px" }}>
              <strong style={{ color: "#e8f5e9" }}>{row.titulo}</strong>
              <br />
              <code style={{ fontSize: 12, color: "#92ff00" }}>{row.ferramenta_key}</code>
            </p>
            <p style={{ margin: 0 }}>
              Esta acção remove o registo na base de dados. Agentes que tiverem esta chave em{" "}
              <code style={{ fontSize: 11 }}>uso_ferramentas_ia</code> podem ficar com referência órfã até limpar
              manualmente a ficha do agente.
            </p>
            <p style={{ margin: "12px 0 0", color: "#f85149", fontWeight: 600 }}>Esta operação não pode ser desfeita.</p>
          </>
        ) : null}
      </CrmConfirmDialog>
    </>
  );
}

const footerBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${RF_BORDER_STRONG}`,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
