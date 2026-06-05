"use client";

import { Suspense, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from "react";
import { Activity, ChevronRight, Clock, MessageCircle, Power, Trash2, Webhook, X, Zap } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { AgenteNovoWizard } from "@/components/crm/AgenteNovoWizard";
import { CrmCargosCatalogDrawer } from "@/components/crm/CrmCargosCatalogDrawer";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { CrmBotRingAvatar } from "@/components/crm/CrmBotRingAvatar";
import { AgenteSideoverEntityCard, AgenteSideoverInfoGrid } from "@/components/crm/AgenteSideoverCards";
import { CRM_ENTITY_GRID, crmGlassCardSurface } from "@/lib/crm-glass-card";
import { calcularSaudeAgente, SAUDE_CORES } from "@/lib/agente-saude";
import { INFERENCIA_IA_CRM_COPIA } from "@/lib/ia/hub-model-defaults";

const MERCADOS_FIXOS = ["IMB", "ARQ", "RFM", "MRC", "ENG", "SRV", "PRO", "FOR"];
const UI_FETCH_CACHE_TTL_MS = 15_000;

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

type Agente = {
  agente_slug: string;
  nome: string;
  cargo: string;
  area?: string;
  segmento?: string;
  nivel?: string;
  ativo?: boolean;
  arquivado_em?: string | null;
  avatar_url?: string | null;
  prefixo_mercado?: string;
  bio?: string;
  tom_voz?: string;
  estilo_comunicacao?: string;
  system_prompt_base?: string;
  modelo_padrao?: string;
  [key: string]: unknown;
};

type AgenteLog = {
  id: string;
  criado_em?: string;
  mensagem_usuario?: string;
  resposta_ia?: string;
  modelo_usado?: string;
  tempo_resposta_ms?: number;
  tokens_input?: number;
  tokens_output?: number;
  custo_estimado_brl?: number;
  [key: string]: unknown;
};

type ListMode = "todos" | "ativos" | "inativos" | "arquivados";
function urlParaModo(modo: ListMode): string {
  if (modo === "todos") return "/api/hub/agentes?todos=true";
  if (modo === "arquivados") return "/api/hub/agentes?arquivados=somente";
  if (modo === "inativos") return "/api/hub/agentes?ativo=false";
  return "/api/hub/agentes?ativo=true";
}

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
        borderTop: isFirst ? "none" : "1px solid rgba(37, 48, 66, 0.95)",
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
            color: "#c4d2e5",
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
              color: "#c9a24a",
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

const TIPO_CICLO_OPERACAO: Record<string, { cor: string }> = {
  continuo: { cor: "#22c55e" },
  programado: { cor: "#c9a24a" },
  gatilho: { cor: "#94a3b8" },
};

function accentAgente(segmento?: string | null): string {
  return SEGMENTO_COR[segmento || ""] || "#c9a24a";
}

function progressoSaudeRing(saude: "ok" | "degradado" | "parado" | null): number {
  if (saude === "ok") return 0.85;
  if (saude === "degradado") return 0.45;
  return 0.15;
}

function corUltimoCicloStatus(st?: string): string {
  const s = String(st || "").toLowerCase();
  if (s === "sucesso") return "#86efac";
  if (s === "erro") return "#f87171";
  if (s === "rodando") return "#fbbf24";
  if (s === "sem_acao") return "#94a3b8";
  return "#64748b";
}

function estimateIntervalMinutes(cron?: string | null, intervaloRaw?: unknown): number | null {
  const fromNum =
    typeof intervaloRaw === "number"
      ? intervaloRaw
      : typeof intervaloRaw === "string"
        ? Number.parseFloat(intervaloRaw)
        : NaN;
  if (Number.isFinite(fromNum) && fromNum > 0) return fromNum;

  const c = String(cron || "").trim();
  if (!c) return null;
  if (c === "*/2 * * * *") return 2;
  if (c === "*/30 * * * *") return 30;
  if (c === "0 */6 * * *") return 360;
  if (/^0 \d+ \* \* \*$/.test(c)) return 1440;
  return null;
}

/** Progresso 0–1 ao longo da cadência (repete a cada período). */
function progressoAnelCiclo(ultimoIso: string | null | undefined, intervalMin: number | null): number {
  if (!intervalMin || intervalMin <= 0) return 0;
  const t = ultimoIso ? new Date(ultimoIso).getTime() : NaN;
  if (Number.isNaN(t)) return 0;
  const elapsed = Date.now() - t;
  const period = intervalMin * 60000;
  if (period <= 0) return 0;
  const p = (elapsed % period) / period;
  return Math.min(1, Math.max(0, p));
}

function rotuloCadenciaCron(intervalMin: number | null, cron?: string | null, tipo?: string): string {
  if (intervalMin != null && intervalMin > 0) {
    if (intervalMin < 60) return `a cada ${Math.round(intervalMin)} min`;
    if (intervalMin < 1440) return `a cada ${Math.round(intervalMin / 60)} h`;
    return "≈ 1× ao dia";
  }
  const t = String(tipo || "").toLowerCase();
  if (t === "continuo") return "Contínuo (tempo real)";
  if (t === "programado") return "Programado (cron)";
  if (t === "gatilho") return "Sob gatilho";
  const cr = String(cron || "").trim();
  if (cr) return cr.length > 28 ? `${cr.slice(0, 28)}…` : cr;
  return t || "—";
}

function cicloTipoLabel(tipoKey: string): string {
  const t = String(tipoKey || "").toLowerCase();
  if (t === "programado") return "Programado";
  if (t === "gatilho") return "Gatilho";
  if (t === "continuo") return "Contínuo";
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Ciclo";
}

function cicloRingIcon(tipoKey: string) {
  const t = String(tipoKey || "").toLowerCase();
  if (t === "gatilho") return Webhook;
  if (t === "continuo") return Zap;
  return Clock;
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
  const { setSlot } = useCrmHeaderSlot();

  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [modoLista, setModoLista] = useState<ListMode>("todos");
  const [buscaLista, setBuscaLista] = useState("");
  const [filtroSegmento, setFiltroSegmento] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [drawerNovoOpen, setDrawerNovoOpen] = useState(false);
  const [drawerCargosOpen, setDrawerCargosOpen] = useState(false);
  const [alternandoAtivoSlug, setAlternandoAtivoSlug] = useState<string | null>(null);
  const [excluindoAgenteSlug, setExcluindoAgenteSlug] = useState<string | null>(null);
  const [dialogExcluirAgente, setDialogExcluirAgente] = useState<Agente | null>(null);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErro, setDetailErro] = useState<string | null>(null);
  const [detailAgente, setDetailAgente] = useState<Agente | null>(null);
  const [logs, setLogs] = useState<AgenteLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsErro, setLogsErro] = useState<string | null>(null);
  const [salvandoDetalhe, setSalvandoDetalhe] = useState(false);

  type OperacaoAgentePayload = {
    ciclos: Record<string, unknown>[];
    execucoes_ciclo: Record<string, unknown>[];
    acoes: Record<string, unknown>[];
    ultimo_prompt_em: string | null;
  };
  const [operacao, setOperacao] = useState<OperacaoAgentePayload | null>(null);
  const [operacaoLoading, setOperacaoLoading] = useState(false);
  const [operacaoErro, setOperacaoErro] = useState<string | null>(null);

  const [editNome, setEditNome] = useState("");
  const [editMercados, setEditMercados] = useState<string[]>([]);
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
  const listaCacheRef = useRef<{ ts: number; data: Agente[] } | null>(null);
  const detalheCacheRef = useRef<Map<string, { ts: number; data: Agente }>>(new Map());
  const logsCacheRef = useRef<Map<string, { ts: number; data: AgenteLog[] }>>(new Map());
  const operacaoCacheRef = useRef<Map<string, { ts: number; data: OperacaoAgentePayload }>>(new Map());

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
        st === "erro" ? "#f87171" : st === "sucesso" ? "#86efac" : st === "sem_acao" ? "#94a3b8" : "#c9a24a";
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

  const carregarAgentes = useCallback(() => {
    const cached = listaCacheRef.current;
    if (cached && Date.now() - cached.ts < UI_FETCH_CACHE_TTL_MS) {
      setAgentes(cached.data);
      setCarregando(false);
      setErroLista(null);
      return;
    }
    setErroLista(null);
    setCarregando(true);
    fetch(urlParaModo(modoLista), { headers: internalApiHeaders() })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErroLista(typeof data?.error === "string" ? data.error : `Erro ${r.status} ao carregar agentes.`);
          setAgentes([]);
          return;
        }
        if (Array.isArray(data)) {
          setAgentes(data);
          listaCacheRef.current = { ts: Date.now(), data };
        } else if (Array.isArray(data?.agentes)) {
          setAgentes(data.agentes);
          listaCacheRef.current = { ts: Date.now(), data: data.agentes };
        }
        else {
          setAgentes([]);
          setErroLista("Resposta inesperada do servidor.");
        }
      })
      .catch((e: Error) => {
        setErroLista(e?.message || "Falha de rede ao carregar agentes.");
        setAgentes([]);
      })
      .finally(() => setCarregando(false));
  }, [modoLista]);

  const carregarDetalhe = useCallback(async (slug: string) => {
    const cached = detalheCacheRef.current.get(slug);
    if (cached && Date.now() - cached.ts < UI_FETCH_CACHE_TTL_MS) {
      setDetailAgente(cached.data);
      setEditNome(String(cached.data?.nome || ""));
      setEditMercados(
        String(cached.data?.prefixo_mercado || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      );
      setEditBio(String(cached.data?.bio || ""));
      setEditTom(String(cached.data?.tom_voz || ""));
      setEditEstilo(String(cached.data?.estilo_comunicacao || ""));
      setEditPrompt(String(cached.data?.system_prompt_base || ""));
      setEditAtivo(cached.data?.ativo !== false);
      setDetailLoading(false);
      setDetailErro(null);
      return;
    }
    setDetailLoading(true);
    setDetailErro(null);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}`, { headers: internalApiHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDetailErro(typeof data?.error === "string" ? data.error : "Falha ao carregar agente.");
        setDetailAgente(null);
        return;
      }
      setDetailAgente(data);
      detalheCacheRef.current.set(slug, { ts: Date.now(), data });
      setEditNome(String(data?.nome || ""));
      setEditMercados(
        String(data?.prefixo_mercado || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      );
      setEditBio(String(data?.bio || ""));
      setEditTom(String(data?.tom_voz || ""));
      setEditEstilo(String(data?.estilo_comunicacao || ""));
      setEditPrompt(String(data?.system_prompt_base || ""));
      setEditAtivo(data?.ativo !== false);
    } catch (e) {
      setDetailErro((e as Error)?.message || "Falha de rede ao carregar detalhes.");
      setDetailAgente(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const carregarLogs = useCallback(async (slug: string) => {
    const cached = logsCacheRef.current.get(slug);
    if (cached && Date.now() - cached.ts < UI_FETCH_CACHE_TTL_MS) {
      setLogs(cached.data);
      setLogsLoading(false);
      setLogsErro(null);
      return;
    }
    setLogsLoading(true);
    setLogsErro(null);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}/logs?limit=80`, {
        headers: internalApiHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLogsErro(typeof data?.error === "string" ? data.error : "Falha ao carregar logs.");
        setLogs([]);
        return;
      }
      const raw = Array.isArray(data?.logs) ? data.logs : [];
      setLogs(raw);
      logsCacheRef.current.set(slug, { ts: Date.now(), data: raw });
    } catch (e) {
      setLogsErro((e as Error)?.message || "Falha de rede ao carregar logs.");
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const carregarOperacao = useCallback(async (slug: string) => {
    const cached = operacaoCacheRef.current.get(slug);
    if (cached && Date.now() - cached.ts < UI_FETCH_CACHE_TTL_MS) {
      setOperacao(cached.data);
      setOperacaoLoading(false);
      setOperacaoErro(null);
      return;
    }
    setOperacaoLoading(true);
    setOperacaoErro(null);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}/operacao`, {
        headers: internalApiHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOperacaoErro(typeof data?.error === "string" ? data.error : "Falha ao carregar dados operacionais.");
        setOperacao(null);
        return;
      }
      const payload = {
        ciclos: Array.isArray(data?.ciclos) ? data.ciclos : [],
        execucoes_ciclo: Array.isArray(data?.execucoes_ciclo) ? data.execucoes_ciclo : [],
        acoes: Array.isArray(data?.acoes) ? data.acoes : [],
        ultimo_prompt_em: typeof data?.ultimo_prompt_em === "string" ? data.ultimo_prompt_em : null,
      };
      setOperacao(payload);
      operacaoCacheRef.current.set(slug, { ts: Date.now(), data: payload });
    } catch (e) {
      setOperacaoErro((e as Error)?.message || "Falha de rede (operação).");
      setOperacao(null);
    } finally {
      setOperacaoLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarAgentes();
  }, [carregarAgentes]);

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
    void carregarDetalhe(selectedSlug);
    void carregarOperacao(selectedSlug);
    void carregarLogs(selectedSlug);
  }, [selectedSlug, carregarDetalhe, carregarOperacao, carregarLogs, router]);

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
              background: "rgba(0,0,0,0.28)",
              color: "var(--obra-texto, #0b2210)",
              border: "none",
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
              background: "linear-gradient(180deg, #065535 0%, #003b26 100%)",
              color: "#c9a24a",
              border: "none",
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

      if ((modoLista === "ativos" && !proximo) || (modoLista === "inativos" && proximo)) {
        setAgentes((prev) => prev.filter((a) => a.agente_slug !== agente.agente_slug));
      } else {
        setAgentes((prev) =>
          prev.map((a) => (a.agente_slug === agente.agente_slug ? { ...a, ativo: proximo } : a))
        );
      }

      if (detailAgente?.agente_slug === agente.agente_slug) setEditAtivo(proximo);
      listaCacheRef.current = null;
      detalheCacheRef.current.delete(agente.agente_slug);
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
    setErroLista(null);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agente.agente_slug)}`, {
        method: "DELETE",
        headers: internalApiHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErroLista(typeof data?.error === "string" ? data.error : `Erro ${res.status} ao excluir.`);
        return;
      }
      setDialogExcluirAgente(null);
      setAgentes((prev) => prev.filter((a) => a.agente_slug !== agente.agente_slug));
      listaCacheRef.current = null;
      detalheCacheRef.current.delete(agente.agente_slug);
      logsCacheRef.current.delete(agente.agente_slug);
      operacaoCacheRef.current.delete(agente.agente_slug);
      if (selectedSlug === agente.agente_slug) {
        setSelectedSlug(null);
        setDetailAgente(null);
        setDetailErro(null);
      }
    } finally {
      setExcluindoAgenteSlug(null);
    }
  }

  function toggleEditMercado(m: string) {
    setEditMercados((prev) => (prev.includes(m) ? prev.filter((v) => v !== m) : [...prev, m]));
  }

  async function salvarDetalhes() {
    if (!selectedSlug || !detailAgente) return;
    setSalvandoDetalhe(true);
    setDetailErro(null);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(selectedSlug)}`, {
        method: "PATCH",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: editNome.trim(),
          prefixo_mercado: editMercados.join(","),
          bio: editBio,
          tom_voz: editTom,
          estilo_comunicacao: editEstilo,
          system_prompt_base: editPrompt,
          ativo: editAtivo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDetailErro(typeof data?.error === "string" ? data.error : "Falha ao salvar.");
        return;
      }
      setDetailAgente(data);
      detalheCacheRef.current.set(selectedSlug, { ts: Date.now(), data });
      listaCacheRef.current = null;
      void carregarOperacao(selectedSlug);
      setAgentes((prev) =>
        prev
          .map((a) =>
            a.agente_slug === selectedSlug
              ? {
                  ...a,
                  nome: editNome.trim() || a.nome,
                  ativo: editAtivo,
                }
              : a
          )
          .filter((a) => matchesModo(a, modoLista))
      );
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
                    border: `1px solid ${sel ? "#c9a24a66" : "#293241"}`,
                    background: sel ? "#c9a24a1f" : "#121923",
                    color: sel ? "#d6b976" : "#99a6b8",
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
                  background: "#121923",
                  border: "1px solid #293241",
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
                background: "#121923",
                border: "1px solid #293241",
                color: "#0b2210",
              }}
            />
            {!carregando && !erroLista && agentes.length > 0 && (
              <span style={{ fontSize: 12, color: "#708096", marginLeft: 6 }}>
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
              background: "#3d1414",
              border: "1px solid #f8514966",
              color: "#f85149",
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
              const ativo = agente.ativo !== false;
              const avatarUrl = typeof agente.avatar_url === "string" && agente.avatar_url.trim() ? agente.avatar_url.trim() : null;
              const selecionado = selectedSlug === agente.agente_slug;
              const bio = resumoCardAgente(agente);

              return (
                <div
                  key={agente.agente_slug}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedSlug(agente.agente_slug);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedSlug(agente.agente_slug);
                    }
                  }}
                  style={{
                    ...crmGlassCardSurface(selecionado),
                    opacity: ativo ? 1 : 0.88,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <CrmBotRingAvatar
                      accent="#22c55e"
                      imageUrl={avatarUrl}
                      pixelSize={48}
                      progress={0.35}
                      dim={!ativo}
                    />
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          color: "#f8fafc",
                          fontWeight: 700,
                          fontSize: 15,
                          margin: 0,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {agente.nome}
                      </p>
                      <p
                        style={{
                          color: "#94a3b8",
                          fontSize: 11,
                          margin: "4px 0 0",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {agente.agente_slug}
                      </p>
                    </div>
                  </div>

                  <p
                    style={{
                      fontSize: 12,
                      color: "#94a3b8",
                      margin: 0,
                      lineHeight: 1.5,
                      minHeight: 54,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {bio}
                  </p>

                  <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                    {agente.cargo}
                    {agente.segmento ? (
                      <>
                        {" · "}
                        <span style={{ color: segCor, fontWeight: 600 }}>{agente.segmento}</span>
                      </>
                    ) : null}
                    {agente.nivel ? (
                      <>
                        {" · "}
                        <span style={{ color: nivelCor, fontWeight: 600 }}>{agente.nivel}</span>
                      </>
                    ) : null}
                    {(modoLista === "arquivados" || modoLista === "todos") && agente.arquivado_em ? " · Arquivado" : ""}
                  </p>

                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopStyle: "solid",
                      borderTopColor: "rgba(44, 56, 75, 0.85)",
                      display: "flex",
                      width: "100%",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      minHeight: 0,
                    }}
                  >
                    <div
                      role="group"
                      aria-label="Ações do agente"
                      style={{
                        display: "flex",
                        borderRadius: 8,
                        overflow: "hidden",
                        borderStyle: "solid",
                        borderWidth: 1,
                        borderColor: "rgba(44, 56, 75, 0.95)",
                        background: "#0f1620",
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => alternarAtivo(agente, e)}
                        disabled={
                          !!agente.arquivado_em ||
                          alternandoAtivoSlug === agente.agente_slug ||
                          excluindoAgenteSlug === agente.agente_slug
                        }
                        title={
                          agente.arquivado_em
                            ? "Arquivado — não pode alterar estado"
                            : ativo
                              ? "Desativar agente"
                              : "Ativar agente"
                        }
                        aria-label={
                          agente.arquivado_em
                            ? "Agente arquivado"
                            : ativo
                              ? "Desativar agente"
                              : "Ativar agente"
                        }
                        style={{
                          width: 34,
                          height: 30,
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          border: 0,
                          boxShadow: "inset -1px 0 0 rgba(44, 56, 75, 0.95)",
                          cursor:
                            !!agente.arquivado_em ||
                            alternandoAtivoSlug === agente.agente_slug ||
                            excluindoAgenteSlug === agente.agente_slug
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            !!agente.arquivado_em ||
                            alternandoAtivoSlug === agente.agente_slug ||
                            excluindoAgenteSlug === agente.agente_slug
                              ? 0.45
                              : 1,
                          background: agente.arquivado_em
                            ? "rgba(109, 40, 217, 0.12)"
                            : ativo
                              ? "rgba(34, 197, 94, 0.1)"
                              : "rgba(248, 113, 113, 0.08)",
                          color: agente.arquivado_em ? "#c4b5fd" : ativo ? "#4ade80" : "#f87171",
                        }}
                      >
                        {alternandoAtivoSlug === agente.agente_slug ? (
                          <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1 }}>…</span>
                        ) : (
                          <Power size={14} strokeWidth={2.25} aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => pedirExcluirAgente(agente, e)}
                        disabled={
                          excluindoAgenteSlug === agente.agente_slug || alternandoAtivoSlug === agente.agente_slug
                        }
                        title="Excluir agente e dados associados"
                        aria-label="Excluir agente e dados associados"
                        style={{
                          width: 34,
                          height: 30,
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          border: 0,
                          boxShadow: "none",
                          cursor:
                            excluindoAgenteSlug === agente.agente_slug || alternandoAtivoSlug === agente.agente_slug
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            excluindoAgenteSlug === agente.agente_slug || alternandoAtivoSlug === agente.agente_slug
                              ? 0.45
                              : 1,
                          background: "rgba(127, 29, 29, 0.22)",
                          color: "#fca5a5",
                        }}
                      >
                        {excluindoAgenteSlug === agente.agente_slug ? (
                          <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1 }}>…</span>
                        ) : (
                          <Trash2 size={14} strokeWidth={2.25} aria-hidden />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
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
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", padding: 0 }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(620px, 100vw)",
              zIndex: 50,
              background: "#f8fcf6",
              borderLeft: "1px solid #dcebd8",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <AgenteNovoWizard variant="drawer" onClose={() => setDrawerNovoOpen(false)} onCreated={() => carregarAgentes()} />
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
              background: "#0f1620",
              borderLeft: "1px solid #2d394b",
              boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div style={{ borderBottom: "1px solid #2d394b", padding: 16, background: "linear-gradient(180deg,#121a26 0%, #101722 100%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                  <CrmBotRingAvatar
                    accent={accentAgente(detailAgente?.segmento)}
                    progress={progressoSaudeRing(saudeAgente)}
                    fallbackProgress={0.35}
                    pixelSize={52}
                    imageUrl={detailAgente?.avatar_url}
                    dim={detailAgente?.ativo === false || !!detailAgente?.arquivado_em}
                    pulse={saudeAgente === "ok" && detailAgente?.ativo !== false}
                  />
                  <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, color: "#8ea1ba", fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>MODELO</p>
                  <h3 style={{ margin: "3px 0 0", color: "#0b2210", fontSize: 17 }}>
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
                    {operacaoLoading && (
                      <span style={{ fontSize: 11, color: "#7a8ca3" }}>Atualizando métricas…</span>
                    )}
                  </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => selectedSlug && router.push(`/crm/agentes/${selectedSlug}`)}
                    style={{ border: "1px solid #344256", background: "#1d2633", color: "#9eb0c8", borderRadius: 8, padding: "8px 10px", fontSize: 11, cursor: "pointer", fontWeight: 700 }}
                  >
                    Página completa
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSlug(null)}
                    style={{ border: "1px solid #344256", background: "#1d2633", color: "#9eb0c8", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    aria-label="Fechar"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {detailLoading ? (
                <p style={{ color: "#5d7a67", fontSize: 13 }}>Carregando dados do modelo...</p>
              ) : detailErro ? (
                <div style={{ color: "#f87171", background: "#3a1518", border: "1px solid #7f1d1d", borderRadius: 8, padding: 10, fontSize: 13 }}>
                  {detailErro}
                </div>
              ) : !detailAgente ? (
                <p style={{ color: "#5d7a67", fontSize: 13 }}>Modelo não encontrado.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {operacaoErro && (
                    <div
                      style={{
                        color: "#fbbf24",
                        background: "#422006",
                        border: "1px solid #854d0e",
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
                      background: "#141d29",
                      border: "1px solid #2c384b",
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(37, 48, 66, 0.9)" }}>
                        <p style={{ color: "#8ea1ba", fontSize: 11, margin: 0, fontWeight: 700 }}>Visão operacional</p>
                        <p style={{ margin: "8px 0 0", color: "#9cb0c9", fontSize: 11, lineHeight: 1.5 }}>
                          {saudeAgente === "ok" && "Execuções e ações recentes dentro do esperado."}
                          {saudeAgente === "degradado" &&
                            "Alguma coisa está fora do esperado: falhas recentes nas tarefas automáticas, ou há tempo sem corridas quando os ciclos estão ligados. Vale rever em Ciclos IA e no fluxo WhatsApp/agenda."}
                          {saudeAgente === "parado" && "Modelo inativo ou arquivado — não há operação esperada."}
                          {!saudeAgente && "—"}
                        </p>
                        {operacao?.ultimo_prompt_em && (
                          <p style={{ margin: "8px 0 0", color: "#7f90a8", fontSize: 11 }}>
                            Última resposta IA registrada: {tempoOpRelativo(operacao.ultimo_prompt_em)} atrás
                          </p>
                        )}
                      </div>
                      <div style={{ padding: "6px 14px 12px" }}>
                        {operacaoLoading && (
                          <p style={{ margin: "0 0 10px", color: "#7f90a8", fontSize: 12 }}>A carregar métricas operacionais…</p>
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
                                border: "1px solid rgba(201, 162, 74, 0.35)",
                                background: "rgba(201, 162, 74, 0.08)",
                                color: "#d6b976",
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
                          {operacao.ciclos.length === 0 ? (
                        <p style={{ margin: 0, color: "#7f90a8", fontSize: 12 }}>Nenhum ciclo vinculado a este modelo.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {operacao.ciclos.map((c) => {
                            const row = c as {
                              id?: string;
                              nome?: string;
                              descricao?: string;
                              ativo?: boolean;
                              ultimo_status?: string;
                              tipo?: string;
                              ultimo_ciclo?: string | null;
                              cron_expressao?: string | null;
                              intervalo_minutos?: number | null;
                              total_execucoes?: number | null;
                            };
                            const tipoKey = String(row.tipo || "").toLowerCase();
                            const metaTipo = TIPO_CICLO_OPERACAO[tipoKey] || {
                              cor: "#7d8a9a",
                            };
                            const intervalMin = estimateIntervalMinutes(row.cron_expressao, row.intervalo_minutos);
                            const prog = progressoAnelCiclo(row.ultimo_ciclo, intervalMin);
                            const ultimoIso = row.ultimo_ciclo ? String(row.ultimo_ciclo) : "";
                            const temExecucao = ultimoIso && !Number.isNaN(new Date(ultimoIso).getTime());
                            const st = String(row.ultimo_status || "nunca_executado");
                            const stCor = corUltimoCicloStatus(st);
                            const cadencia = rotuloCadenciaCron(intervalMin, row.cron_expressao, row.tipo);
                            const execN = row.total_execucoes != null ? Number(row.total_execucoes) : null;

                            const labelTimer =
                              row.ativo === false
                                ? "Pausado"
                                : !temExecucao
                                  ? "Aguardando 1ª exec."
                                  : intervalMin != null
                                    ? `${Math.round(prog * 100)}% período`
                                    : "Ativo";

                            return (
                              <div
                                key={String(row.id || row.nome)}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  background: "linear-gradient(165deg, rgba(22, 30, 44, 0.95) 0%, rgba(12, 17, 24, 0.98) 100%)",
                                  border: "1px solid rgba(56, 74, 102, 0.55)",
                                  borderRadius: 14,
                                  overflow: "hidden",
                                  boxShadow: "0 8px 28px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255,255,255,0.03) inset",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 14,
                                    alignItems: "flex-start",
                                    padding: "14px 14px 12px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      gap: 4,
                                      flexShrink: 0,
                                      width: 62,
                                    }}
                                  >
                                    <CrmBotRingAvatar
                                      accent={metaTipo.cor}
                                      progress={prog}
                                      fallbackProgress={tipoKey === "gatilho" ? 0.22 : tipoKey === "continuo" ? 0.2 : 0.28}
                                      pixelSize={58}
                                      Icon={cicloRingIcon(tipoKey)}
                                      dim={row.ativo === false}
                                      pulse={!temExecucao && row.ativo !== false}
                                    />
                                    <span
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        color: row.ativo === false ? "#475569" : "#7f90a8",
                                        textAlign: "center",
                                        lineHeight: 1.2,
                                        maxWidth: 62,
                                      }}
                                    >
                                      {labelTimer}
                                    </span>
                                  </div>
                                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <strong style={{ color: "#0b2210", fontSize: 14, letterSpacing: "-0.02em" }}>
                                      {String(row.nome || "—")}
                                    </strong>
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        background: row.ativo !== false ? "#052e1622" : "#3f1515",
                                        color: row.ativo !== false ? "#86efac" : "#fca5a5",
                                        border: `1px solid ${row.ativo !== false ? "#15803d55" : "#7f1d1d"}`,
                                      }}
                                    >
                                      {row.ativo !== false ? "ativo" : "inativo"}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        background: `${stCor}18`,
                                        color: stCor,
                                        border: `1px solid ${stCor}44`,
                                      }}
                                    >
                                      Último status · {st}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "auto 1fr",
                                      gap: "6px 16px",
                                      fontSize: 11,
                                      color: "#94a3b8",
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    <span style={{ color: "#64748b", fontWeight: 600 }}>Última execução</span>
                                    <span style={{ color: temExecucao ? "#c8d4e6" : "#64748b" }}>
                                      {temExecucao ? (
                                        <>
                                          <time dateTime={ultimoIso} style={{ color: "#e2e8f0", fontWeight: 600 }}>
                                            {formatarData(ultimoIso)}
                                          </time>
                                          <span style={{ color: "#7f90a8" }}> ({tempoOpRelativo(ultimoIso)} atrás)</span>
                                        </>
                                      ) : (
                                        "Nunca executado — aguardando 1ª corrida"
                                      )}
                                    </span>
                                    <span style={{ color: "#64748b", fontWeight: 600 }}>Cadência</span>
                                    <span style={{ color: "#aebccf" }}>{cadencia}</span>
                                    {execN != null && Number.isFinite(execN) ? (
                                      <>
                                        <span style={{ color: "#64748b", fontWeight: 600 }}>Total exec.</span>
                                        <span style={{ color: "#aebccf" }}>{execN}</span>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                                <div
                                  style={{
                                    borderTop: "1px solid rgba(37, 48, 66, 0.95)",
                                    padding: "11px 14px 12px",
                                    background: "rgba(6, 10, 16, 0.72)",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                  }}
                                >
                                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: metaTipo.cor,
                                        padding: "4px 8px",
                                        borderRadius: 6,
                                        background: `${metaTipo.cor}14`,
                                        border: `1px solid ${metaTipo.cor}33`,
                                      }}
                                    >
                                      {tipoKey === "gatilho" ? (
                                        <Webhook size={11} strokeWidth={2.2} aria-hidden />
                                      ) : tipoKey === "continuo" ? (
                                        <Zap size={11} strokeWidth={2.2} aria-hidden />
                                      ) : (
                                        <Clock size={11} strokeWidth={2.2} aria-hidden />
                                      )}
                                      {cicloTipoLabel(tipoKey)}
                                    </span>
                                    <span style={{ color: "#5c6d82", fontSize: 10, fontWeight: 600 }}>·</span>
                                    <span style={{ color: "#8ea1ba", fontSize: 10, fontWeight: 600 }}>{cadencia}</span>
                                  </div>
                                  <span
                                    style={{
                                      color: "#64748b",
                                      fontSize: 10,
                                      fontWeight: 600,
                                      maxWidth: 220,
                                      textAlign: "right",
                                    }}
                                  >
                                    {labelTimer}
                                  </span>
                                  {row.descricao && String(row.descricao).trim() ? (
                                    <p
                                      style={{
                                        width: "100%",
                                        margin: 0,
                                        fontSize: 10,
                                        color: "#566778",
                                        lineHeight: 1.45,
                                        borderTop: "1px solid rgba(37, 48, 66, 0.45)",
                                        paddingTop: 10,
                                      }}
                                    >
                                      {String(row.descricao).trim().slice(0, 140)}
                                      {String(row.descricao).trim().length > 140 ? "…" : ""}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                        </SideoverFold>
                        <SideoverFold
                          title={`Atividade recente${atividadeRecente.length > 0 ? ` (${atividadeRecente.length})` : ""}`}
                          open={drawerSecAtividadeAberto}
                          onToggle={() => setDrawerSecAtividadeAberto((o) => !o)}
                        >
                      {atividadeRecente.length === 0 ? (
                        <AgenteSideoverEntityCard
                          accent="#94a3b8"
                          progress={null}
                          fallbackProgress={0.2}
                          Icon={Activity}
                          avatarCaption="Sem eventos"
                          footer={
                            <p style={{ margin: 0, color: "#64748b", fontSize: 10, lineHeight: 1.45 }}>
                              Ações da IA e corridas de ciclos aparecem aqui após WhatsApp, copiloto ou tarefas em{" "}
                              <strong style={{ color: "#aebccf" }}>Ciclos IA</strong>. Conversas com clientes estão na
                              linha do tempo abaixo.
                            </p>
                          }
                        >
                          <strong style={{ color: "#0b2210", fontSize: 13, fontWeight: 800 }}>Nada registado ainda</strong>
                          <p style={{ margin: "6px 0 0", color: "#7f90a8", fontSize: 11, lineHeight: 1.45 }}>
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
                                <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                                  {ev.kind === "ciclo" ? "Ciclo automático" : "Ação interna / ferramenta"}
                                </span>
                              }
                            >
                              <strong style={{ color: "#0b2210", fontSize: 12, fontWeight: 800 }}>{ev.titulo}</strong>
                              <p style={{ margin: "6px 0 0", color: "#9cb0c9", fontSize: 11, lineHeight: 1.45 }}>
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
                          imageUrl={detailAgente.avatar_url}
                          progress={progressoSaudeRing(saudeAgente)}
                          avatarCaption={estadoLabel}
                          dim={detailAgente.ativo === false || !!detailAgente.arquivado_em}
                          footer={
                            <p style={{ margin: 0, color: "#64748b", fontSize: 10, lineHeight: 1.45 }}>
                              Campos do cargo e da configuração inicial — alteram na página completa do modelo ou no assistente de criação.
                            </p>
                          }
                        >
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <strong style={{ color: "#0b2210", fontSize: 14, fontWeight: 800 }}>{detailAgente.nome}</strong>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 999,
                                border: `1px solid ${detailAgente.ativo !== false && !detailAgente.arquivado_em ? "#22c55e55" : "#64748b55"}`,
                                color: detailAgente.ativo !== false && !detailAgente.arquivado_em ? "#86efac" : "#94a3b8",
                                background: detailAgente.ativo !== false && !detailAgente.arquivado_em ? "#22c55e14" : "#64748b14",
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
                              { label: "Segmento", value: detailAgente.segmento || "—" },
                              { label: "Nível", value: detailAgente.nivel != null ? String(detailAgente.nivel) : "—" },
                              { label: "Mercados", value: detailAgente.prefixo_mercado || "—" },
                              { label: "Motor IA", value: INFERENCIA_IA_CRM_COPIA },
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
                      <div style={{ color: "#f87171", background: "#3a1518", border: "1px solid #7f1d1d", borderRadius: 8, padding: 10, fontSize: 12, marginBottom: 10 }}>
                        {logsErro}
                      </div>
                    )}
                    {logsLoading ? (
                      <p style={{ margin: 0, color: "#7f90a8", fontSize: 12 }}>A carregar interações…</p>
                    ) : logs.length === 0 ? (
                      <p style={{ margin: 0, color: "#7f90a8", fontSize: 12, lineHeight: 1.5 }}>
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
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 10, color: "#64748b" }}>
                                  {log.tempo_resposta_ms != null && <span>{String(log.tempo_resposta_ms)} ms</span>}
                                  {log.tokens_input != null && <span>in {String(log.tokens_input)} tok</span>}
                                  {log.tokens_output != null && <span>out {String(log.tokens_output)} tok</span>}
                                  {log.custo_estimado_brl != null && <span>R$ {Number(log.custo_estimado_brl).toFixed(4)}</span>}
                                </div>
                              }
                            >
                              <p style={{ margin: "0 0 6px", color: "#94a3b8", fontSize: 10, fontWeight: 700 }}>
                                {String(log.modelo_usado || "Conversa")}
                              </p>
                              {userMsg ? (
                                <p style={{ margin: "0 0 6px", color: "#c8d4e6", fontSize: 11, lineHeight: 1.45 }}>
                                  <span style={{ color: "#64748b", fontWeight: 700 }}>Entrada · </span>
                                  {userMsg.length > 180 ? `${userMsg.slice(0, 180)}…` : userMsg}
                                </p>
                              ) : null}
                              {aiMsg ? (
                                <p style={{ margin: 0, color: "#9cb0c9", fontSize: 11, lineHeight: 1.45 }}>
                                  <span style={{ color: "#64748b", fontWeight: 700 }}>Resposta · </span>
                                  {aiMsg.length > 180 ? `${aiMsg.slice(0, 180)}…` : aiMsg}
                                </p>
                              ) : (
                                <p style={{ margin: 0, color: "#7f90a8", fontSize: 11 }}>{preview}</p>
                              )}
                            </AgenteSideoverEntityCard>
                          );
                        })}
                      </div>
                    )}
                        </SideoverFold>
                      </div>
                  </div>

                  <p style={{ color: "#64748b", fontSize: 10, fontWeight: 700, margin: "4px 0 0", letterSpacing: 0.3 }}>
                    Dados editáveis neste painel
                  </p>
                  <div>
                    <label style={{ color: "#d7e3f4", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Nome</label>
                    <input value={editNome} onChange={(e) => setEditNome(e.target.value)} style={{ width: "100%", background: "#121b27", border: "1px solid #314056", color: "#0b2210", borderRadius: 8, padding: "9px 11px", fontSize: 13 }} />
                  </div>

                  <div>
                    <label style={{ color: "#d7e3f4", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Mercados</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {MERCADOS_FIXOS.map((m) => {
                        const sel = editMercados.includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => toggleEditMercado(m)}
                            style={{ border: `1px solid ${sel ? "#c9a24a66" : "#344256"}`, background: sel ? "#c9a24a1f" : "#121b27", color: sel ? "#d6b976" : "#9fb0c6", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={{ color: "#d7e3f4", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Bio</label>
                    <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} style={{ width: "100%", background: "#121b27", border: "1px solid #314056", color: "#0b2210", borderRadius: 8, padding: "9px 11px", fontSize: 13, resize: "vertical" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ color: "#d7e3f4", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Tom</label>
                      <input value={editTom} onChange={(e) => setEditTom(e.target.value)} style={{ width: "100%", background: "#121b27", border: "1px solid #314056", color: "#0b2210", borderRadius: 8, padding: "9px 11px", fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ color: "#d7e3f4", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Estilo</label>
                      <input value={editEstilo} onChange={(e) => setEditEstilo(e.target.value)} style={{ width: "100%", background: "#121b27", border: "1px solid #314056", color: "#0b2210", borderRadius: 8, padding: "9px 11px", fontSize: 13 }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ color: "#d7e3f4", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>
                      Instruções base para a IA
                    </label>
                    <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} rows={7} style={{ width: "100%", background: "#121b27", border: "1px solid #314056", color: "#0b2210", borderRadius: 8, padding: "9px 11px", fontSize: 13, resize: "vertical", lineHeight: 1.5 }} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#141d29", border: "1px solid #2c384b", borderRadius: 8, padding: "10px 12px" }}>
                    <span style={{ color: "#c3d0e3", fontSize: 12, fontWeight: 700 }}>Status operacional</span>
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
                      style={{ flex: 1, border: "none", background: "#003b26", color: "#c9a24a", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 700, cursor: salvandoDetalhe ? "wait" : "pointer", opacity: !editNome.trim() ? 0.5 : 1 }}
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
        danger
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
