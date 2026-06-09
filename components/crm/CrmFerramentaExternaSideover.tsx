"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Cloud,
  Globe,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Save,
  Shield,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
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
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import {
  DEFAULT_PARAMETROS_SCHEMA,
  deleteHubFerramentaExterna,
  ferramentaKeyExternaFromSlug,
  saveHubFerramentaExterna,
  slugCurtoFromExternaKey,
  type ConexaoInlineClientPayload,
  type HubFerramentaExternaMetodo,
  type HubFerramentaExternaPolitica,
  type HubFerramentaExternaRow,
} from "@/lib/hub/fetch-hub-ferramentas-externas";
import { politicaLabel } from "@/lib/hub/ferramentas-catalogo-ui";
import type { AgenteFerramentaSyncRow } from "@/lib/hub/sync-ferramenta-agentes";
import { syncFerramentaEmAgentes } from "@/lib/hub/sync-ferramenta-agentes";

export type FerramentaExternaSideoverMode = "view" | "edit" | "create";

type TipoAuth = ConexaoInlineClientPayload["tipo_auth"];

type Props = {
  open: boolean;
  mode: FerramentaExternaSideoverMode;
  row: HubFerramentaExternaRow | null;
  agentes?: AgenteFerramentaSyncRow[];
  agentesNomes?: Record<string, string>;
  onClose: () => void;
  onSaved?: (row: HubFerramentaExternaRow) => void;
  onDeleted?: () => void;
  onRequestEdit?: () => void;
};

type Form = {
  titulo: string;
  slug_curto: string;
  descricao_curta: string;
  descricao_modelo: string;
  tipo_auth: TipoAuth;
  bearer_token: string;
  api_key: string;
  api_key_header: string;
  allowed_hosts: string;
  metodo_http: HubFerramentaExternaMetodo;
  url_template: string;
  headers_json: string;
  body_template: string;
  parametros_schema_json: string;
  politica: HubFerramentaExternaPolitica;
  ativo: boolean;
};

const METODOS: HubFerramentaExternaMetodo[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const AUTH_OPTS: { value: TipoAuth; titulo: string; subtitulo: string; icon: typeof Globe }[] = [
  { value: "none", titulo: "Sem autenticação", subtitulo: "API pública ou auth no URL/headers manual.", icon: Globe },
  { value: "bearer", titulo: "Bearer token", subtitulo: "Header Authorization: Bearer …", icon: KeyRound },
  { value: "api_key", titulo: "API Key", subtitulo: "Chave em header personalizado (ex.: X-API-Key).", icon: Shield },
];

const TEXTAREA: CSSProperties = {
  ...RF_INPUT_STYLE,
  minHeight: 72,
  resize: "vertical",
  fontFamily: "ui-monospace, monospace",
};

function emptyForm(): Form {
  return {
    titulo: "",
    slug_curto: "",
    descricao_curta: "",
    descricao_modelo: "",
    tipo_auth: "none",
    bearer_token: "",
    api_key: "",
    api_key_header: "X-API-Key",
    allowed_hosts: "",
    metodo_http: "POST",
    url_template: "",
    headers_json: "{}",
    body_template: "",
    parametros_schema_json: JSON.stringify(DEFAULT_PARAMETROS_SCHEMA, null, 2),
    politica: "leitura",
    ativo: true,
  };
}

function rowToForm(row: HubFerramentaExternaRow): Form {
  const headers =
    row.headers_template && typeof row.headers_template === "object"
      ? JSON.stringify(row.headers_template, null, 2)
      : "{}";
  const schema =
    row.parametros_schema && typeof row.parametros_schema === "object"
      ? JSON.stringify(row.parametros_schema, null, 2)
      : JSON.stringify(DEFAULT_PARAMETROS_SCHEMA, null, 2);
  return {
    titulo: row.titulo ?? "",
    slug_curto: slugCurtoFromExternaKey(row.ferramenta_key),
    descricao_curta: row.descricao_curta ?? "",
    descricao_modelo: row.descricao_modelo ?? "",
    tipo_auth: "none",
    bearer_token: "",
    api_key: "",
    api_key_header: "X-API-Key",
    allowed_hosts: "",
    metodo_http: row.metodo_http ?? "POST",
    url_template: row.url_template ?? "",
    headers_json: headers,
    body_template: row.body_template ?? "",
    parametros_schema_json: schema,
    politica: row.politica ?? "leitura",
    ativo: row.ativo !== false,
  };
}

function hostFromUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    return u.hostname;
  } catch {
    return "";
  }
}

