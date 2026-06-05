"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { NegocioFormDrawer } from "@/components/crm/NegocioFormDrawer";
import { PipelineConfigSideover } from "@/components/crm/leads/PipelineConfigSideover";
import { PipelineTabsBar } from "@/components/crm/pipelines/PipelineTabsBar";
import { NegocioKanbanCard } from "@/components/crm/negocios/NegocioKanbanCard";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";
import { ESTAGIOS_FALLBACK_UI } from "@/lib/crm/pipeline-defaults";

const LIMIT = 20;

type Negocio = {
  id: string;
  codigo: string;
  titulo: string;
  prefixo_mercado: string;
  pipeline_id?: string | null;
  status: string;
  etapa: string;
  valor_estimado: number | null;
  valor_fechado: number | null;
  data_previsao_fechamento: string | null;
  criado_em: string | null;
};

type PipelineUi = {
  id: string;
  slug: string;
  nome: string;
  mercado_sigla: string | null;
  estagios: { slug: string; label: string; cor: string; ativo: boolean; ordem?: number }[];
};

type EtapaUi = { id: string; label: string; color: string };

const ETAPA_COR: Record<string, string> = {
  novo: "#6b7280",
  qualificando: "#3b82f6",
  qualificado: "#06b6d4",
  proposta: "#eab308",
  negociando: "#f97316",
  fechamento: "#a855f7",
  ganho: "#22c55e",
  perdido: "#ef4444",
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  aberto: { label: "Aberto", color: "#3b82f6", bg: "#3b82f622" },
  em_negociacao: { label: "Em negociação", color: "#f59e0b", bg: "#f59e0b22" },
  fechado_ganho: { label: "Ganho", color: "#22c55e", bg: "#22c55e22" },
  fechado_perdido: { label: "Perdido", color: "#ef4444", bg: "#ef444422" },
  cancelado: { label: "Cancelado", color: "#5d7a67", bg: "#5d7a6722" },
};

const ETAPAS_FALLBACK: EtapaUi[] = ESTAGIOS_FALLBACK_UI.map((e) => ({
  id: e.id,
  label: e.label,
  color: e.color,
}));

function moeda(v: number | null) {
  if (v == null || v <= 0) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(v);
}

