"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { AlertCircle, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  deleteHubIntegracao,
  fetchHubIntegracoes,
  saveHubIntegracao,
  type HubIntegracaoRow,
  type HubIntegracaoTipoAuth,
} from "@/lib/hub/fetch-hub-integracoes";
import { FERRAMENTAS_LIGHT as L } from "@/lib/hub/ferramentas-catalogo-ui";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialIntegracaoId?: string | null;
  initialHubId?: string | null;
};

type Form = {
  integracao_id: string;
  nome: string;
  tipo_auth: HubIntegracaoTipoAuth;
  api_key: string;
  bearer_token: string;
  webhook_url: string;
  ativo: boolean;
};

const INPUT: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 8,
  border: `1px solid ${L.border}`,
  background: L.surface,
  color: L.text,
  padding: "8px 10px",
  fontSize: 13,
};

const LABEL: CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: L.faint,
};

function emptyForm(): Form {
  return {
    integracao_id: "",
    nome: "",
    tipo_auth: "api_key",
    api_key: "",
    bearer_token: "",
    webhook_url: "",
    ativo: true,
  };
}

function rowToForm(row: HubIntegracaoRow): Form {
  return {
    integracao_id: row.integracao_id,
    nome: row.nome ?? "",
    tipo_auth: row.tipo_auth ?? "api_key",
    api_key: row.api_key ?? "",
    bearer_token: row.bearer_token ?? "",
    webhook_url: row.webhook_url ?? "",
    ativo: row.ativo !== false,
  };
}

