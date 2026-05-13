"use client";

import { Suspense, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Bot, CalendarClock, Webhook } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { AgenteNovoWizard } from "@/components/crm/AgenteNovoWizard";
import {
  CRM_ENTITY_GRID,
  crmAvatarGlow,
  crmBtnDesativar,
  crmFooterStatusPill,
  crmGlassCardSurface,
} from "@/lib/crm-glass-card";
import { calcularSaudeAgente, SAUDE_CORES } from "@/lib/agente-saude";

const MERCADOS_FIXOS = ["IMB", "ARQ", "RFM", "MRC", "ENG", "SRV", "PRO", "FOR"];

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

type CargoCatalogo = {
  slug: string;
  titulo?: string;
  segmento?: string;
  especialidade?: string;
  nivel?: string | number;
  ativo?: boolean;
  descricao_curta?: string;
  [key: string]: unknown;
};

type ListMode = "todos" | "ativos" | "inativos" | "arquivados";
type DetailTab = "editar" | "logs";

function urlParaModo(modo: ListMode): string {
  if (modo === "todos") return "/api/hub/agentes?todos=true";
  if (modo === "arquivados") return "/api/hub/agentes?arquivados=somente";
  if (modo === "inativos") return "/api/hub/agentes?ativo=false";
  return "/api/hub/agentes?ativo=true";
}

