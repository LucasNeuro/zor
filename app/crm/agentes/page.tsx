"use client";

import { Suspense, useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ChevronRight, Clock, MessageCircle, X, Zap } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { AgenteNovoWizard } from "@/components/crm/AgenteNovoWizard";
import { CrmCargosCatalogDrawer } from "@/components/crm/CrmCargosCatalogDrawer";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { useCrmToast } from "@/lib/crm/crm-feedback";
import { AgenteAvatar } from "@/components/crm/AgenteAvatar";
import { AgenteGridCard } from "@/components/crm/AgenteGridCard";
import { AgenteCiclosOperacaoList } from "@/components/crm/AgenteCiclosOperacaoList";
import { AgenteSideoverEntityCard, AgenteSideoverInfoGrid } from "@/components/crm/AgenteSideoverCards";
import { CRM_ENTITY_GRID } from "@/lib/crm-glass-card";
import { calcularSaudeAgente, SAUDE_CORES } from "@/lib/agente-saude";
import { hubModeloExibicaoProduto } from "@/lib/ia/hub-model-defaults";
import {
  MERCADO_PREFIXO_PADRAO,
} from "@/lib/crm/negocio-cadastro";
import {
  RF_ACCENT,
  RF_BG_DEEP,
  RF_BG_PANEL,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_OVERLAY,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfInputStyle,
  rfLabelStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import {
  invalidateHubAgente,
  invalidateHubAgentes,
  patchHubAgenteDetailCache,
  patchHubAgenteInLists,
  removeHubAgenteFromCaches,
  useHubAgenteDetail,
  useHubAgenteLogs,
  useHubAgenteOperacao,
  useHubAgentesList,
  type HubAgenteLogRow,
  type HubAgenteRow,
} from "@/hooks/useHubAgentesQueries";
import type { HubAgentesListMode } from "@/lib/hub/hub-query-keys";

const SEGMENTO_COR: Record<string, string> = {
  Marketing: "#3b82f6",
  Comercial: "#10b981",
  Operações: "#f59e0b",
};

const NIVEL_COR: Record<string, string> = {
  N1: "#fb7185",
  N2: "#a855f7",
  N3: "#2dd4bf",
  N4: "#fbbf24",
};

type Agente = HubAgenteRow;
type AgenteLog = HubAgenteLogRow;
type ListMode = HubAgentesListMode;

/** Resumo legível para cards (bio/playbook em Markdown). */
function markdownPlainPreview(raw: string, maxLen: number): string {
  let t = raw.trim();
  if (!t) return "";
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
  t = t.replace(/\*([^*]+)\*/g, "$1").replace(/_([^_]+)_/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

function resumoCardAgente(agente: Agente): string {
  const bio =
    typeof agente.bio === "string" && agente.bio.trim()
      ? markdownPlainPreview(agente.bio, 220)
      : "";
  if (bio) return bio;
  const prompt =
    typeof agente.system_prompt_base === "string" && agente.system_prompt_base.trim()
      ? markdownPlainPreview(agente.system_prompt_base, 220)
      : "";
  if (prompt) return prompt;
  return "Sem resumo configurado.";
}

function formatarData(v?: string) {
  if (!v) return "Sem data";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function tempoOpRelativo(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const diff = (Date.now() - d) / 60000;
  if (diff < 1) return "agora";
  if (diff < 60) return `${Math.round(diff)}min`;
  if (diff < 1440) return `${Math.round(diff / 60)}h`;
  return `${Math.round(diff / 1440)}d`;
}

function SideoverFold({
  title,
  open,
  onToggle,
  children,
  headerRight,
  isFirst = false,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  headerRight?: ReactNode;
  isFirst?: boolean;
}) {
  return (
    <div
      style={{
        borderTop: isFirst ? "none" : `1px solid ${RF_BORDER_STRONG}`,
        marginTop: isFirst ? 0 : 6,
        paddingTop: isFirst ? 0 : 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: "1 1 auto",
            minWidth: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: "6px 0",
            color: RF_TEXT_SECONDARY,
            fontSize: 12,
            fontWeight: 700,
            textAlign: "left",
          }}
        >
          <ChevronRight
            size={16}
            strokeWidth={2}
            aria-hidden
            style={{
              flexShrink: 0,
              color: RF_ACCENT,
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
          <span>{title}</span>
        </button>
        {headerRight ? <div style={{ flexShrink: 0 }}>{headerRight}</div> : null}
      </div>
      {open ? <div style={{ marginTop: 8 }}>{children}</div> : null}
    </div>
  );
}

function accentAgente(segmento?: string | null): string {
  return SEGMENTO_COR[segmento || ""] || "#c9a24a";
}

function progressoSaudeRing(saude: "ok" | "degradado" | "parado" | null): number {
  if (saude === "ok") return 0.85;
  if (saude === "degradado") return 0.45;
  return 0.15;
}

function matchesModo(agente: Pick<Agente, "ativo" | "arquivado_em">, modo: ListMode): boolean {
  if (modo === "todos") return true;
  if (modo === "ativos") return agente.ativo !== false && !agente.arquivado_em;
  if (modo === "inativos") return agente.ativo === false && !agente.arquivado_em;
  return !!agente.arquivado_em;
}

function AgentesView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openedFromQuery = useRef(false);
  const queryClient = useQueryClient();
  const { setSlot } = useCrmHeaderSlot();
  const { success: toastSuccess, error: toastError } = useCrmToast();

  const [modoLista, setModoLista] = useState<ListMode>("todos");
  const [buscaLista, setBuscaLista] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const {
    data: agentes = [],
    isLoading: carregando,
    error: listaQueryError,
  } = useHubAgentesList(modoLista);
  const erroLista = listaQueryError?.message ?? null;
  const [drawerNovoOpen, setDrawerNovoOpen] = useState(false);
  const [drawerCargosOpen, setDrawerCargosOpen] = useState(false);
  const [alternandoAtivoSlug, setAlternandoAtivoSlug] = useState<string | null>(null);
  const [excluindoAgenteSlug, setExcluindoAgenteSlug] = useState<string | null>(null);
  const [dialogExcluirAgente, setDialogExcluirAgente] = useState<Agente | null>(null);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [salvandoDetalhe, setSalvandoDetalhe] = useState(false);
  const [detailErroLocal, setDetailErroLocal] = useState<string | null>(null);

  const {
    data: detailAgente = null,
    isLoading: detailLoading,
    error: detailQueryError,
  } = useHubAgenteDetail(selectedSlug);
  const detailErro = detailErroLocal ?? detailQueryError?.message ?? null;

  const {
    data: logs = [],
    isLoading: logsLoading,
    error: logsQueryError,
  } = useHubAgenteLogs(selectedSlug);
  const logsErro = logsQueryError?.message ?? null;

  const {
    data: operacao = null,
    isLoading: operacaoLoading,
    isFetching: operacaoAtualizando,
    error: operacaoQueryError,
  } = useHubAgenteOperacao(selectedSlug);
  const operacaoErro = operacaoQueryError?.message ?? null;

  const [editNome, setEditNome] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editTom, setEditTom] = useState("");
  const [editEstilo, setEditEstilo] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editAtivo, setEditAtivo] = useState(true);
  /** Secções colapsáveis no painel lateral (modelo). */
  const [drawerSecCiclosAberto, setDrawerSecCiclosAberto] = useState(true);
  const [drawerSecAtividadeAberto, setDrawerSecAtividadeAberto] = useState(true);
  const [drawerSecIdentidadeAberto, setDrawerSecIdentidadeAberto] = useState(true);
  const [drawerSecConversasAberto, setDrawerSecConversasAberto] = useState(true);

  const detalheAberto = !!selectedSlug;

  useEffect(() => {
    if (!selectedSlug) return;
    setDrawerSecCiclosAberto(true);
    setDrawerSecAtividadeAberto(true);
    setDrawerSecIdentidadeAberto(true);
    setDrawerSecConversasAberto(true);
  }, [selectedSlug]);

  const saudeAgente = useMemo(() => {
    if (!detailAgente || !operacao) return null;
    const ciclos = operacao.ciclos;
    const ativos = ciclos.filter((c) => (c as { ativo?: boolean }).ativo !== false).length;
    const logs = (operacao.execucoes_ciclo || []).map((l) => ({
      status: (l as { status?: string }).status,
      iniciado_em: (l as { iniciado_em?: string }).iniciado_em,
    }));
    return calcularSaudeAgente({
      ativoOperacional: detailAgente.ativo !== false,
      arquivado: !!detailAgente.arquivado_em,
      ciclosAtivosCount: ativos,
      logsCiclo: logs,
      ultimoPromptEm: operacao.ultimo_prompt_em,
    });
  }, [detailAgente, operacao]);

  type AtividadeRecenteItem = {
    id: string;
    kind: "acao" | "ciclo";
    titulo: string;
    detalhe: string;
    quando: string | null;
    accent: string;
    Icon: typeof Zap;
  };

  const atividadeRecente = useMemo((): AtividadeRecenteItem[] => {
    if (!operacao) return [];
    const items: AtividadeRecenteItem[] = [];
    for (let i = 0; i < operacao.acoes.length; i++) {
      const row = operacao.acoes[i] as {
        id?: string;
        tipo?: string;
        descricao?: string;
        sucesso?: boolean;
        criado_em?: string;
      };
      const ok = row.sucesso !== false;
      items.push({
        id: `acao-${row.id ?? i}`,
        kind: "acao",
        titulo: String(row.tipo || "Ação da IA"),
        detalhe: String(row.descricao || "").trim() || "Evento registado pelo motor.",
        quando: row.criado_em ?? null,
        accent: ok ? "#22c55e" : "#f87171",
        Icon: Zap,
      });
    }
    for (let i = 0; i < operacao.execucoes_ciclo.length; i++) {
      const row = operacao.execucoes_ciclo[i] as {
        id?: string;
        status?: string;
        erro?: string;
        iniciado_em?: string;
      };
      const st = String(row.status || "—");
      const stCor =
        st === "erro" ? "#f87171" : st === "sucesso" ? "#86efac" : st === "sem_acao" ? "#6b8a76" : "#c9a24a";
      items.push({
        id: `ciclo-${row.id ?? i}`,
        kind: "ciclo",
        titulo: `Tarefa automática · ${st}`,
        detalhe: row.erro
          ? String(row.erro).slice(0, 180)
          : "Corrida de ciclo ligada a este modelo.",
        quando: row.iniciado_em ?? null,
        accent: stCor,
        Icon: Clock,
      });
    }
    return items
      .sort((a, b) => {
        const ta = a.quando ? new Date(a.quando).getTime() : 0;
        const tb = b.quando ? new Date(b.quando).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 12);
  }, [operacao]);

  useEffect(() => {
    if (!detailAgente) return;
    setEditNome(String(detailAgente.nome || ""));
    setEditBio(String(detailAgente.bio || ""));
    setEditTom(String(detailAgente.tom_voz || ""));
    setEditEstilo(String(detailAgente.estilo_comunicacao || ""));
    setEditPrompt(String(detailAgente.system_prompt_base || ""));
    setEditAtivo(detailAgente.ativo !== false);
    setDetailErroLocal(null);
  }, [detailAgente]);

  useEffect(() => {
    if (!selectedSlug) setDetailErroLocal(null);
  }, [selectedSlug]);

  useEffect(() => {
    const abrir = searchParams.get("abrir")?.trim();
    if (!abrir) return;
    setSelectedSlug(abrir);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("abrir");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  useEffect(() => {
    if (openedFromQuery.current) return;
    if (searchParams.get("novo") === "1") {
      openedFromQuery.current = true;
      setDrawerNovoOpen(true);
      router.replace("/crm/agentes", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (detalheAberto) setSelectedSlug(null);
      else if (drawerCargosOpen) setDrawerCargosOpen(false);
      else if (drawerNovoOpen) setDrawerNovoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detalheAberto, drawerCargosOpen, drawerNovoOpen]);

  useEffect(() => {
    if (!selectedSlug) return;
    router.prefetch(`/crm/agentes/${selectedSlug}`);
  }, [selectedSlug, router]);

  const counters = {
    todos: agentes.length,
    ativos: agentes.filter((a) => matchesModo(a, "ativos")).length,
    inativos: agentes.filter((a) => matchesModo(a, "inativos")).length,
    arquivados: agentes.filter((a) => matchesModo(a, "arquivados")).length,
  };

  const segmentosNaLista = useMemo(() => {
    const s = new Set<string>();
    for (const a of agentes) {
      const v = String(a.segmento || a.area || "").trim();
      if (v) s.add(v);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [agentes]);

  const agentesFiltrados = useMemo(() => {
    let list = agentes;
    if (filtroSegmento) {
      list = list.filter((a) => String(a.segmento || a.area || "").trim() === filtroSegmento);
    }
    const q = buscaLista.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const nome = String(a.nome || "").toLowerCase();
        const slug = String(a.agente_slug || "").toLowerCase();
        const bio = String(a.bio || "").toLowerCase();
        const cargo = String(a.cargo || "").toLowerCase();
        return nome.includes(q) || slug.includes(q) || bio.includes(q) || cargo.includes(q);
      });
    }
    return list;
  }, [agentes, filtroSegmento, buscaLista]);

  useEffect(() => {
    if (filtroSegmento && !segmentosNaLista.includes(filtroSegmento)) {
      setFiltroSegmento("");
    }
  }, [filtroSegmento, segmentosNaLista]);

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <>
          <button
            type="button"
            onClick={() => setDrawerCargosOpen(true)}
            style={{
              background: "#ffffff",
              color: "#0b1f10",
              border: "1px solid #d4ecd0",
              borderRadius: 10,
              padding: "12px 18px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Gerenciar cargos
          </button>
          <button
            type="button"
            onClick={() => setDrawerNovoOpen(true)}
            style={{
              background: "#0b1f10",
              color: "#92ff00",
              border: "none",
              borderRadius: 10,
              padding: "12px 22px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Novo agente
          </button>
        </>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot]);

  async function alternarAtivo(agente: Agente, e: React.MouseEvent) {
    e.stopPropagation();
    if (agente.arquivado_em) return;
    const proximo = agente.ativo === false;
    setAlternandoAtivoSlug(agente.agente_slug);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agente.agente_slug)}`, {
        method: "PATCH",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: proximo }),
      });
      if (!res.ok) return;

      patchHubAgenteInLists(queryClient, agente.agente_slug, (row) => {
        const next = { ...row, ativo: proximo };
        if ((modoLista === "ativos" && !proximo) || (modoLista === "inativos" && proximo)) return null;
        return next;
      });
      if (detailAgente?.agente_slug === agente.agente_slug) {
        setEditAtivo(proximo);
        patchHubAgenteDetailCache(queryClient, agente.agente_slug, {
          ...detailAgente,
          ativo: proximo,
        });
      }
      void invalidateHubAgente(queryClient, agente.agente_slug);
    } finally {
      setAlternandoAtivoSlug(null);
    }
  }

  function pedirExcluirAgente(agente: Agente, e: React.MouseEvent) {
    e.stopPropagation();
    setDialogExcluirAgente(agente);
  }

  async function confirmarExcluirAgente() {
    const agente = dialogExcluirAgente;
    if (!agente) return;
    setExcluindoAgenteSlug(agente.agente_slug);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agente.agente_slug)}`, {
        method: "DELETE",
        headers: internalApiHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : `Erro ${res.status} ao excluir.`;
        toastError(
          msg.includes("hub_delete_agente_cascade") || msg.includes("Exclusão em cascata")
            ? `${msg} (SQL Editor → supabase/migrations/20260618150000_hub_delete_agente_cascade_v2.sql)`
            : msg,
          "Falha ao excluir agente"
        );
        return;
      }
      setDialogExcluirAgente(null);
      toastSuccess(`Agente «${agente.nome}» excluído.`);
      removeHubAgenteFromCaches(queryClient, agente.agente_slug);
      if (selectedSlug === agente.agente_slug) {
        setSelectedSlug(null);
        setDetailErroLocal(null);
      }
    } finally {
      setExcluindoAgenteSlug(null);
    }
  }

  async function salvarDetalhes() {
    if (!selectedSlug || !detailAgente) return;
    setSalvandoDetalhe(true);
    setDetailErroLocal(null);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(selectedSlug)}`, {
        method: "PATCH",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: editNome.trim(),
          prefixo_mercado: MERCADO_PREFIXO_PADRAO,
          bio: editBio,
          tom_voz: editTom,
          estilo_comunicacao: editEstilo,
          system_prompt_base: editPrompt,
          ativo: editAtivo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDetailErroLocal(typeof data?.error === "string" ? data.error : "Falha ao salvar.");
        return;
      }
      const saved = data as HubAgenteRow;
      patchHubAgenteDetailCache(queryClient, selectedSlug, saved);
      patchHubAgenteInLists(queryClient, selectedSlug, (row) => {
        const next = {
          ...row,
          ...saved,
          nome: editNome.trim() || row.nome,
                  ativo: editAtivo,
        };
        return matchesModo(next, modoLista) ? next : null;
      });
      void invalidateHubAgente(queryClient, selectedSlug);
    } finally {
      setSalvandoDetalhe(false);
    }
  }

  return (
    <>
      <div style={{ minHeight: "100vh", background: "#f8fcf6", padding: "24px" }}>
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#5d7a67", margin: "0 0 10px", letterSpacing: 0.5 }}>
            LISTA
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {(
              [
                { id: "todos" as const, label: "Todos" },
                { id: "ativos" as const, label: "Ativos" },
                { id: "inativos" as const, label: "Inativos" },
                { id: "arquivados" as const, label: "Arquivados" },
              ] as const
            ).map((opt) => {
              const sel = modoLista === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setModoLista(opt.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: `1px solid ${sel ? "rgba(146,255,0,0.55)" : "#d4ecd0"}`,
                    background: sel ? "#ecffd8" : "#ffffff",
                    color: sel ? "#0b1f10" : "#5d7a67",
                  }}
                >
                  {opt.label} ({counters[opt.id]})
                </button>
              );
            })}
            {segmentosNaLista.length > 0 && (
              <select
                aria-label="Filtrar por segmento ou área"
                value={filtroSegmento}
                onChange={(e) => setFiltroSegmento(e.target.value)}
                style={{
                  marginLeft: 8,
                  minWidth: 200,
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "#ffffff",
                  border: "1px solid #d4ecd0",
                  color: "#0b2210",
                }}
              >
                <option value="">Todos os segmentos</option>
                {segmentosNaLista.map((seg) => (
                  <option key={seg} value={seg}>
                    {seg}
                  </option>
                ))}
              </select>
            )}
            <input
              type="search"
              value={buscaLista}
              onChange={(e) => setBuscaLista(e.target.value)}
              placeholder="Buscar nome, slug, cargo ou bio…"
              style={{
                marginLeft: 8,
                minWidth: 220,
                padding: "8px 12px",
                borderRadius: 999,
                fontSize: 12,
                background: "#ffffff",
                border: "1px solid #d4ecd0",
                color: "#0b2210",
              }}
            />
            {!carregando && !erroLista && agentes.length > 0 && (
              <span style={{ fontSize: 12, color: "#6b8a76", marginLeft: 6 }}>
                mostrando: {agentesFiltrados.length} agente{agentesFiltrados.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        {erroLista && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 10,
              background: "#fff2f1",
              border: "1px solid #f0c0bd",
              color: "#c0392b",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            {erroLista}
          </div>
        )}

        {carregando ? (
          <p style={{ color: "#5d7a67", fontSize: 13 }}>Carregando...</p>
        ) : agentes.length === 0 && !erroLista ? (
          <p style={{ color: "#5d7a67", fontSize: 13 }}>Nenhum agente encontrado.</p>
        ) : agentesFiltrados.length === 0 ? (
          <p style={{ color: "#5d7a67", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
            Nenhum agente corresponde à busca ou ao filtro
          </p>
        ) : (
          <div style={CRM_ENTITY_GRID}>
            {agentesFiltrados.map((agente) => {
              const segCor = SEGMENTO_COR[String(agente.segmento || agente.area || "")] || "#3b82f6";
              const nivelCor = NIVEL_COR[String(agente.nivel || "")] || "#7d8a9a";
              const selecionado = selectedSlug === agente.agente_slug;
              const bio = resumoCardAgente(agente);

              return (
                <AgenteGridCard
                  key={agente.agente_slug}
                  agente={agente}
                  bio={bio}
                  selecionado={selecionado}
                  segCor={segCor}
                  nivelCor={nivelCor}
                  alternandoAtivo={alternandoAtivoSlug === agente.agente_slug}
                  excluindo={excluindoAgenteSlug === agente.agente_slug}
                  onSelect={() => setSelectedSlug(agente.agente_slug)}
                  onToggleAtivo={(e) => alternarAtivo(agente, e)}
                  onDelete={(e) => pedirExcluirAgente(agente, e)}
                />
              );
            })}
          </div>
        )}
      </div>

      {drawerNovoOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar painel"
            onClick={() => setDrawerNovoOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: RF_OVERLAY, border: "none", cursor: "pointer", padding: 0 }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(620px, 100vw)",
              zIndex: 50,
              background: RF_BG_DEEP,
              borderLeft: `1px solid ${RF_BORDER_STRONG}`,
              boxShadow: "-8px 0 32px rgba(0,0,0,0.55)",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <AgenteNovoWizard
              variant="drawer"
              onClose={() => setDrawerNovoOpen(false)}
              onCreated={() => void invalidateHubAgentes(queryClient)}
            />
          </aside>
        </>
      )}

      <CrmCargosCatalogDrawer open={drawerCargosOpen} onClose={() => setDrawerCargosOpen(false)} />

      {detalheAberto && (
        <>
          <button
            type="button"
            aria-label="Fechar detalhes"
            onClick={() => setSelectedSlug(null)}
            style={{ position: "fixed", inset: 0, zIndex: 55, background: "rgba(0,0,0,0.55)", border: "none", padding: 0 }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(640px, 100vw)",
              zIndex: 60,
              background: RF_BG_DEEP,
              borderLeft: `1px solid ${RF_BORDER_STRONG}`,
              boxShadow: "-12px 0 32px rgba(0,0,0,0.55)",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div style={{ borderBottom: `1px solid ${RF_BORDER}`, padding: 16, background: RF_BG_PANEL }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                  <AgenteAvatar
                    seed={detailAgente?.agente_slug || selectedSlug || "agente"}
                    nome={detailAgente?.nome}
                    imageUrl={
                      typeof detailAgente?.avatar_url === "string" ? detailAgente.avatar_url : null
                    }
                    size={56}
                    shape="circle"
                    progress={progressoSaudeRing(saudeAgente)}
                    status={
                      detailAgente?.arquivado_em
                        ? "arquivado"
                        : detailAgente?.ativo === false
                          ? "inativo"
                          : "ativo"
                    }
                    dim={detailAgente?.ativo === false || !!detailAgente?.arquivado_em}
                    alt={detailAgente?.nome}
                  />
                  <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, color: RF_TEXT_MUTED, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>MODELO</p>
                  <h3 style={{ margin: "3px 0 0", color: RF_TEXT_PRIMARY, fontSize: 17 }}>
                    {detailAgente?.nome || selectedSlug}
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
                    {saudeAgente && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: SAUDE_CORES[saudeAgente].bg,
                          color: SAUDE_CORES[saudeAgente].fg,
                        }}
                      >
                        Saúde operacional · {SAUDE_CORES[saudeAgente].label}
                      </span>
                    )}
                    {operacaoAtualizando && operacao && (
                      <span style={{ fontSize: 11, color: RF_TEXT_MUTED }}>Atualizando métricas…</span>
                    )}
                  </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => selectedSlug && router.push(`/crm/agentes/${selectedSlug}`)}
                    style={{ border: `1px solid ${RF_BORDER_STRONG}`, background: "rgba(6, 13, 8, 0.6)", color: RF_ACCENT, borderRadius: 8, padding: "8px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}
                  >
                    Página completa
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSlug(null)}
                    style={{ border: `1px solid ${RF_BORDER_STRONG}`, background: "rgba(6, 13, 8, 0.6)", color: RF_ACCENT, borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    aria-label="Fechar"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {detailLoading ? (
                <p style={{ color: RF_TEXT_MUTED, fontSize: 13 }}>Carregando dados do modelo...</p>
              ) : detailErro ? (
                <div style={{ color: "#c0392b", background: "#fff2f1", border: "1px solid #f0c0bd", borderRadius: 8, padding: 10, fontSize: 13 }}>
                  {detailErro}
                </div>
              ) : !detailAgente ? (
                <p style={{ color: RF_TEXT_MUTED, fontSize: 13 }}>Modelo não encontrado.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {operacaoErro && (
                    <div
                      style={{
                        color: "#92400e",
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 12,
                      }}
                    >
                      Visão operacional: {operacaoErro}
                    </div>
                  )}
                  <div
                    style={{
                      background: RF_BG_PANEL,
                      border: `1px solid ${RF_BORDER_STRONG}`,
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
                        <p style={{ color: RF_ACCENT, fontSize: 11, margin: 0, fontWeight: 700 }}>Visão operacional</p>
                        <p style={{ margin: "8px 0 0", color: RF_TEXT_SECONDARY, fontSize: 11, lineHeight: 1.5 }}>
                          {saudeAgente === "ok" && "Execuções e ações recentes dentro do esperado."}
                          {saudeAgente === "degradado" &&
                            "Alguma coisa está fora do esperado: falhas recentes nas tarefas automáticas, ou há tempo sem corridas quando os ciclos estão ligados. Vale rever em Ciclos IA e no fluxo WhatsApp/agenda."}
                          {saudeAgente === "parado" && "Modelo inativo ou arquivado — não há operação esperada."}
                          {!saudeAgente && "—"}
                        </p>
                        {operacao?.ultimo_prompt_em && (
                          <p style={{ margin: "8px 0 0", color: RF_TEXT_MUTED, fontSize: 11 }}>
                            Última resposta IA registrada: {tempoOpRelativo(operacao.ultimo_prompt_em)} atrás
                          </p>
                        )}
                      </div>
                      <div style={{ padding: "6px 14px 12px" }}>
                        {operacaoLoading && (
                          <p style={{ margin: "0 0 10px", color: RF_TEXT_MUTED, fontSize: 12 }}>A carregar métricas operacionais…</p>
                        )}
                        {operacao && !operacaoLoading && (
                          <>
                        <SideoverFold
                          isFirst
                          title={`Ciclos atribuídos (${operacao.ciclos.length})`}
                          open={drawerSecCiclosAberto}
                          onToggle={() => setDrawerSecCiclosAberto((o) => !o)}
                          headerRight={
                            <button
                              type="button"
                              onClick={() => selectedSlug && router.push(`/crm/ciclos?q=${encodeURIComponent(selectedSlug)}`)}
                              style={{
                                border: `1px solid ${RF_BORDER_STRONG}`,
                                background: "rgba(146, 255, 0, 0.08)",
                                color: RF_ACCENT,
                                borderRadius: 6,
                                padding: "6px 12px",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Ciclos IA
                            </button>
                          }
                        >
                          <AgenteCiclosOperacaoList ciclos={operacao.ciclos} theme="dark" />
                        </SideoverFold>
                        <SideoverFold
                          title={`Atividade recente${atividadeRecente.length > 0 ? ` (${atividadeRecente.length})` : ""}`}
                          open={drawerSecAtividadeAberto}
                          onToggle={() => setDrawerSecAtividadeAberto((o) => !o)}
                        >
                      {atividadeRecente.length === 0 ? (
                        <AgenteSideoverEntityCard
                          accent={RF_ACCENT}
                          progress={null}
                          fallbackProgress={0.2}
                          Icon={Activity}
                          avatarCaption="Sem eventos"
                          footer={
                            <p style={{ margin: 0, color: RF_TEXT_MUTED, fontSize: 10, lineHeight: 1.45 }}>
                              Ações da IA e corridas de ciclos aparecem aqui após WhatsApp, copiloto ou tarefas em{" "}
                              <strong style={{ color: RF_ACCENT }}>Ciclos IA</strong>. Conversas com clientes estão na
                              linha do tempo abaixo.
                            </p>
                          }
                        >
                          <strong style={{ color: RF_TEXT_PRIMARY, fontSize: 13, fontWeight: 800 }}>Nada registado ainda</strong>
                          <p style={{ margin: "6px 0 0", color: RF_TEXT_MUTED, fontSize: 11, lineHeight: 1.45 }}>
                            Normal antes da primeira mensagem no canal ou da primeira execução agendada.
                          </p>
                        </AgenteSideoverEntityCard>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {atividadeRecente.map((ev) => (
                            <AgenteSideoverEntityCard
                              key={ev.id}
                              accent={ev.accent}
                              progress={null}
                              fallbackProgress={0.4}
                              Icon={ev.Icon}
                              avatarCaption={
                                ev.quando
                                  ? tempoOpRelativo(ev.quando) !== "—"
                                    ? `${tempoOpRelativo(ev.quando)} atrás`
                                    : formatarData(ev.quando)
                                  : "—"
                              }
                              footer={
                                <span style={{ fontSize: 10, color: RF_TEXT_MUTED, fontWeight: 600 }}>
                                  {ev.kind === "ciclo" ? "Ciclo automático" : "Ação interna / ferramenta"}
                                </span>
                              }
                            >
                              <strong style={{ color: RF_TEXT_PRIMARY, fontSize: 12, fontWeight: 800 }}>{ev.titulo}</strong>
                              <p style={{ margin: "6px 0 0", color: RF_TEXT_SECONDARY, fontSize: 11, lineHeight: 1.45 }}>
                                {ev.detalhe.length > 200 ? `${ev.detalhe.slice(0, 200)}…` : ev.detalhe}
                              </p>
                            </AgenteSideoverEntityCard>
                          ))}
                        </div>
                      )}
                        </SideoverFold>
                          </>
                        )}

                        <SideoverFold
                          isFirst={!operacao || operacaoLoading}
                          title="Identidade fixa do modelo"
                          open={drawerSecIdentidadeAberto}
                          onToggle={() => setDrawerSecIdentidadeAberto((o) => !o)}
                        >
                    {(() => {
                      const estadoLabel = detailAgente.arquivado_em
                        ? "Arquivado"
                        : detailAgente.ativo === false
                          ? "Inativo"
                          : "Ativo";
                      return (
                        <AgenteSideoverEntityCard
                          accent={accentAgente(detailAgente.segmento)}
                          avatarSeed={detailAgente.agente_slug}
                          avatarNome={detailAgente.nome}
                          imageUrl={detailAgente.avatar_url}
                          progress={progressoSaudeRing(saudeAgente)}
                          avatarCaption={estadoLabel}
                          dim={detailAgente.ativo === false || !!detailAgente.arquivado_em}
                          footer={
                            <p style={{ margin: 0, color: RF_TEXT_MUTED, fontSize: 10, lineHeight: 1.45 }}>
                              Campos do cargo e da configuração inicial — alteram na página completa do modelo ou no assistente de criação.
                            </p>
                          }
                        >
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <strong style={{ color: RF_TEXT_PRIMARY, fontSize: 14, fontWeight: 800 }}>{detailAgente.nome}</strong>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 999,
                                border: `1px solid ${detailAgente.ativo !== false && !detailAgente.arquivado_em ? "#22c55e55" : "#6b8a7655"}`,
                                color: detailAgente.ativo !== false && !detailAgente.arquivado_em ? "#86efac" : "#6b8a76",
                                background: detailAgente.ativo !== false && !detailAgente.arquivado_em ? "#22c55e14" : "#6b8a7614",
                              }}
                            >
                              {estadoLabel}
                            </span>
                          </div>
                          <AgenteSideoverInfoGrid
                            rows={[
                              { label: "Slug", value: detailAgente.agente_slug },
                              { label: "Cargo", value: detailAgente.cargo || "—" },
                              { label: "Área", value: detailAgente.area || "—" },
                              { label: "Nível", value: detailAgente.nivel != null ? String(detailAgente.nivel) : "—" },
                              {
                                label: "Modelo",
                                value:
                                  typeof detailAgente.modelo_efetivo === "string" && detailAgente.modelo_efetivo.trim()
                                    ? detailAgente.modelo_efetivo
                                    : hubModeloExibicaoProduto(detailAgente.modelo_padrao),
                              },
                            ]}
                          />
                        </AgenteSideoverEntityCard>
                      );
                    })()}
                        </SideoverFold>

                        <SideoverFold
                          title={`Linha do tempo de conversas${logs.length > 0 ? ` (${logs.length})` : ""}`}
                          open={drawerSecConversasAberto}
                          onToggle={() => setDrawerSecConversasAberto((o) => !o)}
                        >
                    {logsErro && (
                      <div style={{ color: "#c0392b", background: "#fff2f1", border: "1px solid #f0c0bd", borderRadius: 8, padding: 10, fontSize: 12, marginBottom: 10 }}>
                        {logsErro}
                      </div>
                    )}
                    {logsLoading ? (
                      <p style={{ margin: 0, color: RF_TEXT_MUTED, fontSize: 12 }}>A carregar interações…</p>
                    ) : logs.length === 0 ? (
                      <p style={{ margin: 0, color: RF_TEXT_MUTED, fontSize: 12, lineHeight: 1.5 }}>
                        Quando o modelo responder no WhatsApp, no copiloto ou em tarefas internas, cada troca aparece aqui como linha do tempo — não é histórico técnico de prompts.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {logs.map((log, idx) => {
                          const userMsg = String(log.mensagem_usuario || "").trim();
                          const aiMsg = String(log.resposta_ia || "").trim();
                          const preview = userMsg || aiMsg || "Interação sem texto registado.";
                          return (
                            <AgenteSideoverEntityCard
                              key={String(log.id || idx)}
                              accent="#3b82f6"
                              progress={null}
                              fallbackProgress={0.5}
                              Icon={MessageCircle}
                              avatarCaption={formatarData(String(log.criado_em || ""))}
                              footer={
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 10, color: RF_TEXT_MUTED }}>
                                  {log.tempo_resposta_ms != null && <span>{String(log.tempo_resposta_ms)} ms</span>}
                                  {log.tokens_input != null && <span>in {String(log.tokens_input)} tok</span>}
                                  {log.tokens_output != null && <span>out {String(log.tokens_output)} tok</span>}
                                  {log.custo_estimado_brl != null && <span>R$ {Number(log.custo_estimado_brl).toFixed(4)}</span>}
                                </div>
                              }
                            >
                              <p style={{ margin: "0 0 6px", color: RF_TEXT_MUTED, fontSize: 10, fontWeight: 700 }}>
                                {String(log.modelo_usado || "Conversa")}
                              </p>
                              {userMsg ? (
                                <p style={{ margin: "0 0 6px", color: RF_TEXT_PRIMARY, fontSize: 11, lineHeight: 1.45 }}>
                                  <span style={{ color: RF_ACCENT, fontWeight: 700 }}>Entrada · </span>
                                  {userMsg.length > 180 ? `${userMsg.slice(0, 180)}…` : userMsg}
                                </p>
                              ) : null}
                              {aiMsg ? (
                                <p style={{ margin: 0, color: RF_TEXT_SECONDARY, fontSize: 11, lineHeight: 1.45 }}>
                                  <span style={{ color: RF_ACCENT, fontWeight: 700 }}>Resposta · </span>
                                  {aiMsg.length > 180 ? `${aiMsg.slice(0, 180)}…` : aiMsg}
                                </p>
                              ) : (
                                <p style={{ margin: 0, color: RF_TEXT_MUTED, fontSize: 11 }}>{preview}</p>
                              )}
                            </AgenteSideoverEntityCard>
                          );
                        })}
                      </div>
                    )}
                        </SideoverFold>
                      </div>
                  </div>

                  <p style={{ color: RF_ACCENT, fontSize: 10, fontWeight: 700, margin: "4px 0 0", letterSpacing: 0.3 }}>
                    Dados editáveis neste painel
                  </p>
                  <div>
                    <label style={rfLabelStyle()}>Nome</label>
                    <input value={editNome} onChange={(e) => setEditNome(e.target.value)} style={rfInputStyle()} />
                  </div>

                  <div>
                    <label style={rfLabelStyle()}>Bio</label>
                    <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} style={{ ...rfInputStyle(), resize: "vertical" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={rfLabelStyle()}>Tom</label>
                      <input value={editTom} onChange={(e) => setEditTom(e.target.value)} style={rfInputStyle()} />
                    </div>
                    <div>
                      <label style={rfLabelStyle()}>Estilo</label>
                      <input value={editEstilo} onChange={(e) => setEditEstilo(e.target.value)} style={rfInputStyle()} />
                    </div>
                  </div>

                  <div>
                    <label style={rfLabelStyle()}>
                      Instruções base para a IA
                    </label>
                    <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} rows={7} style={{ ...rfInputStyle(), resize: "vertical", lineHeight: 1.5 }} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(6, 13, 8, 0.85)", border: `1px solid ${RF_BORDER_STRONG}`, borderRadius: 8, padding: "10px 12px" }}>
                    <span style={{ color: RF_TEXT_PRIMARY, fontSize: 12, fontWeight: 700 }}>Status operacional</span>
                    <button
                      type="button"
                      onClick={() => setEditAtivo((v) => !v)}
                      disabled={!!detailAgente.arquivado_em}
                      style={{ border: `1px solid ${editAtivo ? "#22c55e66" : "#ef444466"}`, color: editAtivo ? "#22c55e" : "#ef4444", background: editAtivo ? "#22c55e1a" : "#ef44441a", borderRadius: 999, padding: "5px 10px", fontWeight: 700, fontSize: 11, cursor: detailAgente.arquivado_em ? "not-allowed" : "pointer", opacity: detailAgente.arquivado_em ? 0.5 : 1 }}
                    >
                      {editAtivo ? "Ativo" : "Inativo"}
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={salvarDetalhes}
                      disabled={salvandoDetalhe || !editNome.trim()}
                      style={{ flex: 1, border: "none", background: "#0b1f10", color: "#92ff00", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 700, cursor: salvandoDetalhe ? "wait" : "pointer", opacity: !editNome.trim() ? 0.5 : 1 }}
                    >
                      {salvandoDetalhe ? "Salvando..." : "Salvar alterações"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      <CrmConfirmDialog
        open={dialogExcluirAgente !== null}
        title="Excluir agente em cascata?"
        variant="destructive"
        confirmLabel="Excluir definitivamente"
        cancelLabel="Cancelar"
        loading={excluindoAgenteSlug !== null}
        onCancel={() => !excluindoAgenteSlug && setDialogExcluirAgente(null)}
        onConfirm={() => void confirmarExcluirAgente()}
      >
        <p style={{ margin: "0 0 10px" }}>
          O agente <strong style={{ color: "#0b2210" }}>«{dialogExcluirAgente?.nome}»</strong> (
          <code style={{ color: "#c9a24a" }}>{dialogExcluirAgente?.agente_slug}</code>) será removido com todos os
          dados ligados no Hub: identidade, conhecimento, <strong style={{ color: "#0b2210" }}>ciclos IA</strong>,
          conversas e logs, documentos RAG (embeddings e ficheiros), filas WhatsApp, briefing interno e playbook no
          Storage quando existir.
        </p>
        <p style={{ margin: 0, color: "#b3261e", fontWeight: 600 }}>Esta operação não pode ser desfeita.</p>
      </CrmConfirmDialog>
    </>
  );
}

export default function AgentesPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f8fcf6", padding: 24, color: "#5d7a67" }}>Carregando...</div>}>
      <AgentesView />
    </Suspense>
  );
}