export function CrmIntegracaoSideover({ open, onClose, onSaved, initialIntegracaoId, initialHubId }: Props) {
  const [rows, setRows] = useState<HubIntegracaoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiErro, setApiErro] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setApiErro(null);
    try {
      const list = await fetchHubIntegracoes(internalApiHeaders());
      setRows(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar.";
      setApiErro(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setFocusId(null);
      setCriando(false);
      setForm(emptyForm());
      setErro(null);
      return;
    }
    void carregar();
  }, [open, carregar]);

  useEffect(() => {
    if (!open) return;
    if (initialHubId) {
      const row = rows.find((r) => r.id === initialHubId);
      if (row) {
        setFocusId(row.id);
        setCriando(false);
        setForm(rowToForm(row));
        return;
      }
    }
    if (initialIntegracaoId && !focusId && !criando) {
      const row = rows.find((r) => r.integracao_id === initialIntegracaoId);
      if (row) {
        setFocusId(row.id);
        setForm(rowToForm(row));
      } else {
        setCriando(true);
        setForm({
          ...emptyForm(),
          integracao_id: initialIntegracaoId,
          nome: initialIntegracaoId.replace(/_/g, " "),
        });
      }
    }
  }, [open, initialHubId, initialIntegracaoId, rows, focusId, criando]);

  const focusRow = useMemo(() => (focusId ? rows.find((r) => r.id === focusId) : undefined), [focusId, rows]);

  const salvar = async () => {
    setBusy(true);
    setErro(null);
    try {
      const payload = {
        integracao_id: form.integracao_id.trim(),
        nome: form.nome.trim() || form.integracao_id.trim(),
        tipo_auth: form.tipo_auth,
        api_key: form.tipo_auth === "api_key" ? form.api_key.trim() || null : null,
        bearer_token: form.tipo_auth === "bearer" ? form.bearer_token.trim() || null : null,
        webhook_url: form.tipo_auth === "webhook_generico" ? form.webhook_url.trim() || null : null,
        ativo: form.ativo,
      };
      if (!payload.integracao_id) throw new Error("integracao_id é obrigatório.");
      const saved = await saveHubIntegracao(internalApiHeaders(), payload, criando ? null : focusId);
      await carregar();
      setFocusId(saved.id);
      setCriando(false);
      setForm(rowToForm(saved));
      onSaved?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao guardar.");
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async () => {
    if (!focusId || !focusRow) return;
    if (!window.confirm(`Eliminar integração «${focusRow.nome}»?`)) return;
    setBusy(true);
    setErro(null);
    try {
      await deleteHubIntegracao(internalApiHeaders(), focusId);
      setFocusId(null);
      setCriando(true);
      setForm(emptyForm());
      await carregar();
      onSaved?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao eliminar.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 210,
          border: "none",
          background: "rgba(11,34,16,0.35)",
          cursor: "pointer",
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Configurar integração"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 211,
          width: "min(520px, 100vw)",
          background: L.page,
          borderLeft: `1px solid ${L.border}`,
          boxShadow: "-8px 0 32px rgba(11,31,16,0.12)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${L.border}`,
            background: L.surface,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: L.text }}>Integração</h2>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: L.muted }}>
                Credenciais para ferramentas externas HTTP
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                border: `1px solid ${L.border}`,
                background: L.surface,
                borderRadius: 8,
                width: 32,
                height: 32,
                cursor: "pointer",
                color: L.muted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {apiErro ? (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#fff8e6",
                border: `1px solid ${L.accent}55`,
                fontSize: 12,
                color: L.text,
                display: "flex",
                gap: 8,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, color: L.accent }} />
              <span>
                {apiErro.includes("404") || apiErro.toLowerCase().includes("não existe")
                  ? "API /api/hub/integracoes indisponível. Guarde quando o backend estiver activo."
                  : apiErro}
              </span>
            </div>
          ) : null}

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: L.faint, textTransform: "uppercase" }}>
                Existentes ({rows.length})
              </p>
              <button
                type="button"
                onClick={() => {
                  setCriando(true);
                  setFocusId(null);
                  setForm(emptyForm());
                  setErro(null);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  color: L.accent,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Plus size={14} />
                Nova
              </button>
            </div>
            {loading ? (
              <p style={{ margin: 0, fontSize: 12, color: L.muted }}>
                <Loader2 size={14} className="inline animate-spin" /> A carregar…
              </p>
            ) : rows.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: L.muted }}>Nenhuma integração tenant configurada.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setFocusId(r.id);
                        setCriando(false);
                        setForm(rowToForm(r));
                        setErro(null);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${focusId === r.id && !criando ? L.link : L.border}`,
                        background: focusId === r.id && !criando ? L.accentMuted : L.surface,
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: L.text }}>{r.nome}</span>
                      <span style={{ display: "block", fontSize: 11, color: L.muted }}>{r.integracao_id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            style={{
              borderRadius: 12,
              border: `1px solid ${L.border}`,
              background: L.surface,
              padding: "14px 16px",
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: L.text }}>
              {criando ? "Nova integração" : focusRow ? "Editar integração" : "Seleccione ou crie"}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={LABEL}>ID da integração</label>
                <input
                  type="text"
                  value={form.integracao_id}
                  onChange={(e) => setForm((f) => ({ ...f, integracao_id: e.target.value }))}
                  placeholder="ex.: api_crm_externo"
                  disabled={!criando || busy}
                  style={INPUT}
                />
              </div>
              <div>
                <label style={LABEL}>Nome</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome visível"
                  disabled={busy}
                  style={INPUT}
                />
              </div>
              <div>
                <label style={LABEL}>Tipo de autenticação</label>
                <select
                  value={form.tipo_auth}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tipo_auth: e.target.value as HubIntegracaoTipoAuth }))
                  }
                  disabled={busy}
                  style={INPUT}
                >
                  <option value="api_key">API Key (cabeçalho)</option>
                  <option value="bearer">Bearer token</option>
                  <option value="webhook_generico">Webhook genérico</option>
                </select>
              </div>

              {form.tipo_auth === "api_key" ? (
                <div>
                  <label style={LABEL}>API Key</label>
                  <input
                    type="password"
                    value={form.api_key}
                    onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                    placeholder="Chave secreta"
                    disabled={busy}
                    style={INPUT}
                    autoComplete="off"
                  />
                </div>
              ) : null}

              {form.tipo_auth === "bearer" ? (
                <div>
                  <label style={LABEL}>Bearer token</label>
                  <input
                    type="password"
                    value={form.bearer_token}
                    onChange={(e) => setForm((f) => ({ ...f, bearer_token: e.target.value }))}
                    placeholder="Token Bearer"
                    disabled={busy}
                    style={INPUT}
                    autoComplete="off"
                  />
                </div>
              ) : null}

              {form.tipo_auth === "webhook_generico" ? (
                <div>
                  <label style={LABEL}>URL do webhook</label>
                  <input
                    type="url"
                    value={form.webhook_url}
                    onChange={(e) => setForm((f) => ({ ...f, webhook_url: e.target.value }))}
                    placeholder="https://..."
                    disabled={busy}
                    style={INPUT}
                  />
                </div>
              ) : null}

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: L.text }}>
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                  disabled={busy}
                />
                Activa
              </label>
            </div>

            {erro ? (
              <p style={{ margin: "12px 0 0", fontSize: 12, color: L.danger }}>{erro}</p>
            ) : null}
          </div>
        </div>

        <footer
          style={{
            padding: "12px 20px",
            borderTop: `1px solid ${L.border}`,
            background: L.surface,
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          {!criando && focusId ? (
            <button
              type="button"
              onClick={() => void eliminar()}
              disabled={busy}
              style={{
                marginRight: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${L.danger}44`,
                background: "#b3261e12",
                color: L.danger,
                fontSize: 12,
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              <Trash2 size={14} />
              Eliminar
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${L.border}`,
              background: L.surface,
              color: L.muted,
              fontSize: 12,
              fontWeight: 600,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={busy || !form.integracao_id.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${L.border}`,
              background: L.accentMuted,
              color: L.accent,
              fontSize: 12,
              fontWeight: 700,
              cursor: busy || !form.integracao_id.trim() ? "not-allowed" : "pointer",
              opacity: busy || !form.integracao_id.trim() ? 0.6 : 1,
            }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </footer>
      </aside>
    </>
  );
}