function parseJsonField(raw: string, fieldName: string): Record<string, unknown> {
  const t = raw.trim() || "{}";
  try {
    const parsed: unknown = JSON.parse(t);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${fieldName} deve ser um objecto JSON.`);
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : `${fieldName} JSON inválido.`);
  }
}

function parseHeaders(raw: string): Record<string, string> {
  const obj = parseJsonField(raw, "Headers");
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = String(v);
  }
  return out;
}

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
          whiteSpace: mono ? "pre-wrap" : "normal",
          wordBreak: "break-word",
          fontFamily: mono ? "ui-monospace, monospace" : undefined,
        }}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function FluxoVisual({ metodo, url }: { metodo: string; url: string }) {
  const host = hostFromUrl(url) || "api.exemplo.com";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: "14px 10px",
        borderRadius: 10,
        background: "rgba(6,13,8,0.55)",
        border: `1px dashed ${RF_BORDER_STRONG}`,
      }}
    >
      <div style={fluxoNodeStyle}>
        <Cloud size={16} color="#86efac" />
        <span>Agente IA</span>
      </div>
      <ArrowRight size={14} color={RF_ACCENT} />
      <div style={fluxoNodeStyle}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "#79c0ff" }}>{metodo}</span>
        <span>Hub HTTP</span>
      </div>
      <ArrowRight size={14} color={RF_ACCENT} />
      <div style={fluxoNodeStyle}>
        <Globe size={16} color="#e6c06a" />
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10 }}>{host}</span>
      </div>
    </div>
  );
}

const fluxoNodeStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${RF_BORDER}`,
  background: "rgba(11,31,16,0.9)",
  fontSize: 10,
  fontWeight: 700,
  color: RF_TEXT_SECONDARY,
  minWidth: 72,
};

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

export function CrmFerramentaExternaSideover({
  open,
  mode,
  row,
  agentes = [],
  agentesNomes = {},
  onClose,
  onSaved,
  onDeleted,
  onRequestEdit,
}: Props) {
  const editavel = mode === "edit" || mode === "create";
  const [form, setForm] = useState<Form>(emptyForm);
  const [contextoApi, setContextoApi] = useState("");
  const [busy, setBusy] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [iaProgressPct, setIaProgressPct] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [agentesSel, setAgentesSel] = useState<Set<string>>(new Set());
  const painelBusy = busy || sugerindo;

  const ferramentaKey = row?.ferramenta_key ?? (mode === "create" ? ferramentaKeyExternaFromSlug(form.slug_curto) : null);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setContextoApi("");
      setErro(null);
      setConfirmDelete(false);
      setSugerindo(false);
      setIaProgressPct(0);
      setAgentesSel(new Set());
      return;
    }
    if (mode === "create") {
      setForm(emptyForm());
      setContextoApi("");
      setAgentesSel(new Set());
    } else if (row) {
      setForm(rowToForm(row));
      setAgentesSel(agentesComFerramentaKey(agentes, row.ferramenta_key));
    }
    setErro(null);
  }, [open, mode, row?.id, agentes]);

  const hostSugerido = useMemo(() => hostFromUrl(form.url_template), [form.url_template]);

  const sugerirComIa = useCallback(async () => {
    const titulo = form.titulo.trim();
    if (!titulo) {
      setErro("Escreva um título antes de pedir sugestão.");
      return;
    }
    setErro(null);
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
      const res = await fetch("/api/hub/ferramentas-externas/sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify({
          titulo,
          contexto: contextoApi.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      ok = res.ok;
      if (!res.ok) {
        setErro(typeof data?.error === "string" ? data.error : `Erro HTTP ${res.status}`);
        return;
      }
      const s = data?.sugestao as Partial<Form> & {
        headers_template?: Record<string, string>;
        parametros_schema?: Record<string, unknown>;
      };
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
        tipo_auth:
          s.tipo_auth === "bearer" || s.tipo_auth === "api_key" || s.tipo_auth === "none" ? s.tipo_auth : f.tipo_auth,
        api_key_header: typeof s.api_key_header === "string" ? s.api_key_header : f.api_key_header,
        metodo_http:
          typeof s.metodo_http === "string" && METODOS.includes(s.metodo_http as HubFerramentaExternaMetodo)
            ? (s.metodo_http as HubFerramentaExternaMetodo)
            : f.metodo_http,
        url_template: typeof s.url_template === "string" ? s.url_template : f.url_template,
        headers_json:
          s.headers_template && typeof s.headers_template === "object"
            ? JSON.stringify(s.headers_template, null, 2)
            : f.headers_json,
        body_template: typeof s.body_template === "string" ? s.body_template : f.body_template,
        parametros_schema_json:
          s.parametros_schema && typeof s.parametros_schema === "object"
            ? JSON.stringify(s.parametros_schema, null, 2)
            : f.parametros_schema_json,
        politica: s.politica === "escrita" || s.politica === "leitura" ? s.politica : f.politica,
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
  }, [form.titulo, contextoApi]);

  const salvar = useCallback(async () => {
    setBusy(true);
    setErro(null);
    try {
      const headers_template = parseHeaders(form.headers_json);
      const parametros_schema = parseJsonField(form.parametros_schema_json, "Parâmetros");
      const allowedHosts = form.allowed_hosts.trim()
        ? form.allowed_hosts.split(",").map((h) => h.trim()).filter(Boolean)
        : hostSugerido
          ? [hostSugerido]
          : null;

      const conexao: ConexaoInlineClientPayload = {
        tipo_auth: form.tipo_auth,
        bearer_token: form.tipo_auth === "bearer" && form.bearer_token.trim() ? form.bearer_token.trim() : null,
        api_key: form.tipo_auth === "api_key" && form.api_key.trim() ? form.api_key.trim() : null,
        api_key_header:
          form.tipo_auth === "api_key" && form.api_key_header.trim() ? form.api_key_header.trim() : "X-API-Key",
        allowed_hosts: allowedHosts,
      };

      if (form.tipo_auth === "bearer" && mode === "create" && !conexao.bearer_token) {
        throw new Error("Indique o Bearer token ou escolha outro tipo de autenticação.");
      }
      if (form.tipo_auth === "api_key" && mode === "create" && !conexao.api_key) {
        throw new Error("Indique a API Key ou escolha outro tipo de autenticação.");
      }

      const payload = {
        titulo: form.titulo.trim(),
        slug_curto: mode === "create" ? form.slug_curto.trim() : undefined,
        descricao_curta: form.descricao_curta.trim() || null,
        descricao_modelo: form.descricao_modelo.trim(),
        integracao_row_id: row?.integracao_id ?? undefined,
        conexao,
        metodo_http: form.metodo_http,
        url_template: form.url_template.trim(),
        headers_template,
        body_template: form.body_template.trim() || null,
        parametros_schema,
        politica: form.politica,
        ativo: form.ativo,
      };

      if (!payload.titulo) throw new Error("Título é obrigatório.");
      if (!payload.descricao_modelo) throw new Error("Descrição para o modelo é obrigatória.");
      if (!payload.url_template) throw new Error("URL template é obrigatória.");
      if (mode === "create" && !ferramentaKeyExternaFromSlug(form.slug_curto)) {
        throw new Error("Slug inválido (mín. 2 caracteres, hub_ext_*).");
      }

      const saved = await saveHubFerramentaExterna(
        await crmApiHeaders(),
        payload,
        mode === "create" ? null : row?.id ?? null
      );

      const key = saved.ferramenta_key;
      if (key) {
        await syncFerramentaEmAgentes(await crmApiHeaders(), key, [...agentesSel], agentes, { ligarMotor: true });
      }

      onSaved?.(saved);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao guardar.");
    } finally {
      setBusy(false);
    }
  }, [form, mode, row?.id, row?.integracao_id, hostSugerido, agentesSel, agentes, onSaved]);

  const eliminar = useCallback(async () => {
    if (!row?.id) return;
    setBusy(true);
    setErro(null);
    try {
      await deleteHubFerramentaExterna(await crmApiHeaders(), row.id);
      setConfirmDelete(false);
      onDeleted?.();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao eliminar.");
    } finally {
      setBusy(false);
    }
  }, [onClose, onDeleted, row?.id]);

  if (!open) return null;

  const podeSugerir = editavel && Boolean(form.titulo.trim()) && !painelBusy;

  const tituloPainel =
    mode === "create" ? "Nova ferramenta externa" : mode === "edit" ? "Editar ferramenta externa" : row?.titulo ?? "Ferramenta externa";

  return (
    <>
      <button type="button" aria-label="Fechar" onClick={onClose} style={rfOverlayStyle(212)} />
      <aside role="dialog" aria-modal="true" aria-label={tituloPainel} style={rfAsideStyle("min(600px, 100vw)", 213)}>
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
                  background: "rgba(91,63,168,0.18)",
                  border: `1px solid ${RF_BORDER_STRONG}`,
                  flexShrink: 0,
                }}
              >
                <Globe size={24} color="#c4b5fd" strokeWidth={2} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                  FERRAMENTA EXTERNA · {mode === "create" ? "NOVO" : mode === "edit" ? "EDITAR" : "DETALHE"}
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
                {row?.ferramenta_key && mode !== "create" ? (
                  <code style={{ display: "block", marginTop: 6, fontSize: 11, color: "#c4b5fd", wordBreak: "break-all" }}>
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
          {erro ? <p style={{ margin: "0 0 12px", color: "#f85149", fontSize: 12 }}>{erro}</p> : null}

          {editavel && sugerindo ? (
            <div style={{ ...rfInnerPanelStyle(), marginBottom: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, color: "#c4b5fd" }}>
                  <Loader2 size={14} className="animate-spin" />
                  A gerar configuração HTTP…
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: RF_ACCENT }}>{iaProgressPct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "rgba(6,13,8,0.45)", border: `1px solid ${RF_BORDER}`, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${iaProgressPct}%`,
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #7c3aed 0%, #c4b5fd 100%)",
                    transition: "width 0.22s ease-out",
                  }}
                />
              </div>
            </div>
          ) : null}

          {mode === "view" && row ? (
            <div style={rfInnerPanelStyle()}>
              <div style={{ padding: "12px 14px" }}>
                <FluxoVisual metodo={row.metodo_http} url={row.url_template} />
                <ReadOnlyBlock label="Título" value={row.titulo} />
                <ReadOnlyBlock label="Descrição curta" value={row.descricao_curta ?? ""} />
                <ReadOnlyBlock label="Descrição para o modelo" value={row.descricao_modelo} />
                <ReadOnlyBlock label="Método HTTP" value={row.metodo_http} />
                <ReadOnlyBlock label="URL template" value={row.url_template} mono />
                <ReadOnlyBlock label="Headers" value={JSON.stringify(row.headers_template ?? {}, null, 2)} mono />
                <ReadOnlyBlock label="Body template" value={row.body_template ?? ""} mono />
                <ReadOnlyBlock label="Parâmetros (schema)" value={JSON.stringify(row.parametros_schema ?? {}, null, 2)} mono />
                <ReadOnlyBlock label="Política" value={politicaLabel(row.politica)} />
                <ReadOnlyBlock label="Estado" value={row.ativo ? "Activa" : "Inactiva"} />
              </div>
            </div>
          ) : (
            <>
              <div style={rfInnerPanelStyle()}>
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
                  <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>Identificação</p>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  {mode === "create" ? (
                    <label style={{ display: "block", marginBottom: 14 }}>
                      <span style={RF_LABEL_STYLE}>Slug (hub_ext_*)</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: 12, color: RF_TEXT_MUTED, flexShrink: 0 }}>hub_ext_</span>
                        <input
                          type="text"
                          value={form.slug_curto}
                          onChange={(e) => setForm((f) => ({ ...f, slug_curto: e.target.value }))}
                          placeholder="consulta_pedidos"
                      disabled={painelBusy}
                      style={{ ...RF_INPUT_STYLE, flex: 1, fontFamily: "ui-monospace, monospace" }}
                        />
                      </div>
                    </label>
                  ) : row ? (
                    <ReadOnlyBlock label="Chave (só leitura)" value={row.ferramenta_key} mono />
                  ) : null}

                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={RF_LABEL_STYLE}>Título *</span>
                    <input
                      type="text"
                      value={form.titulo}
                      onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                      disabled={painelBusy}
                      style={{ ...RF_INPUT_STYLE, marginTop: 6 }}
                    />
                  </label>

                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={RF_LABEL_STYLE}>Descrição curta (admin)</span>
                    <input
                      type="text"
                      value={form.descricao_curta}
                      onChange={(e) => setForm((f) => ({ ...f, descricao_curta: e.target.value }))}
                      disabled={painelBusy}
                      style={{ ...RF_INPUT_STYLE, marginTop: 6 }}
                    />
                  </label>

                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={RF_LABEL_STYLE}>Descrição para o modelo — quando invocar *</span>
                    <textarea
                      value={form.descricao_modelo}
                      onChange={(e) => setForm((f) => ({ ...f, descricao_modelo: e.target.value }))}
                      rows={3}
                      disabled={painelBusy}
                      style={{ ...TEXTAREA, marginTop: 6 }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <span style={RF_LABEL_STYLE}>Contexto da API (opcional — ajuda a IA)</span>
                    <textarea
                      value={contextoApi}
                      onChange={(e) => setContextoApi(e.target.value)}
                      rows={3}
                      placeholder="Cole URL base, endpoint, método, parâmetros ou trecho da documentação da API externa…"
                      disabled={painelBusy}
                      style={{ ...TEXTAREA, marginTop: 6, fontFamily: "inherit" }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ ...rfInnerPanelStyle(), marginTop: 12 }}>
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
                  <p style={{ margin: "0 0 8px", color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>
                    Conexão HTTP
                  </p>
                  <FluxoVisual metodo={form.metodo_http} url={form.url_template} />
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <p style={{ margin: "0 0 10px", fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
                    A credencial fica guardada na integração do tenant — não precisa de separador à parte.
                  </p>

                  <div role="radiogroup" aria-label="Tipo de autenticação" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {AUTH_OPTS.map((opt) => {
                      const sel = form.tipo_auth === opt.value;
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={sel}
                          disabled={painelBusy}
                          onClick={() => setForm((f) => ({ ...f, tipo_auth: opt.value }))}
                          style={{
                            textAlign: "left",
                            cursor: busy ? "not-allowed" : "pointer",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: `1px solid ${sel ? "rgba(196,181,253,0.45)" : RF_BORDER}`,
                            background: sel ? "rgba(91,63,168,0.14)" : "rgba(6,13,8,0.45)",
                            color: RF_TEXT_PRIMARY,
                            boxSizing: "border-box",
                            width: "100%",
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                          }}
                        >
                          <Icon size={18} color={sel ? "#c4b5fd" : RF_TEXT_MUTED} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>{opt.titulo}</span>
                            <span style={{ display: "block", marginTop: 4, fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.4 }}>
                              {opt.subtitulo}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {form.tipo_auth === "bearer" ? (
                    <label style={{ display: "block", marginBottom: 14 }}>
                      <span style={RF_LABEL_STYLE}>Bearer token {mode === "edit" ? "(vazio = manter actual)" : "*"}</span>
                      <input
                        type="password"
                        value={form.bearer_token}
                        onChange={(e) => setForm((f) => ({ ...f, bearer_token: e.target.value }))}
                        placeholder="sk-…"
                        disabled={painelBusy}
                        style={{ ...RF_INPUT_STYLE, marginTop: 6, fontFamily: "ui-monospace, monospace" }}
                      />
                    </label>
                  ) : null}

                  {form.tipo_auth === "api_key" ? (
                    <>
                      <label style={{ display: "block", marginBottom: 14 }}>
                        <span style={RF_LABEL_STYLE}>API Key {mode === "edit" ? "(vazio = manter actual)" : "*"}</span>
                        <input
                          type="password"
                          value={form.api_key}
                          onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                          disabled={painelBusy}
                          style={{ ...RF_INPUT_STYLE, marginTop: 6, fontFamily: "ui-monospace, monospace" }}
                        />
                      </label>
                      <label style={{ display: "block", marginBottom: 14 }}>
                        <span style={RF_LABEL_STYLE}>Nome do header</span>
                        <input
                          type="text"
                          value={form.api_key_header}
                          onChange={(e) => setForm((f) => ({ ...f, api_key_header: e.target.value }))}
                          placeholder="X-API-Key"
                          disabled={painelBusy}
                          style={{ ...RF_INPUT_STYLE, marginTop: 6, fontFamily: "ui-monospace, monospace" }}
                        />
                      </label>
                    </>
                  ) : null}

                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={RF_LABEL_STYLE}>Hosts permitidos (opcional, separados por vírgula)</span>
                    <input
                      type="text"
                      value={form.allowed_hosts}
                      onChange={(e) => setForm((f) => ({ ...f, allowed_hosts: e.target.value }))}
                      placeholder={hostSugerido || "api.exemplo.com, hooks.exemplo.com"}
                      disabled={painelBusy}
                      style={{ ...RF_INPUT_STYLE, marginTop: 6, fontFamily: "ui-monospace, monospace" }}
                    />
                  </label>

                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10, marginBottom: 14 }}>
                    <label>
                      <span style={RF_LABEL_STYLE}>Método</span>
                      <select
                        value={form.metodo_http}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, metodo_http: e.target.value as HubFerramentaExternaMetodo }))
                        }
                        disabled={painelBusy}
                        style={{ ...RF_INPUT_STYLE, marginTop: 6 }}
                      >
                        {METODOS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span style={RF_LABEL_STYLE}>URL template *</span>
                      <input
                        type="text"
                        value={form.url_template}
                        onChange={(e) => setForm((f) => ({ ...f, url_template: e.target.value }))}
                        placeholder="https://api.exemplo.com/v1/{{param}}"
                        disabled={painelBusy}
                        style={{ ...RF_INPUT_STYLE, marginTop: 6, fontFamily: "ui-monospace, monospace" }}
                      />
                    </label>
                  </div>

                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={RF_LABEL_STYLE}>Headers extra (JSON)</span>
                    <textarea
                      value={form.headers_json}
                      onChange={(e) => setForm((f) => ({ ...f, headers_json: e.target.value }))}
                      rows={3}
                      disabled={painelBusy}
                      style={{ ...TEXTAREA, marginTop: 6 }}
                    />
                  </label>

                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={RF_LABEL_STYLE}>Body template</span>
                    <textarea
                      value={form.body_template}
                      onChange={(e) => setForm((f) => ({ ...f, body_template: e.target.value }))}
                      rows={4}
                      placeholder='{"pedido_id": "{{pedido_id}}"}'
                      disabled={painelBusy}
                      style={{ ...TEXTAREA, marginTop: 6 }}
                    />
                  </label>

                  <label style={{ display: "block", marginBottom: 14 }}>
                    <span style={RF_LABEL_STYLE}>Parâmetros schema (JSON)</span>
                    <textarea
                      value={form.parametros_schema_json}
                      onChange={(e) => setForm((f) => ({ ...f, parametros_schema_json: e.target.value }))}
                      rows={6}
                      disabled={painelBusy}
                      style={{ ...TEXTAREA, marginTop: 6 }}
                    />
                  </label>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                    <label>
                      <span style={RF_LABEL_STYLE}>Política</span>
                      <select
                        value={form.politica}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, politica: e.target.value as HubFerramentaExternaPolitica }))
                        }
                        disabled={painelBusy}
                        style={{ ...RF_INPUT_STYLE, marginTop: 6, width: 160 }}
                      >
                        <option value="leitura">Só leitura</option>
                        <option value="escrita">Escrita</option>
                      </select>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: busy ? "not-allowed" : "pointer", marginTop: 18 }}>
                      <input
                        type="checkbox"
                        checked={form.ativo}
                        onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                        disabled={painelBusy}
                        style={{ width: 16, height: 16, accentColor: RF_ACCENT }}
                      />
                      <span style={{ fontSize: 12, color: RF_TEXT_PRIMARY }}>Activa no catálogo</span>
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {agentes.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <CrmFerramentaAgentesPanel
                ferramentaKey={ferramentaKey || (row?.ferramenta_key ?? null)}
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
                onClick={() => setConfirmDelete(true)}
                disabled={painelBusy}
                style={{
                  ...footerBtnStyle,
                  border: "1px solid rgba(248,81,73,0.35)",
                  background: "rgba(248,81,73,0.12)",
                  color: "#f85149",
                }}
              >
                <Trash2 size={14} />
                Eliminar
              </button>
              <button
                type="button"
                onClick={onRequestEdit}
                disabled={painelBusy}
                style={{ ...footerBtnStyle, flex: 1, background: "rgba(146,255,0,0.08)", color: RF_ACCENT }}
              >
                <Pencil size={14} />
                Editar
              </button>
            </div>
          ) : editavel ? (
            <>
              <button
                type="button"
                disabled={!podeSugerir}
                onClick={() => void sugerirComIa()}
                title={podeSugerir ? "Sugerir configuração HTTP com IA (Mistral)" : "Preencha o título primeiro"}
                style={{
                  ...footerBtnStyle,
                  width: "100%",
                  background: "rgba(91,63,168,0.14)",
                  color: "#c4b5fd",
                  opacity: podeSugerir ? 1 : 0.45,
                }}
              >
                {sugerindo ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Sugerir com IA
              </button>
              <div style={{ display: "flex", gap: 10, width: "100%" }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={painelBusy}
                  style={{ ...footerBtnStyle, flex: 1, color: RF_TEXT_MUTED }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void salvar()}
                  disabled={painelBusy}
                  style={{
                    ...footerBtnStyle,
                    flex: 1,
                    background: "rgba(146,255,0,0.08)",
                    color: RF_ACCENT,
                    opacity: painelBusy ? 0.6 : 1,
                  }}
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : mode === "create" ? <Plus size={14} /> : <Save size={14} />}
                  {mode === "create" ? "Criar ferramenta" : "Guardar alterações"}
                </button>
              </div>
            </>
          ) : (
            <button type="button" onClick={onClose} style={{ ...footerBtnStyle, width: "100%", color: RF_TEXT_MUTED }}>
              Fechar
            </button>
          )}
        </footer>
      </aside>

      <CrmConfirmDialog
        open={confirmDelete}
        title="Eliminar ferramenta externa?"
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
            <p style={{ margin: 0 }}>A integração HTTP ligada pode continuar no tenant.</p>
          </>
        ) : null}
      </CrmConfirmDialog>
    </>
  );
}
