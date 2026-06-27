"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import {
  AlertCircle,
  BookOpen,
  Eye,
  FileJson,
  FileSpreadsheet,
  FileText,
  Presentation,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CrmBotRingAvatar } from "@/components/crm/CrmBotRingAvatar";
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
import { RAG_ACCEPT_INPUT_ATTR, RAG_FORMATOS_RESUMO } from "@/lib/hub/rag";
import type { TenantConhecimentoDocumento } from "@/lib/hub/tenant-conhecimento-rag";
import { MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT } from "@/lib/hub/tenant-conhecimento-rag";

type Props = {
  open: boolean;
  onClose: () => void;
  documentos: TenantConhecimentoDocumento[];
  uploading: boolean;
  busy: boolean;
  noLimite: boolean;
  aviso?: string | null;
  onUpload: (file: File, titulo?: string) => Promise<void>;
  onVerDetalhe: (doc: TenantConhecimentoDocumento) => void;
  onReprocessar: (id: string) => void;
  onExcluir: (id: string) => void;
  documentosProntos: number;
  analiseGenerating: boolean;
  onAnalisarNegocio: () => void;
};

type PendingQueueItem = {
  id: string;
  file: File;
};

function fileQueueId(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

function extensaoArquivo(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : "";
}

function fmtTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
  if (["docx", "doc", "odt", "rtf"].includes(ext)) {
    return { Icon: FileText, label: ext.toUpperCase(), cor: "#79c0ff", bg: "rgba(121,192,255,0.14)" };
  }
  return { Icon: FileText, label: ext ? ext.toUpperCase() : "DOC", cor: RF_ACCENT, bg: "rgba(146,255,0,0.12)" };
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

function fmtDataCurta(iso?: string | null): string {
  if (!iso?.trim()) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function CrmConhecimentoGerirSideover({
  open,
  onClose,
  documentos,
  uploading,
  busy,
  noLimite,
  aviso,
  onUpload,
  onVerDetalhe,
  onReprocessar,
  onExcluir,
  documentosProntos,
  analiseGenerating,
  onAnalisarNegocio,
}: Props) {
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tituloUpload, setTituloUpload] = useState("");
  const [pendingQueue, setPendingQueue] = useState<PendingQueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadErro, setUploadErro] = useState("");
  const [processandoIdx, setProcessandoIdx] = useState(0);

  const vagas = Math.max(0, MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT - documentos.length);
  const vagasFila = Math.max(0, vagas - pendingQueue.length);
  const podeAdicionar = vagasFila > 0 && !uploading && !aviso;
  const podeProcessar = pendingQueue.length > 0 && !uploading && !noLimite && !aviso;
  const podeAnalisar = documentosProntos > 0 && !uploading && !analiseGenerating && !aviso;

  useEffect(() => {
    if (!open || !fileRef.current) return;
    fileRef.current.multiple = true;
    fileRef.current.setAttribute("multiple", "multiple");
  }, [open]);

  const adicionarFicheiros = useCallback(
    (files: FileList | File[] | null) => {
      if (!files?.length || uploading || aviso) return;
      const lista = Array.from(files);
      let ignorados = 0;

      setPendingQueue((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        const novos: PendingQueueItem[] = [];
        let restantes = Math.max(0, vagas - prev.length);
        for (const file of lista) {
          if (restantes <= 0) {
            ignorados += 1;
            continue;
          }
          const id = fileQueueId(file);
          if (ids.has(id)) continue;
          ids.add(id);
          novos.push({ id, file });
          restantes -= 1;
        }
        return novos.length ? [...prev, ...novos] : prev;
      });

      if (ignorados > 0) {
        setUploadErro(`Só foi possível adicionar ${vagas} ficheiro(s) no total (limite da biblioteca).`);
      } else {
        setUploadErro("");
      }
      if (fileRef.current) fileRef.current.value = "";
    },
    [aviso, uploading, vagas]
  );

  const removerDaFila = useCallback((id: string) => {
    setPendingQueue((prev) => prev.filter((p) => p.id !== id));
    setUploadErro("");
  }, []);

  const limparFila = useCallback(() => {
    setPendingQueue([]);
    setTituloUpload("");
    if (fileRef.current) fileRef.current.value = "";
    setUploadErro("");
  }, []);

  const processar = useCallback(async () => {
    if (!pendingQueue.length || uploading || noLimite) return;
    setUploadErro("");
    const fila = [...pendingQueue];
    const tituloUnico = fila.length === 1 ? tituloUpload.trim() || undefined : undefined;

    for (let i = 0; i < fila.length; i++) {
      setProcessandoIdx(i + 1);
      try {
        await onUpload(fila[i].file, tituloUnico);
      } catch (e) {
        setProcessandoIdx(0);
        setPendingQueue(fila.slice(i));
        setUploadErro(e instanceof Error ? e.message : "Falha no envio.");
        return;
      }
    }

    setProcessandoIdx(0);
    limparFila();
  }, [limparFila, noLimite, onUpload, pendingQueue, tituloUpload, uploading]);

  if (!open) return null;

  return (
    <>
      <button type="button" aria-label="Fechar painel" onClick={onClose} style={rfOverlayStyle(210)} />
      <aside role="dialog" aria-modal="true" aria-label="Gerir conhecimento da empresa" style={rfAsideStyle("min(640px, 100vw)", 211)}>
        <header style={rfAsideHeaderStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
              <CrmBotRingAvatar accent={RF_ACCENT} progress={0.55} fallbackProgress={0.4} pixelSize={52} Icon={BookOpen} />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                  CONHECIMENTO DA EMPRESA
                </p>
                <h3 style={{ margin: "3px 0 0", color: RF_TEXT_PRIMARY, fontSize: 17 }}>Enviar e gerir documentos</h3>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
                  {documentos.length}/{MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT} documentos · {vagas} vaga(s)
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" style={rfCloseButtonStyle()}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </header>

        <div style={rfAsideBodyStyle()}>
          {aviso ? (
            <p
              style={{
                margin: "0 0 14px",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(230,192,106,0.35)",
                background: "rgba(187,128,9,0.12)",
                color: "#e6c06a",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              {aviso} Contacte o suporte da plataforma para activar a base de conhecimento.
            </p>
          ) : null}

          <div style={rfInnerPanelStyle()}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>Novo documento</p>
              <p style={{ margin: "6px 0 0", color: RF_TEXT_SECONDARY, fontSize: 11, lineHeight: 1.45 }}>
                Formatos: {RAG_FORMATOS_RESUMO}. Máx. 5 MB por ficheiro.
              </p>
            </div>
            <div style={{ padding: "12px 14px" }}>
              {pendingQueue.length === 1 ? (
                <>
                  <label style={{ ...RF_LABEL_STYLE, display: "block", marginBottom: 6 }}>Título (opcional)</label>
                  <input
                    type="text"
                    value={tituloUpload}
                    onChange={(e) => setTituloUpload(e.target.value)}
                    placeholder="Ex.: Catálogo de serviços 2026"
                    maxLength={200}
                    style={{ ...RF_INPUT_STYLE, marginBottom: 12 }}
                    disabled={uploading || noLimite}
                  />
                </>
              ) : null}

              <input
                id={fileInputId}
                ref={fileRef}
                type="file"
                accept={RAG_ACCEPT_INPUT_ATTR}
                multiple
                className="sr-only"
                disabled={!podeAdicionar}
                onChange={(e) => {
                  adicionarFicheiros(e.target.files);
                  e.target.value = "";
                }}
              />

              <label
                htmlFor={podeAdicionar ? fileInputId : undefined}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (podeAdicionar) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (podeAdicionar) adicionarFicheiros(e.dataTransfer.files);
                }}
                style={{
                  width: "100%",
                  padding: "24px 16px",
                  borderRadius: 12,
                  border: `2px dashed ${dragOver ? RF_ACCENT : RF_BORDER_STRONG}`,
                  background: dragOver ? "rgba(146,255,0,0.08)" : "rgba(6,13,8,0.55)",
                  cursor: podeAdicionar ? "pointer" : "not-allowed",
                  opacity: podeAdicionar ? 1 : 0.55,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <Upload size={26} color={RF_ACCENT} strokeWidth={1.75} />
                <span style={{ color: RF_TEXT_PRIMARY, fontSize: 13, fontWeight: 700 }}>
                  {noLimite
                    ? "Limite de documentos atingido"
                    : podeAdicionar
                      ? "Clique ou arraste ficheiros"
                      : "Fila cheia para as vagas disponíveis"}
                </span>
                <span style={{ color: RF_TEXT_MUTED, fontSize: 11, textAlign: "center", lineHeight: 1.45 }}>
                  No diálogo do Windows, use <strong style={{ color: RF_TEXT_SECONDARY }}>Ctrl+clique</strong> para
                  escolher vários ficheiros de uma vez
                </span>
                <span style={{ color: RF_TEXT_MUTED, fontSize: 11, textAlign: "center" }}>
                  Reveja na tabela abaixo e clique em Processar
                </span>
              </label>

              {pendingQueue.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: RF_ACCENT }}>
                      Fila para processar ({pendingQueue.length})
                    </p>
                    <button
                      type="button"
                      onClick={limparFila}
                      disabled={uploading}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: RF_TEXT_MUTED,
                        fontSize: 11,
                        cursor: uploading ? "not-allowed" : "pointer",
                        textDecoration: "underline",
                        padding: 0,
                      }}
                    >
                      Limpar tudo
                    </button>
                  </div>
                  <div
                    style={{
                      border: `1px solid ${RF_BORDER}`,
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "rgba(6,13,8,0.35)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "44px 1fr auto 36px",
                        gap: 8,
                        padding: "8px 10px",
                        borderBottom: `1px solid ${RF_BORDER}`,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        textTransform: "uppercase",
                        color: RF_TEXT_MUTED,
                      }}
                    >
                      <span>Tipo</span>
                      <span>Documento</span>
                      <span style={{ textAlign: "right" }}>Tamanho</span>
                      <span />
                    </div>
                    <div style={{ maxHeight: 180, overflowY: "auto" }}>
                      {pendingQueue.map((item, index) => {
                        const tipo = tipoDocumento(item.file.name);
                        const { Icon } = tipo;
                        return (
                          <div
                            key={item.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "44px 1fr auto 36px",
                              gap: 8,
                              alignItems: "center",
                              padding: "8px 10px",
                              borderBottom: index < pendingQueue.length - 1 ? `1px solid ${RF_BORDER}` : "none",
                            }}
                          >
                            <div
                              title={tipo.label}
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: tipo.bg,
                                border: `1px solid ${RF_BORDER}`,
                              }}
                            >
                              <Icon size={16} color={tipo.cor} strokeWidth={2} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: RF_TEXT_PRIMARY,
                                  wordBreak: "break-word",
                                  lineHeight: 1.35,
                                }}
                                title={item.file.name}
                              >
                                {item.file.name}
                              </p>
                              <p style={{ margin: "2px 0 0", fontSize: 10, color: RF_TEXT_MUTED }}>{tipo.label}</p>
                            </div>
                            <span style={{ fontSize: 10, color: RF_TEXT_MUTED, whiteSpace: "nowrap" }}>
                              {fmtTamanho(item.file.size)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removerDaFila(item.id)}
                              disabled={uploading}
                              title="Remover da fila"
                              aria-label={`Remover ${item.file.name}`}
                              style={{
                                ...iconBtnStyle,
                                width: 30,
                                height: 30,
                                color: "#f85149",
                                borderColor: "rgba(248,81,73,0.35)",
                              }}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {vagasFila > 0 ? (
                    <p style={{ margin: "8px 0 0", fontSize: 10, color: RF_TEXT_MUTED }}>
                      Pode adicionar mais {vagasFila} ficheiro(s) antes de processar.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {uploadErro ? (
                <p style={{ margin: "10px 0 0", color: "#f85149", fontSize: 12 }}>{uploadErro}</p>
              ) : null}
            </div>
          </div>

          <div style={{ ...rfInnerPanelStyle(), marginTop: 14 }}>
            <div
              style={{
                padding: "12px 14px",
                borderBottom: `1px solid ${RF_BORDER}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>
                Biblioteca ({documentos.length})
              </p>
            </div>
            <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {documentos.length === 0 ? (
                <p style={{ margin: 0, color: RF_TEXT_MUTED, fontSize: 12, lineHeight: 1.5 }}>
                  Nenhum documento ainda. Envie o primeiro ficheiro acima.
                </p>
              ) : (
                documentos.map((d) => {
                  const titulo = d.titulo?.trim() || d.nome_arquivo;
                  const st = statusCores(d.status);
                  return (
                    <div
                      key={d.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: `1px solid ${d.status === "erro" ? "rgba(248,81,73,0.3)" : RF_BORDER}`,
                        background: "rgba(6,13,8,0.45)",
                      }}
                    >
                      <FileText size={18} color={RF_ACCENT} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: RF_TEXT_PRIMARY, wordBreak: "break-word" }}>
                            {titulo}
                          </span>
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
                            {statusLabel(d.status)}
                          </span>
                        </div>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: RF_TEXT_MUTED, wordBreak: "break-all" }}>
                          {d.nome_arquivo} · {d.chunks_count ?? 0} trechos · {fmtDataCurta(d.indexado_em)}
                        </p>
                        {d.erro ? (
                          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#f85149", display: "flex", gap: 6, alignItems: "flex-start" }}>
                            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                            {d.erro}
                          </p>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onVerDetalhe(d)}
                          title="Ver detalhes"
                          aria-label={`Ver ${titulo}`}
                          style={iconBtnStyle}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onReprocessar(d.id)}
                          title="Reindexar"
                          aria-label={`Reindexar ${titulo}`}
                          style={iconBtnStyle}
                        >
                          <RefreshCw size={14} className={busy ? "animate-spin" : undefined} />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onExcluir(d.id)}
                          title="Excluir"
                          aria-label={`Excluir ${titulo}`}
                          style={{ ...iconBtnStyle, color: "#f85149", borderColor: "rgba(248,81,73,0.35)" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <footer style={{ ...rfAsideFooterStyle(), flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
            Estes documentos alimentam a sugestão de cargos e o contexto dos agentes IA.
          </p>
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button
              type="button"
              onClick={() => void processar()}
              disabled={!podeProcessar}
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 10,
                border: "none",
                background: podeProcessar ? "#0b1f10" : "rgba(6, 13, 8, 0.5)",
                color: podeProcessar ? RF_ACCENT : RF_TEXT_MUTED,
                fontSize: 13,
                fontWeight: 800,
                cursor: podeProcessar ? "pointer" : "not-allowed",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <RefreshCw size={14} className={uploading ? "animate-spin" : undefined} />
              {uploading
                ? processandoIdx > 0
                  ? `A processar ${processandoIdx}/${pendingQueue.length}…`
                  : "A processar…"
                : pendingQueue.length > 1
                  ? `Processar ${pendingQueue.length} ficheiros`
                  : "Processar"}
            </button>
            <button
              type="button"
              onClick={onAnalisarNegocio}
              disabled={!podeAnalisar}
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${podeAnalisar ? RF_BORDER_STRONG : RF_BORDER}`,
                background: podeAnalisar ? "rgba(146,255,0,0.08)" : "transparent",
                color: podeAnalisar ? RF_ACCENT : RF_TEXT_MUTED,
                fontSize: 13,
                fontWeight: 700,
                cursor: podeAnalisar ? "pointer" : "not-allowed",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Sparkles size={14} className={analiseGenerating ? "animate-pulse" : undefined} />
              {analiseGenerating ? "A analisar…" : "Analisar negócio"}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

const iconBtnStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: `1px solid ${RF_BORDER_STRONG}`,
  background: "rgba(6,13,8,0.72)",
  color: RF_ACCENT,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