function iniciais(nome: string): string {
  return (nome || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
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

const TIPO_CICLO_OPERACAO: Record<string, { cor: string }> = {
  continuo: { cor: "#22c55e" },
  programado: { cor: "#c9a24a" },
  gatilho: { cor: "#94a3b8" },
};

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

function cicloOperacionalIcon(tipoKey: string) {
  if (tipoKey === "programado") return CalendarClock;
  if (tipoKey === "gatilho") return Webhook;
  return Bot;
}

/** Mascote + anel de cadência (SVG), com pulso quando ainda não houve execução. */
function CicloOperacionalAvatar({
  tipoKey,
  accent,
  progress01,
  ativo,
  aguardandoPrimeira,
  labelTimer,
}: {
  tipoKey: string;
  accent: string;
  progress01: number;
  ativo: boolean;
  aguardandoPrimeira: boolean;
  labelTimer: string;
}) {
  const Icon = cicloOperacionalIcon(tipoKey);
  const r = 24;
  const cx = 29;
  const cy = 29;
  const circ = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress01));
  const strokeShown = Math.max(circ * 0.08, circ * p);
  const strokeHide = circ - strokeShown;
  const dim = !ativo;

  return (
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
      <div style={{ position: "relative", width: 58, height: 58 }}>
        <svg width="58" height="58" viewBox="0 0 58 58" style={{ display: "block" }} aria-hidden>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="2.5" opacity={dim ? 0.45 : 1} />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${strokeShown} ${strokeHide}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            opacity={dim ? 0.35 : 0.95}
            style={{ transition: "stroke-dasharray 0.65s ease, opacity 0.3s ease" }}
          />
          {ativo && aguardandoPrimeira ? (
            <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={accent} strokeWidth="1.2" opacity={0.5}>
              <animate attributeName="r" values={`${r + 2};${r + 5};${r + 2}`} dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.45;0.06;0.45" dur="2.4s" repeatCount="indefinite" />
            </circle>
          ) : null}
          {ativo && !aguardandoPrimeira && p > 0.02 ? (
            <circle cx={cx} cy={cy} r={r + 2.5} fill="none" stroke={accent} strokeWidth="1" strokeDasharray="4 7" opacity={0.35}>
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 ${cx} ${cy}`}
                to={`360 ${cx} ${cy}`}
                dur="14s"
                repeatCount="indefinite"
              />
            </circle>
          ) : null}
        </svg>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: `linear-gradient(165deg, ${accent}26 0%, #0d1117 50%, #0d1117 100%)`,
            border: `1px solid ${accent}55`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: aguardandoPrimeira ? `0 0 14px ${accent}33` : `0 0 0 1px #00000040 inset`,
          }}
        >
          <Icon size={19} color={dim ? "#64748b" : accent} strokeWidth={2} aria-hidden />
        </div>
      </div>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: dim ? "#475569" : "#7f90a8",
          textAlign: "center",
          lineHeight: 1.2,
          maxWidth: 62,
        }}
      >
        {labelTimer}
      </span>
    </div>
  );
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
  const [cargos, setCargos] = useState<CargoCatalogo[]>([]);
  const [carregandoCargos, setCarregandoCargos] = useState(false);
  const [erroCargos, setErroCargos] = useState<string | null>(null);
  const [alternandoCargoSlug, setAlternandoCargoSlug] = useState<string | null>(null);
  const [editandoCargoSlug, setEditandoCargoSlug] = useState<string | null>(null);
  const [cargoDraft, setCargoDraft] = useState<{ titulo: string; segmento: string; especialidade: string; descricao_curta: string }>({
    titulo: "",
    segmento: "",
    especialidade: "",
    descricao_curta: "",
  });

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("editar");
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

  const detalheAberto = !!selectedSlug;

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

  const carregarAgentes = useCallback(() => {
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
        if (Array.isArray(data)) setAgentes(data);
        else if (Array.isArray(data?.agentes)) setAgentes(data.agentes);
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

  const carregarCargos = useCallback(() => {
    setCarregandoCargos(true);
    setErroCargos(null);
    fetch("/api/hub/cargos?all=true", { headers: internalApiHeaders() })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErroCargos(typeof data?.error === "string" ? data.error : `Erro ${r.status} ao carregar cargos.`);
          setCargos([]);
          return;
        }
        if (Array.isArray(data)) setCargos(data);
        else if (Array.isArray(data?.cargos)) setCargos(data.cargos);
        else {
          setErroCargos("Resposta inesperada ao carregar cargos.");
          setCargos([]);
        }
      })
      .catch((e: Error) => {
        setErroCargos(e?.message || "Falha de rede ao carregar cargos.");
        setCargos([]);
      })
      .finally(() => setCarregandoCargos(false));
  }, []);

  const carregarDetalhe = useCallback(async (slug: string) => {
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
    } catch (e) {
      setLogsErro((e as Error)?.message || "Falha de rede ao carregar logs.");
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const carregarOperacao = useCallback(async (slug: string) => {
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
      setOperacao({
        ciclos: Array.isArray(data?.ciclos) ? data.ciclos : [],
        execucoes_ciclo: Array.isArray(data?.execucoes_ciclo) ? data.execucoes_ciclo : [],
        acoes: Array.isArray(data?.acoes) ? data.acoes : [],
        ultimo_prompt_em: typeof data?.ultimo_prompt_em === "string" ? data.ultimo_prompt_em : null,
      });
    } catch (e) {
      setOperacaoErro((e as Error)?.message || "Falha de rede (operação).");
      setOperacao(null);
    } finally {
      setOperacaoLoading(false);
    }
  }, []);

  async function alternarCargoAtivo(cargo: CargoCatalogo) {
    const slug = String(cargo.slug || "").trim();
    if (!slug) return;
    const proximo = cargo.ativo === false;
    setAlternandoCargoSlug(slug);
    try {
      const res = await fetch("/api/hub/cargos", {
        method: "PATCH",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ativo: proximo }),
      });
      if (!res.ok) return;
      setCargos((prev) => prev.map((c) => (c.slug === slug ? { ...c, ativo: proximo } : c)));
    } finally {
      setAlternandoCargoSlug(null);
    }
  }

  function iniciarEdicaoCargo(cargo: CargoCatalogo) {
    setEditandoCargoSlug(String(cargo.slug || ""));
    setCargoDraft({
      titulo: String(cargo.titulo || ""),
      segmento: String(cargo.segmento || ""),
      especialidade: String(cargo.especialidade || ""),
      descricao_curta: String(cargo.descricao_curta || ""),
    });
  }

  function cancelarEdicaoCargo() {
    setEditandoCargoSlug(null);
    setCargoDraft({ titulo: "", segmento: "", especialidade: "", descricao_curta: "" });
  }

  async function salvarEdicaoCargo(slug: string) {
    if (!slug) return;
    setAlternandoCargoSlug(slug);
    try {
      const res = await fetch("/api/hub/cargos", {
        method: "PATCH",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...cargoDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErroCargos(typeof data?.error === "string" ? data.error : "Falha ao salvar cargo.");
        return;
      }
      setCargos((prev) => prev.map((c) => (c.slug === slug ? { ...c, ...data } : c)));
      cancelarEdicaoCargo();
    } finally {
      setAlternandoCargoSlug(null);
    }
  }

  useEffect(() => {
    carregarAgentes();
  }, [carregarAgentes]);

  useEffect(() => {
    if (!drawerCargosOpen) return;
    carregarCargos();
  }, [drawerCargosOpen, carregarCargos]);

  useEffect(() => {
    if (editandoCargoSlug && !drawerCargosOpen) {
      cancelarEdicaoCargo();
    }
  }, [editandoCargoSlug, drawerCargosOpen]);

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
    void carregarDetalhe(selectedSlug);
    void carregarOperacao(selectedSlug);
    setLogs([]);
    setLogsErro(null);
  }, [selectedSlug, carregarDetalhe, carregarOperacao]);

  useEffect(() => {
    if (!selectedSlug || detailTab !== "logs") return;
    if (logs.length > 0 || logsLoading) return;
    void carregarLogs(selectedSlug);
  }, [selectedSlug, detailTab, logs.length, logsLoading, carregarLogs]);

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
              color: "var(--obra-texto, #e6edf3)",
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
    } finally {
      setAlternandoAtivoSlug(null);
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
      <div style={{ minHeight: "100vh", background: "#0d1117", padding: "24px" }}>
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", margin: "0 0 10px", letterSpacing: 0.5 }}>
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
                  color: "#e6edf3",
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
                color: "#e6edf3",
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
          <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando...</p>
        ) : agentes.length === 0 && !erroLista ? (
          <p style={{ color: "#8b949e", fontSize: 13 }}>Nenhum agente encontrado.</p>
        ) : agentesFiltrados.length === 0 ? (
          <p style={{ color: "#8b949e", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
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
              const bio =
                typeof agente.bio === "string" && agente.bio.trim()
                  ? agente.bio.trim().slice(0, 140) + (agente.bio.trim().length > 140 ? "…" : "")
                  : null;

              return (
                <div
                  key={agente.agente_slug}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedSlug(agente.agente_slug);
                    setDetailTab("editar");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedSlug(agente.agente_slug);
                      setDetailTab("editar");
                    }
                  }}
                  style={{
                    ...crmGlassCardSurface(selecionado),
                    opacity: ativo ? 1 : 0.88,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={crmAvatarGlow(segCor)}>
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        iniciais(agente.nome)
                      )}
                    </div>
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
                      color: "#cbd5e1",
                      margin: 0,
                      lineHeight: 1.45,
                      minHeight: 36,
                    }}
                  >
                    {bio || "—"}
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

                  <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                    Status:{" "}
                    <strong
                      style={{
                        color: agente.arquivado_em ? "#c4b5fd" : ativo ? "#4ade80" : "#f87171",
                        fontWeight: 700,
                      }}
                    >
                      {agente.arquivado_em ? "Arquivado" : ativo ? "Ativo" : "Inativo"}
                    </strong>
                  </p>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      marginTop: "auto",
                      gap: 10,
                      paddingTop: 4,
                    }}
                  >
                    <span
                      style={
                        agente.arquivado_em
                          ? { ...crmFooterStatusPill(false), background: "#6d28d9" }
                          : crmFooterStatusPill(ativo)
                      }
                    >
                      {agente.arquivado_em ? "Arquivado" : ativo ? "Ativo" : "Inativo"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => alternarAtivo(agente, e)}
                      disabled={!!agente.arquivado_em || alternandoAtivoSlug === agente.agente_slug}
                      style={crmBtnDesativar(!!agente.arquivado_em || alternandoAtivoSlug === agente.agente_slug)}
                    >
                      {alternandoAtivoSlug === agente.agente_slug
                        ? "…"
                        : `⏻ ${ativo ? "Desativar" : "Ativar"}`}
                    </button>
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
              width: "min(560px, 100vw)",
              zIndex: 50,
              background: "#0d1117",
              borderLeft: "1px solid #30363d",
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

      {drawerCargosOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar gerenciamento de cargos"
            onClick={() => setDrawerCargosOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 52, background: "rgba(0,0,0,0.55)", border: "none", padding: 0 }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(560px, 100vw)",
              zIndex: 53,
              background: "#0f1620",
              borderLeft: "1px solid #2d394b",
              boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div style={{ borderBottom: "1px solid #2d394b", padding: 16, background: "linear-gradient(180deg,#121a26 0%, #101722 100%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <p style={{ margin: 0, color: "#8ea1ba", fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>ADMINISTRAÇÃO</p>
                  <h3 style={{ margin: "3px 0 0", color: "#e6edf3", fontSize: 17 }}>Gerenciar cargos</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerCargosOpen(false)}
                  style={{ border: "1px solid #344256", background: "#1d2633", color: "#9eb0c8", borderRadius: 8, width: 34, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
              <p style={{ margin: "8px 0 0", color: "#8092a9", fontSize: 12 }}>
                Controle quais cargos ficam disponíveis no cadastro de novos agentes.
              </p>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {erroCargos && (
                <div style={{ color: "#f87171", background: "#3a1518", border: "1px solid #7f1d1d", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 }}>
                  {erroCargos}
                </div>
              )}
              {carregandoCargos ? (
                <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando cargos...</p>
              ) : cargos.length === 0 ? (
                <p style={{ color: "#8b949e", fontSize: 13 }}>Nenhum cargo encontrado.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {cargos.map((cargo) => {
                    const ativo = cargo.ativo !== false;
                    const slug = String(cargo.slug || "");
                    const emEdicao = editandoCargoSlug === slug;
                    return (
                      <div
                        key={slug}
                        style={{
                          background: "#131c28",
                          border: "1px solid #2d3a4d",
                          borderRadius: 10,
                          padding: "10px 12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        {!emEdicao ? (
                          <>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ margin: 0, color: "#e6edf3", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {String(cargo.titulo || slug)}
                              </p>
                              <p style={{ margin: "2px 0 0", color: "#8394ab", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                @{slug}
                                {cargo.segmento ? ` · ${String(cargo.segmento)}` : ""}
                                {cargo.especialidade ? ` · ${String(cargo.especialidade)}` : ""}
                              </p>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => iniciarEdicaoCargo(cargo)}
                                style={{
                                  border: "1px solid #334155",
                                  background: "#1e293b",
                                  color: "#94a3b8",
                                  borderRadius: 8,
                                  padding: "6px 9px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => alternarCargoAtivo(cargo)}
                                disabled={alternandoCargoSlug === slug}
                                style={{
                                  border: `1px solid ${ativo ? "#ef444455" : "#22c55e55"}`,
                                  background: ativo ? "#ef444420" : "#22c55e20",
                                  color: ativo ? "#ef4444" : "#22c55e",
                                  borderRadius: 999,
                                  padding: "6px 10px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: alternandoCargoSlug === slug ? "wait" : "pointer",
                                }}
                              >
                                {alternandoCargoSlug === slug ? "..." : ativo ? "Desativar" : "Ativar"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <input
                                value={cargoDraft.titulo}
                                onChange={(e) => setCargoDraft((p) => ({ ...p, titulo: e.target.value }))}
                                placeholder="Título"
                                style={{ background: "#0f1724", border: "1px solid #334155", color: "#e6edf3", borderRadius: 8, padding: "7px 9px", fontSize: 12 }}
                              />
                              <input
                                value={cargoDraft.segmento}
                                onChange={(e) => setCargoDraft((p) => ({ ...p, segmento: e.target.value }))}
                                placeholder="Segmento"
                                style={{ background: "#0f1724", border: "1px solid #334155", color: "#e6edf3", borderRadius: 8, padding: "7px 9px", fontSize: 12 }}
                              />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <input
                                value={cargoDraft.especialidade}
                                onChange={(e) => setCargoDraft((p) => ({ ...p, especialidade: e.target.value }))}
                                placeholder="Especialidade"
                                style={{ background: "#0f1724", border: "1px solid #334155", color: "#e6edf3", borderRadius: 8, padding: "7px 9px", fontSize: 12 }}
                              />
                              <input
                                value={cargoDraft.descricao_curta}
                                onChange={(e) => setCargoDraft((p) => ({ ...p, descricao_curta: e.target.value }))}
                                placeholder="Descrição curta"
                                style={{ background: "#0f1724", border: "1px solid #334155", color: "#e6edf3", borderRadius: 8, padding: "7px 9px", fontSize: 12 }}
                              />
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                              <button
                                type="button"
                                onClick={cancelarEdicaoCargo}
                                style={{ border: "1px solid #334155", background: "#1e293b", color: "#94a3b8", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => salvarEdicaoCargo(slug)}
                                disabled={alternandoCargoSlug === slug}
                                style={{ border: "none", background: "#003b26", color: "#c9a24a", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: alternandoCargoSlug === slug ? "wait" : "pointer" }}
                              >
                                {alternandoCargoSlug === slug ? "..." : "Salvar"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </>
      )}

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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <p style={{ margin: 0, color: "#8ea1ba", fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>AGENTE</p>
                  <h3 style={{ margin: "3px 0 0", color: "#e6edf3", fontSize: 17 }}>
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
                    style={{ border: "1px solid #344256", background: "#1d2633", color: "#9eb0c8", borderRadius: 8, width: 34, cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {(["editar", "logs"] as const).map((tab) => {
                  const sel = detailTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDetailTab(tab)}
                      style={{
                        border: `1px solid ${sel ? "#c9a24a66" : "#344256"}`,
                        background: sel ? "#c9a24a1f" : "#16202d",
                        color: sel ? "#d6b976" : "#9fb0c6",
                        padding: "8px 12px",
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {tab === "editar" ? "Editar agente" : "Logs timeline"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {detailLoading ? (
                <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando dados do agente...</p>
              ) : detailErro ? (
                <div style={{ color: "#f87171", background: "#3a1518", border: "1px solid #7f1d1d", borderRadius: 8, padding: 10, fontSize: 13 }}>
                  {detailErro}
                </div>
              ) : !detailAgente ? (
                <p style={{ color: "#8b949e", fontSize: 13 }}>Agente não encontrado.</p>
              ) : detailTab === "editar" ? (
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
                  {operacao && !operacaoLoading && (
                    <div style={{ background: "#141d29", border: "1px solid #2c384b", borderRadius: 10, padding: 12 }}>
                      <p style={{ color: "#8ea1ba", fontSize: 11, margin: "0 0 10px", fontWeight: 700 }}>
                        Visão operacional
                      </p>
                      <p style={{ margin: "0 0 10px", color: "#9cb0c9", fontSize: 11, lineHeight: 1.5 }}>
                        {saudeAgente === "ok" && "Execuções e ações recentes dentro do esperado."}
                        {saudeAgente === "degradado" &&
                          "Há erro recente nas execuções de ciclo, várias falhas seguidas, última corrida muito antiga ou silêncio prolongado (ciclos ativos sem log e sem prompt recente). Revise Ciclos IA e o fluxo WhatsApp/cron."}
                        {saudeAgente === "parado" && "Agente inativo ou arquivado — não há operação esperada."}
                        {!saudeAgente && "—"}
                      </p>
                      {operacao.ultimo_prompt_em && (
                        <p style={{ margin: "0 0 10px", color: "#7f90a8", fontSize: 11 }}>
                          Última resposta IA registrada: {tempoOpRelativo(operacao.ultimo_prompt_em)} atrás
                        </p>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                        <span style={{ color: "#c4d2e5", fontSize: 12, fontWeight: 700 }}>Ciclos atribuídos</span>
                        <button
                          type="button"
                          onClick={() => selectedSlug && router.push(`/crm/ciclos?q=${encodeURIComponent(selectedSlug)}`)}
                          style={{
                            border: "1px solid #c9a24a55",
                            background: "#c9a24a18",
                            color: "#d6b976",
                            borderRadius: 8,
                            padding: "5px 10px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Abrir Ciclos IA (filtro)
                        </button>
                      </div>
                      {operacao.ciclos.length === 0 ? (
                        <p style={{ margin: 0, color: "#7f90a8", fontSize: 12 }}>Nenhum ciclo vinculado a este agente.</p>
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
                                ? "pausado"
                                : !temExecucao
                                  ? "1ª execução…"
                                  : intervalMin != null
                                    ? `${Math.round(prog * 100)}% da volta`
                                    : "rodando";

                            return (
                              <div
                                key={String(row.id || row.nome)}
                                style={{
                                  display: "flex",
                                  gap: 14,
                                  alignItems: "stretch",
                                  background: "#101822",
                                  border: "1px solid #253042",
                                  borderRadius: 10,
                                  padding: "10px 12px",
                                }}
                              >
                                <CicloOperacionalAvatar
                                  tipoKey={tipoKey || "continuo"}
                                  accent={metaTipo.cor}
                                  progress01={prog}
                                  ativo={row.ativo !== false}
                                  aguardandoPrimeira={!temExecucao && row.ativo !== false}
                                  labelTimer={labelTimer}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <strong style={{ color: "#e6edf3", fontSize: 13 }}>{String(row.nome || "—")}</strong>
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
                                      gap: "4px 14px",
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
                                  {row.descricao && String(row.descricao).trim() ? (
                                    <p style={{ margin: "8px 0 0", fontSize: 10, color: "#64748b", lineHeight: 1.4 }}>
                                      {String(row.descricao).trim().slice(0, 120)}
                                      {String(row.descricao).trim().length > 120 ? "…" : ""}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <p style={{ color: "#c4d2e5", fontSize: 12, fontWeight: 700, margin: "14px 0 8px" }}>Últimas ações (IA)</p>
                      {operacao.acoes.length === 0 ? (
                        <p style={{ margin: 0, color: "#7f90a8", fontSize: 12 }}>Nenhuma linha em hub_acoes_ia ainda.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {operacao.acoes.map((a, i) => {
                            const row = a as {
                              id?: string;
                              tipo?: string;
                              descricao?: string;
                              sucesso?: boolean;
                              criado_em?: string;
                              lead_id?: string;
                            };
                            return (
                              <div
                                key={String(row.id || i)}
                                style={{
                                  borderLeft: `3px solid ${row.sucesso !== false ? "#15803d" : "#b91c1c"}`,
                                  padding: "8px 10px",
                                  background: "#101822",
                                  borderRadius: 6,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                  <strong style={{ color: "#d7e3f4", fontSize: 11 }}>{String(row.tipo || "ação")}</strong>
                                  <span style={{ color: "#7f90a8", fontSize: 10 }}>{tempoOpRelativo(row.criado_em)}</span>
                                </div>
                                <p style={{ margin: "6px 0 0", color: "#9cb0c9", fontSize: 11, lineHeight: 1.45 }}>
                                  {String(row.descricao || "").slice(0, 200)}
                                  {(row.descricao as string)?.length > 200 ? "…" : ""}
                                </p>
                                {row.lead_id && (
                                  <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 10 }}>Lead: {row.lead_id}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <p style={{ color: "#c4d2e5", fontSize: 12, fontWeight: 700, margin: "14px 0 4px" }}>
                        Execuções de ciclo
                      </p>
                      <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 10 }}>
                        Até 150 últimas linhas de hub_ciclos_log para este agente (painel; não substitui relatório completo).
                      </p>
                      {operacao.execucoes_ciclo.length === 0 ? (
                        <p style={{ margin: 0, color: "#7f90a8", fontSize: 12 }}>
                          Nenhuma execução em hub_ciclos_log ainda — comum antes da primeira corrida (cron ou webhook após resposta no WhatsApp).
                        </p>
                      ) : (
                        <div style={{ position: "relative", paddingLeft: 14 }}>
                          <div
                            style={{
                              position: "absolute",
                              left: 3,
                              top: 6,
                              bottom: 6,
                              width: 2,
                              borderRadius: 2,
                              background: "linear-gradient(180deg, #c9a24a55 0%, #2d394b 100%)",
                            }}
                          />
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {operacao.execucoes_ciclo.map((ex, i) => {
                              const row = ex as {
                                id?: string;
                                status?: string;
                                erro?: string;
                                iniciado_em?: string;
                                custo_brl?: number;
                                tokens_usados?: number;
                              };
                              const st = String(row.status || "—");
                              const stCor =
                                st === "erro"
                                  ? "#f87171"
                                  : st === "sucesso"
                                    ? "#86efac"
                                    : st === "sem_acao"
                                      ? "#94a3b8"
                                      : "#c9a24a";
                              const iso = row.iniciado_em;
                              const abs = iso && !Number.isNaN(new Date(String(iso)).getTime()) ? formatarData(String(iso)) : null;
                              const rel = tempoOpRelativo(iso ?? null);
                              return (
                                <div
                                  key={String(row.id || i)}
                                  style={{
                                    position: "relative",
                                    paddingLeft: 12,
                                    fontSize: 11,
                                    background: "#101822",
                                    borderRadius: 8,
                                    padding: "8px 10px 8px 14px",
                                    border: "1px solid #253042",
                                  }}
                                >
                                  <div
                                    style={{
                                      position: "absolute",
                                      left: -10,
                                      top: 12,
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: stCor,
                                      boxShadow: `0 0 0 2px #0d1117`,
                                    }}
                                  />
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline" }}>
                                    <span style={{ color: stCor, fontWeight: 700 }}>{st}</span>
                                    {abs ? (
                                      <time dateTime={String(iso)} style={{ color: "#c8d4e6", fontWeight: 600 }}>
                                        {abs}
                                      </time>
                                    ) : null}
                                    <span style={{ color: "#7f90a8" }}>{rel !== "—" ? `${rel} atrás` : "—"}</span>
                                    {row.tokens_usados != null && (
                                      <span style={{ color: "#64748b" }}>{row.tokens_usados} tok</span>
                                    )}
                                    {row.custo_brl != null && (
                                      <span style={{ color: "#64748b" }}>R$ {Number(row.custo_brl).toFixed(4)}</span>
                                    )}
                                  </div>
                                  {row.erro && (
                                    <p style={{ margin: "6px 0 0", color: "#f87171", fontSize: 10, lineHeight: 1.35 }}>
                                      {String(row.erro).slice(0, 160)}
                                      {String(row.erro).length > 160 ? "…" : ""}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ background: "#141d29", border: "1px solid #2c384b", borderRadius: 10, padding: 12 }}>
                    <p style={{ color: "#8ea1ba", fontSize: 11, margin: "0 0 8px", fontWeight: 700 }}>FIXO</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <input value={String(detailAgente.cargo || "-")} readOnly style={{ background: "#0f1620", border: "1px solid #2e3948", color: "#8ea1ba", borderRadius: 8, padding: "8px 10px", fontSize: 12 }} />
                      <input value={String(detailAgente.modelo_padrao || "-")} readOnly style={{ background: "#0f1620", border: "1px solid #2e3948", color: "#8ea1ba", borderRadius: 8, padding: "8px 10px", fontSize: 12 }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ color: "#d7e3f4", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Nome</label>
                    <input value={editNome} onChange={(e) => setEditNome(e.target.value)} style={{ width: "100%", background: "#121b27", border: "1px solid #314056", color: "#e6edf3", borderRadius: 8, padding: "9px 11px", fontSize: 13 }} />
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
                    <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} style={{ width: "100%", background: "#121b27", border: "1px solid #314056", color: "#e6edf3", borderRadius: 8, padding: "9px 11px", fontSize: 13, resize: "vertical" }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ color: "#d7e3f4", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Tom</label>
                      <input value={editTom} onChange={(e) => setEditTom(e.target.value)} style={{ width: "100%", background: "#121b27", border: "1px solid #314056", color: "#e6edf3", borderRadius: 8, padding: "9px 11px", fontSize: 13 }} />
                    </div>
                    <div>
                      <label style={{ color: "#d7e3f4", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>Estilo</label>
                      <input value={editEstilo} onChange={(e) => setEditEstilo(e.target.value)} style={{ width: "100%", background: "#121b27", border: "1px solid #314056", color: "#e6edf3", borderRadius: 8, padding: "9px 11px", fontSize: 13 }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ color: "#d7e3f4", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>System prompt base</label>
                    <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} rows={7} style={{ width: "100%", background: "#121b27", border: "1px solid #314056", color: "#e6edf3", borderRadius: 8, padding: "9px 11px", fontSize: 13, resize: "vertical", lineHeight: 1.5 }} />
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
              ) : (
                <div>
                  {logsErro && (
                    <div style={{ color: "#f87171", background: "#3a1518", border: "1px solid #7f1d1d", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 }}>
                      {logsErro}
                    </div>
                  )}
                  {logsLoading ? (
                    <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando logs...</p>
                  ) : logs.length === 0 ? (
                    <p style={{ color: "#8b949e", fontSize: 13 }}>Nenhum log encontrado para este agente.</p>
                  ) : (
                    <div style={{ position: "relative", paddingLeft: 18 }}>
                      <div style={{ position: "absolute", left: 5, top: 8, bottom: 8, width: 2, background: "#2f3d50" }} />
                      {logs.map((log, idx) => (
                        <div key={String(log.id || idx)} style={{ position: "relative", marginBottom: 14, padding: "10px 12px", borderRadius: 10, border: "1px solid #2d3a4d", background: "#131c28" }}>
                          <span style={{ position: "absolute", left: -17, top: 16, width: 10, height: 10, borderRadius: "50%", background: "#c9a24a", boxShadow: "0 0 0 2px #101722" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6, alignItems: "baseline" }}>
                            <strong style={{ color: "#d7e3f4", fontSize: 12 }}>{String(log.modelo_usado || "Modelo não informado")}</strong>
                            <span style={{ color: "#7f90a8", fontSize: 11 }}>{formatarData(String(log.criado_em || ""))}</span>
                          </div>
                          <p style={{ margin: "0 0 6px", color: "#9cb0c9", fontSize: 12, lineHeight: 1.5 }}>
                            <strong style={{ color: "#c4d2e5" }}>Usuário:</strong>{" "}
                            {String(log.mensagem_usuario || "").slice(0, 220) || "Sem mensagem registrada."}
                          </p>
                          <p style={{ margin: 0, color: "#9cb0c9", fontSize: 12, lineHeight: 1.5 }}>
                            <strong style={{ color: "#c4d2e5" }}>Resposta IA:</strong>{" "}
                            {String(log.resposta_ia || "").slice(0, 220) || "Sem resposta registrada."}
                          </p>
                          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {log.tempo_resposta_ms != null && (
                              <span style={{ color: "#7f90a8", fontSize: 11 }}>Latência: {String(log.tempo_resposta_ms)} ms</span>
                            )}
                            {log.tokens_input != null && (
                              <span style={{ color: "#7f90a8", fontSize: 11 }}>Input: {String(log.tokens_input)}</span>
                            )}
                            {log.tokens_output != null && (
                              <span style={{ color: "#7f90a8", fontSize: 11 }}>Output: {String(log.tokens_output)}</span>
                            )}
                            {log.custo_estimado_brl != null && (
                              <span style={{ color: "#7f90a8", fontSize: 11 }}>Custo: R$ {String(log.custo_estimado_brl)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

export default function AgentesPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0d1117", padding: 24, color: "#8b949e" }}>Carregando...</div>}>
      <AgentesView />
    </Suspense>
  );
}