function tempo(iso: string | null) {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function formatData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function totalAberto(negocios: Negocio[]) {
  return negocios
    .filter((n) => !["ganho", "perdido"].includes(n.etapa))
    .reduce((s, n) => s + (n.valor_fechado ?? n.valor_estimado ?? 0), 0);
}

export default function NegociosPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSlot } = useCrmHeaderSlot();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;

  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState("");
  const [etapa, setEtapa] = useState("");
  const [offset, setOffset] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [pipelineConfigOpen, setPipelineConfigOpen] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineUi[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [etapasKanban, setEtapasKanban] = useState<EtapaUi[]>(ETAPAS_FALLBACK);

  const carregarPipelines = useCallback(async () => {
    const res = await fetch("/api/crm/pipelines?tipo=negocio", {
      headers: internalApiHeaders(),
    });
    const json = await res.json().catch(() => ({ data: [] }));
    const list = (json.data || []) as PipelineUi[];
    if (!list.length) return;
    const porMercado = list.filter((p) => p.mercado_sigla);
    const visiveis = porMercado.length ? porMercado : list.filter((p) => !p.mercado_sigla);
    setPipelines(visiveis);
    setPipelineId((prev) =>
      prev && visiveis.some((p) => p.id === prev)
        ? prev
        : (visiveis.find((p) => p.slug === "negocios-imb")?.id ||
            visiveis.find((p) => p.slug === "negocios-global")?.id ||
            visiveis[0]?.id ||
            null)
    );
  }, []);

  const pipelineAtivo = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId]
  );

  useEffect(() => {
    void carregarPipelines();
  }, [carregarPipelines]);

  useEffect(() => {
    const cols =
      pipelineAtivo?.estagios
        ?.filter((e) => e.ativo !== false)
        .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
        .map((e) => ({ id: e.slug, label: e.label, color: e.cor || "#6B7280" })) ?? [];
    setEtapasKanban(cols.length ? cols : ETAPAS_FALLBACK);
  }, [pipelineAtivo]);

  const carregarLista = useCallback(
    (nextOffset = 0, append = false) => {
      if (append) setCarregandoMais(true);
      else setCarregando(true);

      const p = new URLSearchParams({ offset: String(nextOffset) });
      if (busca) p.set("busca", busca);
      if (etapa) p.set("etapa", etapa);
      if (pipelineAtivo && pipelineAtivo.slug !== "negocios-global") {
        p.set("pipeline_id", pipelineAtivo.id);
      }

      return fetch(`/api/crm/negocios?${p}`, { headers: internalApiHeaders() })
        .then((r) => r.json())
        .then((d) => {
          const rows = (d.data ?? []) as Negocio[];
          setNegocios((prev) => (append ? [...prev, ...rows] : rows));
          setTotal(d.total ?? 0);
          setOffset(nextOffset + LIMIT);
        })
        .catch(() => {})
        .finally(() => {
          setCarregando(false);
          setCarregandoMais(false);
        });
    },
    [busca, etapa, pipelineAtivo]
  );

  useEffect(() => {
    const et = searchParams.get("etapa");
    const v = searchParams.get("view");
    if (et) setEtapa(et);
    if (v === "kanban" || v === "lista") setView(v);
    else if (isMobile) setView("lista");
  }, [searchParams, isMobile]);

  useEffect(() => {
    void carregarLista(0, false);
  }, [carregarLista]);

  async function moverEtapa(negocioId: string, novaEtapa: string) {
    const res = await fetch(`/api/crm/negocios/${negocioId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ etapa: novaEtapa }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof json?.error === "string" ? json.error : "Não foi possível mover o negócio.");
      return;
    }
    setNegocios((prev) =>
      prev.map((n) => (n.id === negocioId ? { ...n, etapa: novaEtapa } : n))
    );
  }

  const qualificadosCount = negocios.filter((n) => n.etapa === "qualificado").length;
  const negociandoCount = negocios.filter((n) => n.etapa === "negociando").length;
  const pipelineTotal = totalAberto(negocios);
  const temMais = negocios.length < total;
  const hoje = new Date().toDateString();
  const negociosHoje = negocios.filter((n) =>
    n.criado_em ? new Date(n.criado_em).toDateString() === hoje : false
  ).length;

  const botaoNovoNegocio = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setDrawerAberto(true)}
        className="min-h-11 shrink-0 rounded-lg px-4 py-2 text-sm font-bold min-[480px]:min-h-10"
        style={{ background: "#003b26", color: "#c9a24a", border: "none", cursor: "pointer" }}
      >
        + Novo negócio
      </button>
    ),
    []
  );

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({
      path: pathname,
      subtitle: `${pipelineAtivo?.nome || "Negócios"} · ${total} negócios`,
      actions: (
        <>
          {botaoNovoNegocio}
          <div className="inline-flex w-full rounded-lg bg-[#eef7eb] p-0.5 min-[480px]:w-auto">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`min-h-11 flex-1 rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${
                view === "kanban" ? "bg-[#dcebd8] text-white" : "text-[#5d7a67] hover:text-[#0b2210]"
              }`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("lista")}
              className={`min-h-11 flex-1 rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${
                view === "lista" ? "bg-[#dcebd8] text-white" : "text-[#5d7a67] hover:text-[#0b2210]"
              }`}
            >
              Lista
            </button>
          </div>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título ou código..."
            className="w-full min-h-11 min-w-0 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 py-2 text-sm text-[#0b2210] outline-none placeholder:text-[#6e7681] focus:border-[#c9a24a] min-[480px]:min-h-10 min-[480px]:w-52"
          />
          <select
            value={etapa}
            onChange={(e) => setEtapa(e.target.value)}
            className="w-full min-h-11 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 py-2 text-sm text-[#0b2210] outline-none min-[480px]:min-h-10 min-[480px]:w-[11.5rem]"
          >
            <option value="">Todas as etapas</option>
            {etapasKanban.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPipelineConfigOpen(true)}
            className="min-h-11 shrink-0 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 py-2 text-xs font-bold text-[#5d7a67] hover:text-[#0b2210] min-[480px]:min-h-10"
          >
            Pipeline
          </button>
        </>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, total, pipelineAtivo, view, busca, etapa, etapasKanban, isMobile, botaoNovoNegocio]);

  const headerControls = (
    <>
      {botaoNovoNegocio}
      <div className="inline-flex w-full rounded-lg bg-[#eef7eb] p-0.5 min-[480px]:w-auto">
        <button
          type="button"
          onClick={() => setView("kanban")}
          className={`min-h-11 flex-1 rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${
            view === "kanban" ? "bg-[#dcebd8] text-white" : "text-[#5d7a67] hover:text-[#0b2210]"
          }`}
        >
          Kanban
        </button>
        <button
          type="button"
          onClick={() => setView("lista")}
          className={`min-h-11 flex-1 rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${
            view === "lista" ? "bg-[#dcebd8] text-white" : "text-[#5d7a67] hover:text-[#0b2210]"
          }`}
        >
          Lista
        </button>
      </div>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por título ou código..."
        className="w-full min-h-11 min-w-0 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 py-2 text-sm text-[#0b2210] outline-none placeholder:text-[#6e7681] focus:border-[#c9a24a] min-[480px]:min-h-10 min-[480px]:w-52"
      />
      <select
        value={etapa}
        onChange={(e) => setEtapa(e.target.value)}
        className="w-full min-h-11 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 py-2 text-sm text-[#0b2210] outline-none min-[480px]:min-h-10 min-[480px]:w-[11.5rem]"
      >
        <option value="">Todas as etapas</option>
        {etapasKanban.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setPipelineConfigOpen(true)}
        className="min-h-11 shrink-0 rounded-lg border border-[#dcebd8] bg-[#eef7eb] px-3 py-2 text-xs font-bold text-[#5d7a67] hover:text-[#0b2210] min-[480px]:min-h-10"
      >
        Pipeline
      </button>
    </>
  );

  const pipelineTabs =
    pipelines.length > 0 ? (
      <PipelineTabsBar pipelines={pipelines} activePipelineId={pipelineId} onSelect={setPipelineId} />
    ) : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fcf6]">
      <NegocioFormDrawer
        open={drawerAberto}
        onClose={() => setDrawerAberto(false)}
        onSaved={() => {
          void carregarLista(0, false);
        }}
        pipelineId={pipelineAtivo?.id ?? null}
        defaultMercado={pipelineAtivo?.mercado_sigla ?? null}
      />

      <PipelineConfigSideover
        open={pipelineConfigOpen}
        onClose={() => setPipelineConfigOpen(false)}
        tipo="negocio"
        pipelineId={pipelineId}
        onSelectPipeline={setPipelineId}
        showPipelineAdmin={false}
        onUpdated={() => {
          void carregarPipelines();
          void carregarLista(0, false);
        }}
      />

      {pipelineTabs}

      {isMobile && (
        <div className="sticky top-0 z-20 shrink-0 space-y-2 border-b border-[#dcebd8] bg-[#ffffff] px-3 py-3">
          <div>
            <h1 className="text-base font-bold text-[#0b2210]">Negócios</h1>
            <p className="text-[11px] text-[#5d7a67]">
              {pipelineAtivo?.nome || "Pipeline global"} · {total} negócios
            </p>
          </div>
          <div className="flex flex-col gap-2">{headerControls}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-px bg-[#dcebd8] sm:grid-cols-4">
        {[
          { label: "Negócios Hoje", value: String(negociosHoje), cor: "#F97316" },
          { label: "Qualificados", value: String(qualificadosCount), cor: "#06B6D4" },
          { label: "Negociando", value: String(negociandoCount), cor: "#F59E0B" },
          { label: "Pipeline Total", value: moeda(pipelineTotal), cor: "#22C55E" },
        ].map((m) => (
          <div key={m.label} className="bg-[#ffffff] px-3 py-2.5 sm:px-5">
            <p className="mb-0.5 text-xs text-[#5d7a67]">{m.label}</p>
            <p className="text-base font-black sm:text-lg" style={{ color: m.cor }}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {carregando && negocios.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-[#5d7a67]">
            Carregando negócios...
          </div>
        ) : view === "kanban" ? (
          <div
            className={`flex h-full overflow-x-auto ${
              isMobile ? "snap-x snap-mandatory scroll-pl-3 gap-2.5 px-3 py-3 scrollbar-none" : "gap-3 p-4"
            }`}
          >
            {etapasKanban.map((est) => {
              const col = negocios.filter((n) => n.etapa === est.id);
              const totalCol = col.reduce(
                (s, n) => s + (n.valor_fechado ?? n.valor_estimado ?? 0),
                0
              );
              return (
                <div
                  key={est.id}
                  className={`flex flex-shrink-0 flex-col ${
                    isMobile ? "w-[clamp(11rem,72vw,18rem)] snap-start" : "min-w-[300px] w-[300px]"
                  }`}
                >
                  <div
                    className="rounded-t-xl px-3 py-2.5"
                    style={{
                      backgroundColor: est.color + "1A",
                      borderLeft: `3px solid ${est.color}`,
                      borderTop: `1px solid ${est.color}40`,
                      borderRight: `1px solid ${est.color}40`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{est.label}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                        style={{ backgroundColor: est.color + "40" }}
                      >
                        {col.length}
                      </span>
                    </div>
                    {totalCol > 0 ? (
                      <p className="mt-0.5 text-xs font-bold" style={{ color: est.color }}>
                        {moeda(totalCol)}
                      </p>
                    ) : null}
                  </div>

                  <div
                    className="flex-1 space-y-2 overflow-y-auto rounded-b-xl border border-t-0 border-[#dcebd8] bg-[#ffffff]/60 p-2 transition-colors"
                    style={{
                      minHeight: 80,
                      backgroundColor: dragOver === est.id ? est.color + "12" : undefined,
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(est.id);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("negocioId");
                      if (id) void moverEtapa(id, est.id);
                      setDragId(null);
                      setDragOver(null);
                    }}
                  >
                    {col.map((negocio) => (
                      <NegocioKanbanCard
                        key={negocio.id}
                        negocio={negocio}
                        dragging={dragId === negocio.id}
                        draggable={!isMobile}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("negocioId", negocio.id);
                          setDragId(negocio.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDragOver(null);
                        }}
                        onOpen={() => router.push(`/crm/negocios/${negocio.id}`)}
                        onEdit={() => router.push(`/crm/negocios/${negocio.id}`)}
                      />
                    ))}
                    {col.length === 0 ? (
                      <p className="py-4 text-center text-xs text-[#484f58]">vazio</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            {isMobile ? (
              <ul className="space-y-2 p-3 pb-24">
                {negocios.map((negocio) => {
                  const etapaAtiva = etapasKanban.find((e) => e.id === negocio.etapa);
                  return (
                    <li key={negocio.id}>
                      <button
                        type="button"
                        onClick={() => router.push(`/crm/negocios/${negocio.id}`)}
                        className="flex w-full min-h-14 flex-col gap-2 rounded-xl border border-[#dcebd8] bg-[#ffffff] p-3 text-left"
                        style={{
                          borderLeftWidth: 3,
                          borderLeftColor: ETAPA_COR[negocio.etapa] || "#6b7280",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[#0b2210]">{negocio.titulo}</p>
                            <p className="font-mono text-xs text-[#c9a24a]">{negocio.codigo}</p>
                          </div>
                          {etapaAtiva ? (
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{
                                backgroundColor: etapaAtiva.color + "25",
                                color: etapaAtiva.color,
                              }}
                            >
                              {etapaAtiva.label}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#22C55E]">
                            {moeda(negocio.valor_fechado ?? negocio.valor_estimado)}
                          </span>
                          <span className="ml-auto text-xs text-[#5d7a67]">{tempo(negocio.criado_em)}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
                {negocios.length === 0 ? (
                  <p className="py-12 text-center text-sm text-[#5d7a67]">Nenhum negócio encontrado</p>
                ) : null}
              </ul>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-gray-800 bg-gray-900">
                  <tr>
                    {["Título", "Mercado", "Etapa", "Status", "Valor", "Previsão", "Atualizado", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {negocios.map((negocio) => {
                    const etapaCor = ETAPA_COR[negocio.etapa] ?? "#5d7a67";
                    const statusInfo = STATUS_LABEL[negocio.status] ?? {
                      label: negocio.status,
                      color: "#5d7a67",
                      bg: "#5d7a6722",
                    };
                    return (
                      <tr
                        key={negocio.id}
                        onClick={() => router.push(`/crm/negocios/${negocio.id}`)}
                        className="cursor-pointer border-b border-gray-800/50 transition-colors hover:bg-gray-900/60"
                      >
                        <td className="px-4 py-3">
                          <p className="font-bold text-white">{negocio.titulo}</p>
                          <p className="mt-0.5 font-mono text-xs text-[#c9a24a]">{negocio.codigo}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="rounded-full px-2 py-1 text-xs font-medium"
                            style={{
                              backgroundColor: "#c9a24a25",
                              color: "#c9a24a",
                            }}
                          >
                            {labelMercadoPrefixo(negocio.prefixo_mercado)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="rounded-full px-2 py-1 text-xs font-bold"
                            style={{ backgroundColor: etapaCor + "20", color: etapaCor }}
                          >
                            {negocio.etapa}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="rounded-full px-2 py-1 text-xs font-bold"
                            style={{
                              backgroundColor: statusInfo.bg,
                              color: statusInfo.color,
                            }}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-green-400">
                            {moeda(negocio.valor_fechado ?? negocio.valor_estimado)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatData(negocio.data_previsao_fechamento)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {tempo(negocio.criado_em)}
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-xs text-[#c9a24a] hover:text-[#e0b86a]">Ver →</button>
                        </td>
                      </tr>
                    );
                  })}
                  {negocios.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-600">
                        Nenhum negócio encontrado
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}

            {temMais && view === "lista" ? (
              <div className="px-4 py-5 text-center">
                <button
                  onClick={() => void carregarLista(offset, true)}
                  disabled={carregandoMais}
                  className="rounded-lg border border-[#dcebd8] bg-[#ffffff] px-5 py-2 text-sm font-semibold text-[#5d7a67]"
                >
                  {carregandoMais ? "Carregando..." : `Carregar mais (${total - negocios.length} restantes)`}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
