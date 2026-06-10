"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { CrmConhecimentoAnalisePanel } from "@/components/crm/CrmConhecimentoAnalisePanel";
import {
  CrmResizableDataTable,
  type CrmResizableColumn,
} from "@/components/crm/CrmResizableDataTable";
import { ContaSectionTabs } from "@/components/crm/ContaSectionTabs";
import { CrmConhecimentoGerirSideover } from "@/components/crm/CrmConhecimentoGerirSideover";
import { CrmConhecimentoSideover } from "@/components/crm/CrmConhecimentoSideover";
import { useCrmConfirm, useCrmToast } from "@/lib/crm/crm-feedback";
import { RAG_ACCEPT_ATTR, RAG_FORMATOS_RESUMO } from "@/lib/hub/rag";
import type {
  TenantConhecimentoAnaliseNegocio,
  TenantConhecimentoDocumento,
} from "@/lib/hub/tenant-conhecimento-rag";
import { CrmMetricCard, CrmMetricsGrid } from "@/components/crm/CrmMetricCard";
import { sparklineFromCounts, sparklineFromSeed } from "@/lib/crm/metric-visuals";
import { MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT } from "@/lib/hub/tenant-conhecimento-rag";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";

type SectionTab = "documentos" | "analise" | "orientacoes";
type FiltroStatus = "todos" | "indexando" | "pronto" | "erro";

