"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlertCircle,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  Presentation,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import type { TenantConhecimentoDocumento } from "@/lib/hub/tenant-conhecimento-rag";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";

type Props = {
  documento: TenantConhecimentoDocumento | null;
  onClose: () => void;
  onReprocessar?: (id: string) => void;
  onExcluir?: (id: string) => void;
  onDocumentoAtualizado?: (doc: TenantConhecimentoDocumento) => void;
  busy?: boolean;
};

function extensaoArquivo(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : "";
}

function tipoDocumento(nome: string): { Icon: LucideIcon; label: string; cor: string; bg: string } {
  const ext = extensaoArquivo(nome);
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return { Icon: FileSpreadsheet, label: ext.toUpperCase(), cor: "#3fb950", bg: "rgba(63,185,80,0.14)" };
  }
  if (ext === "pdf") {
    return { Icon: FileText, label: "PDF", cor: "#f85149", bg: "rgba(248,81,73,0.14)" };
  }
  if (["pptx", "ppt"].includes(ext)) {
    return { Icon: Presentation, label: ext.toUpperCase(), cor: "#e6c06a", bg: "rgba(230,192,106,0.14)" };
  }
  if (ext === "json") {
    return { Icon: FileJson, label: "JSON", cor: "#79c0ff", bg: "rgba(121,192,255,0.14)" };
  }
  return { Icon: FileText, label: ext ? ext.toUpperCase() : "DOC", cor: RF_ACCENT, bg: "rgba(146,255,0,0.12)" };
}

function fmtDataHora(iso?: string | null): string {
  if (!iso?.trim()) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function fmtBytes(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function statusLabel(status: string): string {
  if (status === "pronto") return "Indexado";
  if (status === "indexando") return "A processar";
  if (status === "erro") return "Erro";
  return status;
}

function statusCores(status: string): { bg: string; fg: string; border: string } {
  if (status === "pronto") return { bg: "rgba(146,255,0,0.12)", fg: RF_ACCENT, border: RF_BORDER_STRONG };
  if (status === "erro") return { bg: "rgba(248,81,73,0.14)", fg: "#f85149", border: "rgba(248,81,73,0.35)" };
  return { bg: "rgba(230,192,106,0.12)", fg: "#e6c06a", border: "rgba(230,192,106,0.35)" };
}

function MetaChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: `1px solid ${RF_BORDER}`,
        background: "rgba(6,13,8,0.45)",
        minWidth: 0,
      }}
    >
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: RF_TEXT_MUTED }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700, color: RF_TEXT_PRIMARY }}>{value}</p>
    </div>
  );
}

function ResumoIaPanel({ resumo }: { resumo: Record<string, unknown> | null }) {
  if (!resumo || typeof resumo !== "object") {
    return (
      <p style={{ margin: 0, fontSize: 12, color: RF_TEXT_MUTED, lineHeight: 1.5 }}>
        Sem resumo gerado. Use <strong style={{ color: RF_TEXT_SECONDARY }}>Reindexar</strong> para a IA analisar o
        conteúdo deste ficheiro.
      </p>
    );
  }

  const arr = (k: string) =>
    Array.isArray(resumo[k]) ? (resumo[k] as unknown[]).map(String).filter(Boolean) : [];
  const str = (k: string) => (typeof resumo[k] === "string" ? (resumo[k] as string).trim() : "");

  const nicho = str("nicho");
  const empresa = str("empresa");
  const tipoDoc = str("tipo_documento");
  const modelo = str("modelo_negocio");
  const publico = str("publico_alvo");
  const tom = str("tom_voz");
  const segmentos = arr("segmentos");
  const produtos = arr("produtos_servicos");
  const pontos = arr("pontos_chave");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {nicho || empresa ? (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: RF_TEXT_PRIMARY, lineHeight: 1.45 }}>
          {nicho || empresa}
        </p>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tipoDoc ? <Chip text={tipoDoc} /> : null}
        {modelo ? <Chip text={modelo} tone="blue" /> : null}
      </div>
      {publico ? (
        <p style={{ margin: 0, fontSize: 12, color: RF_TEXT_SECONDARY }}>
          <span style={{ color: RF_TEXT_MUTED, fontWeight: 700 }}>Público: </span>
          {publico}
        </p>
      ) : null}
      {tom ? (
        <p style={{ margin: 0, fontSize: 12, color: RF_TEXT_SECONDARY }}>
          <span style={{ color: RF_TEXT_MUTED, fontWeight: 700 }}>Tom: </span>
          {tom}
        </p>
      ) : null}
      {segmentos.length ? <TagList label="Segmentos" items={segmentos} /> : null}
      {produtos.length ? <TagList label="Produtos/serviços" items={produtos} /> : null}
      {pontos.length ? <TagList label="Pontos-chave" items={pontos} ordered /> : null}
    </div>
  );
}