const PAGE_SIZE = 10;

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatShortId(value?: string | null): string {
  if (!value) return "—";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function extensaoArquivo(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : "—";
}

function statusLabel(status: string): string {
  if (status === "pronto") return "Indexado";
  if (status === "indexando") return "A processar";
  if (status === "erro") return "Erro";
  return status;
}

function IdBadge({ value, tone = "blue" }: { value?: string | null; tone?: "blue" | "green" | "gray" }) {
  const color =
    tone === "green"
      ? { bg: "#eefbf1", border: "#cdecd5", text: "#2f7a43" }
      : tone === "gray"
        ? { bg: "#f4f6f8", border: "#dbe1e7", text: "#4e657f" }
        : { bg: "#eef6ff", border: "#cbe1ff", text: "#2e67b1" };
  return (
    <span
      className="inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}
      title={value ?? undefined}
    >
      {formatShortId(value)}
    </span>
  );
}

function resumoPreview(resumo: Record<string, unknown> | null): string {
  if (!resumo || typeof resumo !== "object") return "—";
  const empresa = typeof resumo.empresa === "string" ? resumo.empresa.trim() : "";
  if (empresa) return empresa;
  const pontos = Array.isArray(resumo.pontos_chave) ? resumo.pontos_chave.map(String).filter(Boolean) : [];
  if (pontos[0]) return pontos[0];
  return "Resumo disponível";
}

export default function ConhecimentoPage() {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useCrmToast();
  const { confirmDialog, setConfirmLoading, closeConfirmDialog } = useCrmConfirm();
  const [documentos, setDocumentos] = useState<TenantConhecimentoDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sideoverBusy, setSideoverBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FiltroStatus>("todos");
  const [sectionTab, setSectionTab] = useState<SectionTab>("documentos");
  const [page, setPage] = useState(1);
  const [gerirOpen, setGerirOpen] = useState(false);
  const [sideover, setSideover] = useState<TenantConhecimentoDocumento | null>(null);
  const [analise, setAnalise] = useState<TenantConhecimentoAnaliseNegocio | null>(null);
  const [analiseGeradoEm, setAnaliseGeradoEm] = useState<string | null>(null);
  const [analiseDesatualizada, setAnaliseDesatualizada] = useState(false);
  const [analiseLoading, setAnaliseLoading] = useState(false);
  const [analiseGenerating, setAnaliseGenerating] = useState(false);
  const [analiseErro, setAnaliseErro] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    setLoading(true);
    try {
      const r = await fetch("/api/hub/conhecimento", { headers: await crmApiHeaders() });
      const json = (await r.json()) as {
        documentos?: TenantConhecimentoDocumento[];
        aviso?: string;
        error?: string;
      };
      if (!r.ok) throw new Error(json.error || "Falha ao listar documentos.");
      setDocumentos(json.documentos ?? []);
      setAviso(json.aviso ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar conhecimento.");
      setDocumentos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const carregarAnalise = useCallback(async () => {
    setAnaliseErro("");
    setAnaliseLoading(true);
    try {
      const r = await fetch("/api/hub/conhecimento/analise", { headers: await crmApiHeaders() });
      const json = (await r.json()) as {
        analise?: TenantConhecimentoAnaliseNegocio | null;
        gerado_em?: string | null;
        desatualizada?: boolean;
        error?: string;
      };
      if (!r.ok) throw new Error(json.error || "Falha ao carregar análise.");
      setAnalise(json.analise ?? null);
      setAnaliseGeradoEm(json.gerado_em ?? null);
      setAnaliseDesatualizada(Boolean(json.desatualizada));
    } catch (e) {
      setAnaliseErro(e instanceof Error ? e.message : "Erro ao carregar análise.");
    } finally {
      setAnaliseLoading(false);
    }
  }, []);

  const gerarAnalise = useCallback(
    async (opts?: { silencioso?: boolean; mudarTab?: boolean }) => {
      setAnaliseErro("");
      setAnaliseGenerating(true);
      try {
        const r = await fetch("/api/hub/conhecimento/analise", {
          method: "POST",
          headers: await crmApiHeaders(),
        });
        const json = (await r.json()) as {
          analise?: TenantConhecimentoAnaliseNegocio;
          gerado_em?: string;
          error?: string;
        };
        if (!r.ok) throw new Error(json.error || "Falha ao gerar análise.");
        setAnalise(json.analise ?? null);
        setAnaliseGeradoEm(json.gerado_em ?? null);
        setAnaliseDesatualizada(false);
        if (!opts?.silencioso) toastSuccess("Análise do negócio atualizada.");
        if (opts?.mudarTab) setSectionTab("analise");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro ao gerar análise.";
        setAnaliseErro(msg);
        if (!opts?.silencioso) toastError(msg);
      } finally {
        setAnaliseGenerating(false);
      }
    },
    [toastSuccess, toastError]
  );

  useEffect(() => {
    void carregarAnalise();
  }, [carregarAnalise]);

  const noLimite = documentos.length >= MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT;

  const onUpload = useCallback(
    async (file: File, titulo?: string) => {
      if (noLimite) {
        const msg = `Limite de ${MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT} documentos atingido.`;
        toastWarning(msg);
        throw new Error(msg);
      }
      setUploading(true);
      setErro("");
      try {
        const form = new FormData();
        form.append("file", file);
        if (titulo?.trim()) form.append("titulo", titulo.trim());
        const r = await fetch("/api/hub/conhecimento", {
          method: "POST",
          headers: await crmApiHeaders(),
          body: form,
        });
        const json = (await r.json()) as { documento?: TenantConhecimentoDocumento; error?: string };
        if (!r.ok) throw new Error(json.error || "Falha no upload.");
        if (json.documento) {
          setDocumentos((prev) => [json.documento!, ...prev.filter((d) => d.id !== json.documento!.id)]);
          toastSuccess("Documento processado com sucesso. Use «Analisar negócio» para gerar o perfil da empresa.");
          if (json.documento.status === "pronto") setAnaliseDesatualizada(true);
        } else {
          await carregar();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro no upload.";
        setErro(msg);
        toastError(msg);
        throw e;
      } finally {
        setUploading(false);
      }
    },
    [carregar, noLimite, toastSuccess, toastError, toastWarning]
  );

  const reprocessar = useCallback(
    async (id: string) => {
      setSideoverBusy(true);
      try {
        const r = await fetch(`/api/hub/conhecimento/${encodeURIComponent(id)}/processar`, {
          method: "POST",
          headers: await crmApiHeaders(),
        });
        const json = (await r.json()) as { documento?: TenantConhecimentoDocumento; error?: string };
        if (!r.ok) throw new Error(json.error || "Falha ao reindexar.");
        if (json.documento) {
          setDocumentos((prev) => prev.map((d) => (d.id === id ? { ...d, ...json.documento! } : d)));
          setSideover((s) => (s?.id === id ? { ...s, ...json.documento! } : s));
        }
        toastSuccess("Documento reindexado.");
        if (json.documento?.status === "pronto") setAnaliseDesatualizada(true);
      } catch (e) {
        toastError(e instanceof Error ? e.message : "Erro ao reindexar.");
      } finally {
        setSideoverBusy(false);
      }
    },
    [toastSuccess, toastError]
  );

  const excluir = useCallback(
    async (id: string) => {
      const ok = await confirmDialog({
        title: "Excluir documento?",
        variant: "destructive",
        confirmLabel: "Excluir",
        message: "O ficheiro será removido da base de conhecimento e do armazenamento.",
      });
      if (!ok) return;

      setConfirmLoading(true);
      setSideoverBusy(true);
      try {
        const r = await fetch(`/api/hub/conhecimento/${encodeURIComponent(id)}`, {
          method: "DELETE",
          headers: await crmApiHeaders(),
        });
        const json = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(json.error || "Falha ao excluir.");
        setDocumentos((prev) => prev.filter((d) => d.id !== id));
        setSideover(null);
        toastSuccess("Documento removido.");
        setAnaliseDesatualizada(true);
        void carregarAnalise();
      } catch (e) {
        toastError(e instanceof Error ? e.message : "Erro ao excluir.");
      } finally {
        setSideoverBusy(false);
        setConfirmLoading(false);
        closeConfirmDialog();
      }
    },
    [carregarAnalise, closeConfirmDialog, confirmDialog, setConfirmLoading, toastSuccess, toastError]
  );

  const indexados = documentos.filter((d) => d.status === "pronto");
  const processando = documentos.filter((d) => d.status === "indexando");
  const comErro = documentos.filter((d) => d.status === "erro");
  const vagas = Math.max(0, MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT - documentos.length);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documentos.filter((d) => {
      if (filterStatus !== "todos" && d.status !== filterStatus) return false;
      if (!q) return true;
      const titulo = (d.titulo || d.nome_arquivo || "").toLowerCase();
      const nome = (d.nome_arquivo || "").toLowerCase();
      return titulo.includes(q) || nome.includes(q);
    });
  }, [documentos, searchQuery, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterStatus, sectionTab]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedDocs = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredDocs.slice(start, start + PAGE_SIZE);
  }, [filteredDocs, safePage]);

  const tabelaColunas = useMemo((): CrmResizableColumn<TenantConhecimentoDocumento>[] => {
    return [
      {
        id: "id",
        label: "ID",
        defaultWidth: 130,
        minWidth: 80,
        render: (d) => <IdBadge value={d.id} tone="blue" />,
      },
      {
        id: "documento",
        label: "Documento",
        defaultWidth: 280,
        minWidth: 160,
        render: (d) => {
          const titulo = d.titulo?.trim() || d.nome_arquivo;
          const atencao = d.status === "erro";
          return (
            <div className="flex min-w-0 items-start gap-2">
              {atencao ? (
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#f85149]" aria-hidden />
              ) : null}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#0b2210]" title={titulo}>
                  {titulo}
                </div>
                <div className="text-xs text-[#6f86a6]" title={d.nome_arquivo}>
                  {d.nome_arquivo}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: "tipo",
        label: "Tipo",
        defaultWidth: 90,
        minWidth: 64,
        render: (d) => <IdBadge value={extensaoArquivo(d.nome_arquivo)} tone="gray" />,
      },
      {
        id: "estado",
        label: "Estado",
        defaultWidth: 120,
        minWidth: 90,
        truncate: false,
        render: (d) => (
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background:
                d.status === "pronto"
                  ? "rgba(146,255,0,0.12)"
                  : d.status === "erro"
                    ? "rgba(248,81,73,0.12)"
                    : "rgba(230,192,106,0.15)",
              color: d.status === "pronto" ? "#1e4a24" : d.status === "erro" ? "#c0392b" : "#8a6d1a",
              border:
                d.status === "pronto"
                  ? "1px solid rgba(146,255,0,0.3)"
                  : d.status === "erro"
                    ? "1px solid rgba(248,81,73,0.35)"
                    : "1px solid rgba(230,192,106,0.4)",
            }}
          >
            {statusLabel(d.status)}
          </span>
        ),
      },
      {
        id: "trechos",
        label: "Trechos",
        defaultWidth: 88,
        minWidth: 64,
        render: (d) => (
          <span className="text-sm font-semibold text-[#1e4a24]">{d.chunks_count ?? 0}</span>
        ),
      },
      {
        id: "resumo",
        label: "Resumo IA",
        defaultWidth: 260,
        minWidth: 120,
        render: (d) => (
          <span className="text-xs text-[#4e657f]" title={resumoPreview(d.resumo_ia)}>
            {resumoPreview(d.resumo_ia)}
          </span>
        ),
      },
      {
        id: "indexado",
        label: "Indexado em",
        defaultWidth: 150,
        minWidth: 110,
        render: (d) => (
          <span className="text-xs text-[#4e657f]">{formatDateTime(d.indexado_em)}</span>
        ),
      },
      {
        id: "acoes",
        label: "Ações",
        defaultWidth: 80,
        minWidth: 72,
        truncate: false,
        align: "center",
        render: (d) => {
          const titulo = d.titulo?.trim() || d.nome_arquivo;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSideover(d);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d4ecd0] bg-white text-[#1e4a24] transition-colors hover:bg-[#f0f9ee]"
              aria-label={`Ver ${titulo}`}
              title="Ver documento"
            >
              <Eye size={15} />
            </button>
          );
        },
      },
    ];
  }, []);

  const exportCsv = useCallback(() => {
    const header = ["id", "titulo", "arquivo", "status", "trechos", "indexado_em", "criado_em"];
    const rows = filteredDocs.map((d) =>
      [
        d.id,
        (d.titulo || d.nome_arquivo).replace(/"/g, '""'),
        d.nome_arquivo.replace(/"/g, '""'),
        d.status,
        String(d.chunks_count ?? 0),
        d.indexado_em ?? "",
        d.criado_em ?? "",
      ]
        .map((c) => `"${c}"`)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "conhecimento-empresa.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredDocs]);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#92ff00] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-full w-full min-w-0 px-3 py-4 sm:px-5 lg:px-6 xl:px-8" style={{ background: "#f8fcf6" }}>
      <div className="w-full min-w-0">
        {erro ? (
          <p className="mb-4 rounded-xl border border-[#f0c0bd] bg-[#fff2f1] px-3 py-2 text-sm text-[#c0392b]">{erro}</p>
        ) : null}

        {aviso ? (
          <p className="mb-4 rounded-xl border border-[#e6c06a44] bg-[#bb800918] px-3 py-2 text-sm text-[#8a6d1a]">
            {aviso} Execute o script <code className="text-xs">ensure_hub_tenant_conhecimento.sql</code> no Supabase.
          </p>
        ) : null}

        <CrmMetricsGrid cols={4} className="mb-4">
          <CrmMetricCard
            label="Total de documentos"
            valor={documentos.length}
            sub={`Limite ${MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT}`}
            tone="brand"
            sparkline={sparklineFromCounts([
              indexados.length,
              processando.length,
              comErro.length,
              documentos.length,
            ])}
          />
          <CrmMetricCard
            label="Indexados"
            valor={indexados.length}
            sub="Prontos para RAG"
            tone="success"
            sparkline={sparklineFromSeed(indexados.length + 1)}
          />
          <CrmMetricCard
            label="A processar"
            valor={processando.length}
            tone="brand"
            sparkline={sparklineFromSeed(processando.length + 2)}
          />
          <CrmMetricCard
            label="Com erro"
            valor={comErro.length}
            sub={vagas > 0 ? `${vagas} vaga(s) disponível` : "Limite atingido"}
            tone={comErro.length > 0 ? "danger" : "muted"}
            sparkline={sparklineFromSeed(comErro.length + 3)}
          />
        </CrmMetricsGrid>

        <div className="w-full min-w-0 rounded-2xl border border-[#dcebd8] bg-white shadow-[0_2px_8px_rgba(11,31,16,0.05)]">
          <ContaSectionTabs
            tabs={[
              { id: "documentos", label: "Documentos" },
              {
                id: "analise",
                label: analiseDesatualizada && indexados.length > 0 ? "Análise IA •" : "Análise IA",
              },
              { id: "orientacoes", label: "Formatos e uso" },
            ]}
            activeId={sectionTab}
            onSelect={(id) => setSectionTab(id as SectionTab)}
          />

          {sectionTab === "documentos" ? (
            <>
              <div className="flex items-center justify-end border-b border-[#eef5ec] px-4 py-2">
                <button
                  type="button"
                  onClick={() => setGerirOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold"
                  style={{ background: "#0b1f10", color: "#92ff00" }}
                >
                  <Plus size={13} />
                  Enviar documento
                </button>
              </div>

              <div className="border-b border-[#eef5ec] px-4 py-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-[#d4ecd0] bg-white px-3">
                    <Search size={14} className="text-[#6b8a76]" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por título ou arquivo..."
                      className="w-full bg-transparent text-sm text-[#1e3a23] outline-none placeholder:text-[#90a89b]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFilters((v) => !v)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
                    style={{ borderColor: "#d4ecd0", color: "#1e4a24", background: "#fff" }}
                  >
                    <SlidersHorizontal size={13} />
                    Filtros avançados
                  </button>
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold"
                    style={{ borderColor: "#d4ecd0", color: "#1e4a24", background: "#fff" }}
                  >
                    Exportar
                  </button>
                </div>
                {showAdvancedFilters ? (
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                    <label className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#89a095]">Estado</span>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as FiltroStatus)}
                        className="h-10 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
                      >
                        <option value="todos">Todos</option>
                        <option value="pronto">Indexados</option>
                        <option value="indexando">A processar</option>
                        <option value="erro">Com erro</option>
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>

              <CrmResizableDataTable
                tableId="crm-conhecimento-documentos"
                columns={tabelaColunas}
                rows={paginatedDocs}
                rowKey={(d) => d.id}
                emptyMessage="Nenhum documento encontrado. Use «Enviar documento» para começar."
                getRowStyle={(d, idx): CSSProperties | undefined => ({
                  borderTop: idx > 0 ? "1px solid #edf3fb" : "none",
                  background: d.status === "erro" ? "rgba(248,81,73,0.06)" : undefined,
                })}
              />

              <div className="flex items-center justify-between border-t border-[#edf3fb] px-4 py-3">
                <p className="text-xs text-[#6f86a6]">
                  {filteredDocs.length > 0
                    ? `Exibindo ${(safePage - 1) * PAGE_SIZE + 1}-${Math.min(safePage * PAGE_SIZE, filteredDocs.length)} de ${filteredDocs.length} documentos`
                    : `Exibindo 0 de ${documentos.length} documentos`}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-40"
                    style={{ borderColor: "#d4e3f7", color: "#6a81a3", background: "#fff" }}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span
                    className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-bold"
                    style={{ background: "#0f6b4f", color: "#fff" }}
                  >
                    {safePage}
                  </span>
                  {totalPages > 1 ? (
                    <span className="text-xs text-[#6f86a6]">/ {totalPages}</span>
                  ) : null}
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-40"
                    style={{ borderColor: "#d4e3f7", color: "#6a81a3", background: "#fff" }}
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </>
          ) : sectionTab === "analise" ? (
            <CrmConhecimentoAnalisePanel
              analise={analise}
              geradoEm={analiseGeradoEm}
              documentosIndexados={indexados.length}
              desatualizada={analiseDesatualizada}
              loading={analiseLoading}
              generating={analiseGenerating}
              erro={analiseErro}
              onGerar={() => void gerarAnalise()}
            />
          ) : (
            <div className="px-5 py-6">
              <div className="mb-4 flex items-center gap-2">
                <BookOpen size={18} className="text-[#3f9848]" />
                <h2 className="text-sm font-bold text-[#0b2210]">Como usar a base de conhecimento</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#dcebd8] bg-[#f8fcf6] p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#0b2210]">
                    <FileText size={15} className="text-[#3f9848]" />
                    Formatos aceites
                  </div>
                  <p className="text-sm leading-relaxed text-[#5d7a67]">
                    {RAG_FORMATOS_RESUMO}. Prefira ficheiros com texto legível (.md, .docx, .txt). PDF digitalizado pode
                    falhar na indexação.
                  </p>
                </div>
                <div className="rounded-xl border border-[#dcebd8] bg-[#f8fcf6] p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#0b2210]">
                    <Upload size={15} className="text-[#3f9848]" />
                    Limites
                  </div>
                  <p className="text-sm leading-relaxed text-[#5d7a67]">
                    Até <strong>{MAX_DOCUMENTOS_CONHECIMENTO_POR_TENANT}</strong> documentos por empresa,{" "}
                    <strong>5 MB</strong> cada. O conteúdo alimenta a sugestão de cargos e, em breve, o playbook dos
                    agentes.
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs text-[#89a095]">
                Após o envio, o sistema extrai texto, gera embeddings Mistral, cria um resumo por documento e consolida
                uma análise IA do negócio na aba «Análise IA».
              </p>
            </div>
          )}
        </div>
      </div>

      <CrmConhecimentoGerirSideover
        open={gerirOpen}
        onClose={() => setGerirOpen(false)}
        documentos={documentos}
        uploading={uploading}
        busy={sideoverBusy}
        noLimite={noLimite}
        aviso={aviso}
        onUpload={onUpload}
        onVerDetalhe={(d) => {
          setSideover(d);
        }}
        onReprocessar={reprocessar}
        onExcluir={excluir}
        documentosProntos={indexados.length}
        analiseGenerating={analiseGenerating}
        onAnalisarNegocio={() => {
          void gerarAnalise({ mudarTab: true });
          setGerirOpen(false);
        }}
      />

      <CrmConhecimentoSideover
        documento={sideover}
        onClose={() => setSideover(null)}
        onReprocessar={reprocessar}
        onExcluir={excluir}
        busy={sideoverBusy}
        onDocumentoAtualizado={(doc) => {
          setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ...doc } : d)));
          setSideover((s) => (s?.id === doc.id ? { ...s, ...doc } : s));
        }}
      />
    </div>
  );
}