function Chip({ text, tone = "green" }: { text: string; tone?: "green" | "blue" }) {
  const style =
    tone === "blue"
      ? { bg: "rgba(121,192,255,0.14)", fg: "#79c0ff", border: "rgba(121,192,255,0.35)" }
      : { bg: "rgba(146,255,0,0.12)", fg: RF_ACCENT, border: RF_BORDER_STRONG };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 999,
        background: style.bg,
        color: style.fg,
        border: `1px solid ${style.border}`,
      }}
    >
      {text}
    </span>
  );
}

function TagList({ label, items, ordered }: { label: string; items: string[]; ordered?: boolean }) {
  const ListTag = ordered ? "ol" : "ul";
  return (
    <div>
      <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: RF_TEXT_MUTED }}>
        {label}
      </p>
      <ListTag style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: RF_TEXT_SECONDARY, lineHeight: 1.5 }}>
        {items.map((item) => (
          <li key={item} style={{ marginBottom: 3 }}>
            {item}
          </li>
        ))}
      </ListTag>
    </div>
  );
}

export function CrmConhecimentoSideover({
  documento,
  onClose,
  onReprocessar,
  onExcluir,
  onDocumentoAtualizado,
  busy,
}: Props) {
  const [detalhe, setDetalhe] = useState<TenantConhecimentoDocumento | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroCarregar, setErroCarregar] = useState("");
  const [tituloEdit, setTituloEdit] = useState("");
  const [salvandoTitulo, setSalvandoTitulo] = useState(false);
  const [erroTitulo, setErroTitulo] = useState("");
  const onAtualizadoRef = useRef(onDocumentoAtualizado);
  onAtualizadoRef.current = onDocumentoAtualizado;

  const doc = detalhe ?? documento;

  const carregarDetalhe = useCallback(async (id: string) => {
    setCarregando(true);
    setErroCarregar("");
    try {
      const r = await fetch(`/api/hub/conhecimento/${encodeURIComponent(id)}`, { headers: await crmApiHeaders() });
      const json = (await r.json()) as { documento?: TenantConhecimentoDocumento; error?: string };
      if (!r.ok) throw new Error(json.error || "Falha ao carregar documento.");
      if (json.documento) {
        setDetalhe(json.documento);
        setTituloEdit(json.documento.titulo?.trim() || "");
        onAtualizadoRef.current?.(json.documento);
      }
    } catch (e) {
      setErroCarregar(e instanceof Error ? e.message : "Erro ao carregar detalhe.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!documento?.id) {
      setDetalhe(null);
      setTituloEdit("");
      return;
    }
    setTituloEdit(documento.titulo?.trim() || "");
    void carregarDetalhe(documento.id);
  }, [documento?.id, documento?.indexado_em, documento?.chunks_count, documento?.status, carregarDetalhe]);

  const salvarTitulo = useCallback(async () => {
    if (!doc?.id) return;
    const titulo = tituloEdit.trim();
    setSalvandoTitulo(true);
    setErroTitulo("");
    try {
      const r = await fetch(`/api/hub/conhecimento/${encodeURIComponent(doc.id)}`, {
        method: "PATCH",
        headers: { ...(await crmApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: titulo || null }),
      });
      const json = (await r.json()) as { documento?: TenantConhecimentoDocumento; error?: string };
      if (!r.ok) throw new Error(json.error || "Falha ao guardar título.");
      if (json.documento) {
        const atualizado = { ...doc, ...json.documento };
        setDetalhe(atualizado);
        onAtualizadoRef.current?.(atualizado);
      }
    } catch (e) {
      setErroTitulo(e instanceof Error ? e.message : "Erro ao guardar.");
    } finally {
      setSalvandoTitulo(false);
    }
  }, [doc, tituloEdit]);

  if (!documento || !doc) return null;

  const tituloExibicao = doc.titulo?.trim() || doc.nome_arquivo;
  const tipo = tipoDocumento(doc.nome_arquivo);
  const st = statusCores(doc.status);
  const previewTexto = doc.texto_extraido?.trim().slice(0, 2400) ?? "";
  const tituloAlterado = tituloEdit.trim() !== (doc.titulo?.trim() || "");

  return (
    <>
      <button type="button" aria-label="Fechar painel" onClick={onClose} style={rfOverlayStyle(212)} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Documento ${tituloExibicao}`}
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
                  background: tipo.bg,
                  border: `1px solid ${RF_BORDER_STRONG}`,
                  flexShrink: 0,
                }}
              >
                <tipo.Icon size={24} color={tipo.cor} strokeWidth={2} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                  DOCUMENTO · {tipo.label}
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
                  {tituloExibicao}
                </h2>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: st.bg,
                      color: st.fg,
                      border: `1px solid ${st.border}`,
                      textTransform: "uppercase",
                    }}
                  >
                    {statusLabel(doc.status)}
                  </span>
                  <span style={{ fontSize: 11, color: RF_TEXT_MUTED }}>
                    {doc.chunks_count ?? 0} trechos · {fmtBytes(doc.tamanho_bytes)}
                  </span>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" style={rfCloseButtonStyle()}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </header>

        <div style={rfAsideBodyStyle()}>
          {erroCarregar ? (
            <p style={{ margin: "0 0 12px", color: "#f85149", fontSize: 12 }}>{erroCarregar}</p>
          ) : null}

          <div style={rfInnerPanelStyle()}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>Identificação</p>
            </div>
            <div style={{ padding: "12px 14px" }}>
              <label style={{ ...RF_LABEL_STYLE, display: "block", marginBottom: 6 }}>Título</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={tituloEdit}
                  onChange={(e) => setTituloEdit(e.target.value)}
                  placeholder={doc.nome_arquivo}
                  maxLength={200}
                  style={{ ...RF_INPUT_STYLE, flex: 1 }}
                  disabled={salvandoTitulo || busy}
                />
                <button
                  type="button"
                  onClick={() => void salvarTitulo()}
                  disabled={!tituloAlterado || salvandoTitulo || busy}
                  title="Guardar título"
                  style={{
                    ...footerBtnStyle,
                    width: 40,
                    padding: 0,
                    opacity: tituloAlterado ? 1 : 0.45,
                  }}
                >
                  {salvandoTitulo ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                </button>
              </div>
              {erroTitulo ? <p style={{ margin: "8px 0 0", color: "#f85149", fontSize: 11 }}>{erroTitulo}</p> : null}
              <p style={{ margin: "10px 0 0", fontSize: 11, color: RF_TEXT_MUTED, wordBreak: "break-all" }}>
                Ficheiro: <code style={{ fontSize: 11 }}>{doc.nome_arquivo}</code>
              </p>
            </div>
          </div>

          <div style={{ ...rfInnerPanelStyle(), marginTop: 12 }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>Indexação</p>
            </div>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                <MetaChip label="Enviado" value={fmtDataHora(doc.criado_em)} />
                <MetaChip label="Indexado" value={fmtDataHora(doc.indexado_em)} />
                <MetaChip label="Trechos RAG" value={doc.chunks_count ?? 0} />
                <MetaChip label="Tipo MIME" value={doc.mime_type?.split("/").pop() || tipo.label} />
              </div>
              {doc.erro ? (
                <p
                  style={{
                    margin: "12px 0 0",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(248,81,73,0.35)",
                    background: "rgba(248,81,73,0.1)",
                    color: "#f85149",
                    fontSize: 12,
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  {doc.erro}
                </p>
              ) : null}
            </div>
          </div>

          <div style={{ ...rfInnerPanelStyle(), marginTop: 12 }}>
            <div
              style={{
                padding: "12px 14px",
                borderBottom: `1px solid ${RF_BORDER}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Sparkles size={14} color={RF_ACCENT} />
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>Resumo IA do documento</p>
            </div>
            <div style={{ padding: "12px 14px" }}>
              {carregando ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: RF_TEXT_MUTED, fontSize: 12 }}>
                  <Loader2 size={14} className="animate-spin" />
                  A carregar análise…
                </div>
              ) : (
                <ResumoIaPanel resumo={doc.resumo_ia} />
              )}
            </div>
          </div>

          {previewTexto ? (
            <div style={{ ...rfInnerPanelStyle(), marginTop: 12 }}>
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
                <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>Prévia do texto extraído</p>
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  maxHeight: 200,
                  overflow: "auto",
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: RF_TEXT_SECONDARY,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {previewTexto}
                {(doc.texto_extraido?.length ?? 0) > previewTexto.length ? "…" : null}
              </div>
            </div>
          ) : null}
        </div>

        <footer style={{ ...rfAsideFooterStyle(), flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
            Alimenta a sugestão de cargos e o contexto dos agentes IA.
          </p>
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            {onReprocessar ? (
              <button
                type="button"
                disabled={busy || carregando}
                onClick={() => onReprocessar(doc.id)}
                style={{
                  ...footerBtnStyle,
                  flex: 1,
                  background: "rgba(146,255,0,0.08)",
                  color: RF_ACCENT,
                }}
              >
                <RefreshCw size={14} className={busy ? "animate-spin" : undefined} />
                Reindexar
              </button>
            ) : null}
            {onExcluir ? (
              <button
                type="button"
                disabled={busy || carregando}
                onClick={() => onExcluir(doc.id)}
                style={{
                  ...footerBtnStyle,
                  flex: 1,
                  border: "1px solid rgba(248,81,73,0.35)",
                  background: "rgba(248,81,73,0.12)",
                  color: "#f85149",
                }}
              >
                <Trash2 size={14} />
                Excluir
              </button>
            ) : null}
          </div>
        </footer>
      </aside>
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
