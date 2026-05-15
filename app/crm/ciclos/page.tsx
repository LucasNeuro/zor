"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import {
  buildFollowupMergePreview,
  estimarIntervaloMinutosCron,
  followupCompatibilidadeAvisos,
  type HubFollowupConfigLite,
} from "@/lib/hub-ciclos-configuracoes";
import { buildCronUtc, parseCronAgendaUi } from "@/lib/cron-agenda-ui";
import {
  agenteEhSomenteCanalWhatsapp,
  MODO_OPERACAO_LABEL,
  resolveModoOperacaoAgente,
  type ModoOperacaoAgente,
} from "@/lib/hub/agente-modo-operacao";
import {
  CRM_ENTITY_GRID,
  crmGlassCardSurface,
} from "@/lib/crm-glass-card";
import { CrmStickyTabs } from "@/components/crm/CrmStickyTabs";
import { CrmBotRingAvatar } from "@/components/crm/CrmBotRingAvatar";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import {
  Bell,
  ChevronRight,
  Clock,
  Pencil,
  Play,
  Power,
  RotateCcw,
  ScrollText,
  Sparkles,
  Trash2,
  Webhook,
  Zap,
} from "lucide-react";

interface Ciclo {
  id: string;
  agente_slug: string;
  nome: string;
  descricao: string;
  tipo: string;
  cron_expressao?: string;
  intervalo_minutos?: number;
  ativo: boolean;
  ultimo_ciclo?: string;
  ultimo_status?: string;
  total_execucoes: number;
  total_alertas_gerados: number;
  configuracoes: Record<string, unknown>;
}

type CicloTipo = "continuo" | "programado" | "gatilho";
type DrawerMode = "create" | "edit";
type ListMode = "todos" | "ativos" | "inativos";
type DrawerSubTab = "dados" | "timeline";

function proximaExecucao(cron?: string): string {
  if (!cron) return "—";
  const agora = new Date();
  const h = agora.getHours();
  if (cron === "*/2 * * * *") return "em 2 minutos";
  if (cron === "*/30 * * * *") return "em até 30 min";
  if (cron === "0 7 * * *") return "às 07h";
  if (cron === "0 8 * * *") return "às 08h";
  if (cron === "0 19 * * *") return "às 19h";
  if (cron === "0 */6 * * *") {
    const proxH = Math.ceil((h + 1) / 6) * 6;
    return `às ${proxH % 24}h`;
  }
  return cron;
}

const CRON_DIAS_SEMANA: { dow: number; abbr: string }[] = [
  { dow: 0, abbr: "Dom" },
  { dow: 1, abbr: "Seg" },
  { dow: 2, abbr: "Ter" },
  { dow: 3, abbr: "Qua" },
  { dow: 4, abbr: "Qui" },
  { dow: 5, abbr: "Sex" },
  { dow: 6, abbr: "Sáb" },
];

function resumoAgendamentoParaIa(opts: {
  fTipo: CicloTipo;
  fIntervalo: string;
  fCron: string;
  cronEditorLivre: boolean;
  cronMin: number;
  cronHr: number;
  cronDias: number[];
}): string {
  if (opts.fTipo === "continuo") {
    return `Contínuo; intervalo mínimo ${opts.fIntervalo.trim() || "?"} minutos entre execuções.`;
  }
  if (opts.fTipo === "gatilho") {
    return "Gatilho — só corre quando fila, webhook ou botão Executar dispara.";
  }
  if (opts.fTipo === "programado") {
    if (opts.cronEditorLivre) {
      return `Cron (UTC): ${opts.fCron.trim() || "(vazio)"}; intervalo mín. ${opts.fIntervalo.trim() || "?"} min.`;
    }
    const dias =
      opts.cronDias.length === 7
        ? "todos os dias"
        : opts.cronDias
            .map((d) => CRON_DIAS_SEMANA.find((x) => x.dow === d)?.abbr || d)
            .join(", ");
    return `UTC ${String(opts.cronHr).padStart(2, "0")}:${String(opts.cronMin).padStart(2, "0")}; ${dias}; intervalo mín. ${opts.fIntervalo.trim() || "?"} min.`;
  }
  return "";
}

function tempoRelativo(d?: string): string {
  if (!d) return "nunca";
  const diff = (Date.now() - new Date(d).getTime()) / 60000;
  if (diff < 1) return "agora";
  if (diff < 60) return `${Math.round(diff)}min atrás`;
  if (diff < 1440) return `${Math.round(diff / 60)}h atrás`;
  return `${Math.round(diff / 1440)}d atrás`;
}

const TIPO_COR: Record<string, string> = {
  /** Verde legível no fundo escuro (antes #003b26 parecia “apagado”). */
  continuo: "#4ade80",
  programado: "#c9a24a",
  gatilho: "#8b949e",
};

function cicloTipoIcon(tipo: string) {
  if (tipo === "gatilho") return Webhook;
  if (tipo === "continuo") return Zap;
  return Clock;
}

function slugParaApiCiclos(agenteSlug: string): string {
  if (agenteSlug === "diretor" || agenteSlug === "diretor_geral_ia" || agenteSlug === "diretor_operacoes") return "diretor";
  if (agenteSlug === "gerente_atendimento") return "gerente";
  return agenteSlug;
}

const STATUS_COR: Record<string, string> = {
  sucesso: "#4ade80",
  sem_acao: "#8b949e",
  erro: "#b3261e",
  rodando: "#c9a24a",
  nunca_executado: "#484f58",
};

/** Indica se o ciclo provavelmente usa o job de follow-up WhatsApp (nome ou configuracoes.dispatch). */
function cicloPareceFollowupWhatsApp(nome: string, cfg: Record<string, unknown>): boolean {
  if (/\bfollow|\bfup\b|followup|recupera|reengage|remarketing/i.test(nome)) return true;
  const d = cfg.dispatch;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const o = d as Record<string, unknown>;
    if (String(o.api ?? "").toLowerCase() === "atendente" && String(o.ciclo ?? "").toLowerCase() === "followup") {
      return true;
    }
  }
  return false;
}

export default function CiclosPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [ciclosTodos, setCiclosTodos] = useState<Ciclo[]>([]);
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [alertas, setAlertas] = useState<Record<string, unknown>[]>([]);
  const [aba, setAba] = useState<"ciclos" | "logs" | "alertas">("ciclos");
  const [modoLista, setModoLista] = useState<ListMode>("todos");
  const [busca, setBusca] = useState("");
  const [drawerSubTab, setDrawerSubTab] = useState<DrawerSubTab>("dados");
  const [timelineLogs, setTimelineLogs] = useState<Record<string, unknown>[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [executando, setExecutando] = useState<string | null>(null);
  const [alternandoCicloId, setAlternandoCicloId] = useState<string | null>(null);
  const [excluindoCicloId, setExcluindoCicloId] = useState<string | null>(null);
  const [erroListaCiclos, setErroListaCiclos] = useState<string | null>(null);
  const [dialogExcluirCiclo, setDialogExcluirCiclo] = useState<{ id: string; nome: string } | null>(null);
  const [dialogLimparCiclo, setDialogLimparCiclo] = useState<{ id: string; nome: string } | null>(null);
  const [cicloDialogBusy, setCicloDialogBusy] = useState(false);
  const [limpandoCicloId, setLimpandoCicloId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [selectedCicloId, setSelectedCicloId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erroDrawer, setErroDrawer] = useState<string | null>(null);
  const [fAgenteSlug, setFAgenteSlug] = useState("");
  const [fNome, setFNome] = useState("");
  const [fDescricao, setFDescricao] = useState("");
  const [fTipo, setFTipo] = useState<CicloTipo>("programado");
  const [fCron, setFCron] = useState("");
  const [cronEditorLivre, setCronEditorLivre] = useState(false);
  const [cronMin, setCronMin] = useState(0);
  const [cronHr, setCronHr] = useState(7);
  const [cronDias, setCronDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [sugestaoIaLoading, setSugestaoIaLoading] = useState<null | "descricao" | "followup">(null);
  const [fIntervalo, setFIntervalo] = useState("");
  const [fAtivo, setFAtivo] = useState(true);
  /** Chaves além de follow-up preservadas ao salvar (sem exibir JSON). */
  const [extraConfig, setExtraConfig] = useState<Record<string, unknown>>({});
  const [fHorasFollowup, setFHorasFollowup] = useState("2, 24, 48");
  const [fArquivarAposDias, setFArquivarAposDias] = useState("7");
  /** Mostrar bloco de follow-up mesmo quando o nome/config não sugerem follow-up. */
  const [followupAvancadoForcado, setFollowupAvancadoForcado] = useState(false);
  /** Follow-up avançado: fechado por defeito para não sobrecarregar o formulário. */
  const [followupDetailsAberto, setFollowupDetailsAberto] = useState(false);
  /** Agendamento (modo, intervalo, cron): aberto por defeito. */
  const [agendaDetailsAberto, setAgendaDetailsAberto] = useState(true);
  const [followupHubRows, setFollowupHubRows] = useState<HubFollowupConfigLite[]>([]);
  const [followupHubLoading, setFollowupHubLoading] = useState(false);
  const [followupHubError, setFollowupHubError] = useState<string | null>(null);
  const [previewMercado, setPreviewMercado] = useState("geral");
  const [agentesHub, setAgentesHub] = useState<
    Array<{ agente_slug: string; modo_operacao?: unknown; ciclo_execucao_padrao?: unknown }>
  >([]);

  function aplicarConfigNoForm(cfg: Record<string, unknown> | undefined) {
    const c = cfg && typeof cfg === "object" && !Array.isArray(cfg) ? cfg : {};
    const horasRaw = c.horas_followup;
    const horas = Array.isArray(horasRaw)
      ? horasRaw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 0)
      : [];
    setFHorasFollowup(horas.length > 0 ? horas.join(", ") : "2, 24, 48");
    const diasRaw = c.arquivar_apos_dias;
    const dias = typeof diasRaw === "number" ? diasRaw : Number.parseInt(String(diasRaw ?? ""), 10);
    setFArquivarAposDias(Number.isFinite(dias) && dias > 0 ? String(dias) : "7");
    const rest = { ...c };
    delete rest.horas_followup;
    delete rest.arquivar_apos_dias;
    setExtraConfig(rest);
  }

  function montarConfiguracoesPayload(): Record<string, unknown> {
    const horas = fHorasFollowup
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 0);
    const dias = Number.parseInt(fArquivarAposDias.trim(), 10);
    return {
      ...extraConfig,
      horas_followup: horas.length > 0 ? horas : [2, 24, 48],
      arquivar_apos_dias: Number.isFinite(dias) && dias > 0 ? dias : 7,
    };
  }

  const contadores = useMemo(() => {
    const ativosN = ciclosTodos.filter((c) => c.ativo).length;
    return {
      todos: ciclosTodos.length,
      ativos: ativosN,
      inativos: ciclosTodos.length - ativosN,
    };
  }, [ciclosTodos]);

  const ciclosFiltrados = useMemo(() => {
    let list = ciclosTodos;
    if (modoLista === "ativos") list = list.filter((c) => c.ativo);
    if (modoLista === "inativos") list = list.filter((c) => !c.ativo);
    const q = busca.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          String(c.agente_slug || "")
            .toLowerCase()
            .includes(q) ||
          (c.descricao && String(c.descricao).toLowerCase().includes(q))
      );
    }
    return list;
  }, [ciclosTodos, modoLista, busca]);

  const carregar = useCallback(async () => {
    const [cRes, l, a, agRes] = await Promise.all([
      fetch("/api/hub/ciclos", { headers: internalApiHeaders() }),
      fetch("/api/hub/ciclos-log?limit=20", { headers: internalApiHeaders() }),
      fetch("/api/hub/alertas?resolvido=false&limit=30", { headers: internalApiHeaders() }),
      fetch("/api/hub/agentes?todos=true", { headers: internalApiHeaders() }),
    ]);

    if (cRes.ok) {
      const cJson = await cRes.json() as { ciclos?: Ciclo[] };
      setCiclosTodos(Array.isArray(cJson.ciclos) ? cJson.ciclos : []);
    } else {
      setCiclosTodos([]);
    }
    if (agRes.ok) {
      const agJson = (await agRes.json()) as unknown;
      setAgentesHub(Array.isArray(agJson) ? (agJson as typeof agentesHub) : []);
    } else {
      setAgentesHub([]);
    }
    if (l.ok) {
      const j = await l.json() as { logs?: Record<string, unknown>[] };
      setLogs(Array.isArray(j.logs) ? j.logs : []);
    } else {
      setLogs([]);
    }
    if (a.ok) {
      const j = await a.json() as { alertas?: Record<string, unknown>[] };
      setAlertas(Array.isArray(j.alertas) ? j.alertas : []);
    } else {
      setAlertas([]);
    }
  }, []);

  useEffect(() => { carregar(); }, [aba, carregar]);

  useEffect(() => {
    if (!drawerOpen || drawerMode !== "edit" || !selectedCicloId || drawerSubTab !== "timeline") {
      return;
    }
    let cancelled = false;
    setTimelineLoading(true);
    fetch(`/api/hub/ciclos-log?ciclo_id=${encodeURIComponent(selectedCicloId)}&limit=50`, {
      headers: internalApiHeaders(),
    })
      .then(async (res) => {
        const j = (await res.json()) as { logs?: Record<string, unknown>[] };
        if (!cancelled && res.ok) setTimelineLogs(Array.isArray(j.logs) ? j.logs : []);
        else if (!cancelled) setTimelineLogs([]);
      })
      .catch(() => {
        if (!cancelled) setTimelineLogs([]);
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [drawerOpen, drawerMode, selectedCicloId, drawerSubTab]);

  useEffect(() => {
    if (!drawerOpen || drawerSubTab !== "dados") return;
    let cancelled = false;
    setFollowupHubLoading(true);
    setFollowupHubError(null);
    fetch("/api/hub/followup-config", { headers: internalApiHeaders() })
      .then(async (res) => {
        const j = (await res.json()) as { rows?: HubFollowupConfigLite[]; error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(j.error || "Falha ao carregar hub_followup_config.");
        setFollowupHubRows(Array.isArray(j.rows) ? j.rows : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setFollowupHubError(e instanceof Error ? e.message : "Erro ao carregar config.");
          setFollowupHubRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setFollowupHubLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [drawerOpen, drawerSubTab]);

  useEffect(() => {
    if (fTipo !== "programado" || cronEditorLivre) return;
    setFCron(buildCronUtc(cronMin, cronHr, cronDias));
  }, [fTipo, cronEditorLivre, cronMin, cronHr, cronDias]);

  useEffect(() => {
    if (followupHubRows.length === 0) return;
    setPreviewMercado((prev) => {
      const mercados = [...new Set(followupHubRows.map((r) => r.mercado))];
      if (mercados.includes(prev)) return prev;
      if (mercados.includes("geral")) return "geral";
      return mercados.sort((a, b) => a.localeCompare(b))[0] || "geral";
    });
  }, [followupHubRows]);

  const horasListaPreview = useMemo(() => {
    const parts = fHorasFollowup.split(",").map((s) => Number.parseInt(s.trim(), 10));
    const cleaned = parts.filter((n) => Number.isFinite(n) && n >= 1);
    return cleaned.length > 0 ? cleaned : null;
  }, [fHorasFollowup]);

  const mercadosPreviewOptions = useMemo(() => {
    const s = new Set(followupHubRows.map((r) => r.mercado));
    return [...s].sort((a, b) => {
      if (a === "geral") return -1;
      if (b === "geral") return 1;
      return a.localeCompare(b);
    });
  }, [followupHubRows]);

  const mergePreviewLinhas = useMemo(
    () => buildFollowupMergePreview(followupHubRows, previewMercado, horasListaPreview),
    [followupHubRows, previewMercado, horasListaPreview]
  );

  const followupCompat = useMemo(
    () =>
      followupCompatibilidadeAvisos(mergePreviewLinhas, horasListaPreview, {
        intervaloMinutos: estimarIntervaloMinutosCron(fIntervalo, fCron),
      }),
    [mergePreviewLinhas, horasListaPreview, fIntervalo, fCron]
  );

  const followupHeuristica = useMemo(
    () => cicloPareceFollowupWhatsApp(fNome, extraConfig),
    [fNome, extraConfig]
  );
  const mostrarBlocoFollowup = followupAvancadoForcado || followupHeuristica;

  const modoOperacaoDrawer = useMemo((): ModoOperacaoAgente | null => {
    const slug = fAgenteSlug.trim();
    if (!slug) return null;
    const row = agentesHub.find((a) => a.agente_slug === slug);
    const ciclosDoAgente = ciclosTodos.filter((c) => c.agente_slug === slug);
    return resolveModoOperacaoAgente(row, ciclosDoAgente);
  }, [fAgenteSlug, agentesHub, ciclosTodos]);

  const agenteSomenteCanalWa = agenteEhSomenteCanalWhatsapp(modoOperacaoDrawer);
  const esconderAgendamentoCron =
    agenteSomenteCanalWa && drawerSubTab === "dados" && !mostrarBlocoFollowup;

  useEffect(() => {
    if (!drawerOpen || drawerMode !== "create" || !agenteSomenteCanalWa || mostrarBlocoFollowup) return;
    if (fTipo !== "gatilho") setFTipo("gatilho");
  }, [drawerOpen, drawerMode, agenteSomenteCanalWa, mostrarBlocoFollowup, fTipo]);

  const minMergeHorasDisparo = useMemo(() => {
    if (mergePreviewLinhas.length === 0) return null;
    return Math.min(...mergePreviewLinhas.map((p) => p.mergeHoras));
  }, [mergePreviewLinhas]);

  useEffect(() => {
    if (!drawerOpen) setFollowupAvancadoForcado(false);
  }, [drawerOpen]);

  function aplicarIntervaloNaoMaiorQueMenorMerge() {
    if (minMergeHorasDisparo == null || minMergeHorasDisparo <= 0) return;
    const capMin = minMergeHorasDisparo * 60;
    const cur = Number.parseInt(String(fIntervalo).trim(), 10);
    const next =
      Number.isFinite(cur) && cur > 0 ? Math.min(cur, capMin) : capMin;
    setFIntervalo(String(Math.max(1, Math.trunc(next))));
  }

  function preencherHorasDoHubNoForm() {
    const base = buildFollowupMergePreview(followupHubRows, previewMercado, null);
    if (base.length === 0) return;
    setFHorasFollowup(base.map((p) => String(p.hubHoras)).join(", "));
  }

  async function carregarLogsEAlertas() {
    const [l, a] = await Promise.all([
      fetch("/api/hub/ciclos-log?limit=20", { headers: internalApiHeaders() }),
      fetch("/api/hub/alertas?resolvido=false&limit=30", { headers: internalApiHeaders() }),
    ]);
    if (l.ok) {
      const j = await l.json() as { logs?: Record<string, unknown>[] };
      setLogs(Array.isArray(j.logs) ? j.logs : []);
    }
    if (a.ok) {
      const j = await a.json() as { alertas?: Record<string, unknown>[] };
      setAlertas(Array.isArray(j.alertas) ? j.alertas : []);
    }
  }

  async function toggleCiclo(id: string, ativo: boolean) {
    setAlternandoCicloId(id);
    try {
      await fetch(`/api/hub/ciclos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ ativo }),
      });
      await carregar();
    } finally {
      setAlternandoCicloId(null);
    }
  }

  function limparAgendamentoCiclo(ciclo: Ciclo, e: React.MouseEvent) {
    e.stopPropagation();
    setDialogLimparCiclo({ id: ciclo.id, nome: ciclo.nome });
  }

  function excluirCicloDoCard(ciclo: Ciclo, e: React.MouseEvent) {
    e.stopPropagation();
    setDialogExcluirCiclo({ id: ciclo.id, nome: ciclo.nome });
  }

  async function confirmarLimparAgendamentoCiclo() {
    const d = dialogLimparCiclo;
    if (!d) return;
    setCicloDialogBusy(true);
    setErroListaCiclos(null);
    setLimpandoCicloId(d.id);
    try {
      const res = await fetch(`/api/hub/ciclos/${encodeURIComponent(d.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ cron_expressao: "", intervalo_minutos: null }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErroListaCiclos(json.error || `Erro ${res.status} ao limpar agendamento.`);
        return;
      }
      setDialogLimparCiclo(null);
      await carregar();
    } finally {
      setCicloDialogBusy(false);
      setLimpandoCicloId(null);
    }
  }

  async function confirmarExcluirCicloModal() {
    const d = dialogExcluirCiclo;
    if (!d) return;
    setCicloDialogBusy(true);
    setErroListaCiclos(null);
    setErroDrawer(null);
    setExcluindoCicloId(d.id);
    try {
      const res = await fetch(`/api/hub/ciclos/${encodeURIComponent(d.id)}`, {
        method: "DELETE",
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const msg = json.error || `Erro ${res.status} ao excluir.`;
        setErroListaCiclos(msg);
        setErroDrawer(msg);
        return;
      }
      setDialogExcluirCiclo(null);
      if (selectedCicloId === d.id) {
        setDrawerOpen(false);
        setSelectedCicloId(null);
      }
      await carregar();
    } finally {
      setCicloDialogBusy(false);
      setExcluindoCicloId(null);
    }
  }

  async function executarAgora(ciclo: Ciclo) {
    setExecutando(ciclo.id);
    const agente = slugParaApiCiclos(ciclo.agente_slug);
    const nome = ciclo.nome.toLowerCase();
    const nomeCiclo = nome.includes("follow") ? "followup"
      : nome.includes("sla") ? "sla"
      : nome.includes("manha") || nome.includes("matinal") ? ciclo.agente_slug === "gerente_atendimento" ? "relatorio_manha" : "analise_manha"
      : nome.includes("noite") ? "analise_noite"
      : nome.includes("tráfego") || nome.includes("trafego") ? "trafego"
      : nome.includes("supervis") ? "supervisao"
      : "followup";

    try {
      await fetch(
        `/api/ciclos/${agente}?ciclo=${nomeCiclo}&hub_ciclo_id=${encodeURIComponent(ciclo.id)}&secret=obra10plus_cron_2026`,
        {
        headers: internalApiHeaders(),
        }
      );
    } catch (e) { console.error(e); }

    await carregarLogsEAlertas();
    await carregar();
    setExecutando(null);
  }

  async function resolverAlerta(id: string) {
    await fetch(`/api/hub/alertas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ resolvido: true, resolvido_em: new Date().toISOString() }),
    });
    carregar();
  }

  function toggleCronDia(dow: number) {
    setCronDias((prev) => {
      const s = new Set(prev);
      if (s.has(dow)) {
        s.delete(dow);
        if (s.size === 0) s.add(dow);
      } else {
        s.add(dow);
      }
      return [...s].sort((a, b) => a - b);
    });
  }

  async function sugerirDescricaoComIa() {
    if (!fNome.trim() || !fAgenteSlug.trim()) {
      setErroDrawer("Preencha nome e agente slug para gerar a descrição.");
      return;
    }
    setErroDrawer(null);
    setSugestaoIaLoading("descricao");
    try {
      const res = await fetch("/api/hub/ciclos/sugerir-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          acao: "descricao",
          nome: fNome.trim(),
          agente_slug: fAgenteSlug.trim(),
          tipo_ciclo: fTipo,
          cron_resumo: resumoAgendamentoParaIa({
            fTipo,
            fIntervalo,
            fCron,
            cronEditorLivre,
            cronMin,
            cronHr,
            cronDias,
          }),
          texto_atual: fDescricao.trim() || undefined,
        }),
      });
      const j = (await res.json()) as { texto?: string; error?: string };
      if (!res.ok) throw new Error(j.error || "Falha ao gerar.");
      if (!j.texto?.trim()) throw new Error("Resposta vazia.");
      setFDescricao(j.texto.trim());
    } catch (e) {
      setErroDrawer(e instanceof Error ? e.message : "Erro ao gerar descrição.");
    } finally {
      setSugestaoIaLoading(null);
    }
  }

  async function sugerirFollowupComIa() {
    if (!fNome.trim() || !fAgenteSlug.trim()) {
      setErroDrawer("Preencha nome e agente slug.");
      return;
    }
    setErroDrawer(null);
    setSugestaoIaLoading("followup");
    try {
      const res = await fetch("/api/hub/ciclos/sugerir-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          acao: "followup",
          nome: fNome.trim(),
          agente_slug: fAgenteSlug.trim(),
          descricao: fDescricao.trim() || undefined,
        }),
      });
      const j = (await res.json()) as {
        horas_followup?: string;
        arquivar_apos_dias?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error || "Falha ao sugerir follow-up.");
      if (typeof j.horas_followup === "string") setFHorasFollowup(j.horas_followup);
      if (typeof j.arquivar_apos_dias === "number") {
        setFArquivarAposDias(String(j.arquivar_apos_dias));
      }
    } catch (e) {
      setErroDrawer(e instanceof Error ? e.message : "Erro ao sugerir follow-up.");
    } finally {
      setSugestaoIaLoading(null);
    }
  }

  function resetForm() {
    setSelectedCicloId(null);
    setFAgenteSlug("");
    setFNome("");
    setFDescricao("");
    setFTipo("programado");
    setFCron("");
    setCronEditorLivre(false);
    setCronMin(0);
    setCronHr(7);
    setCronDias([1, 2, 3, 4, 5]);
    setSugestaoIaLoading(null);
    setFIntervalo("");
    setFAtivo(true);
    aplicarConfigNoForm({});
    setErroDrawer(null);
    setFormLoading(false);
    setFollowupAvancadoForcado(false);
    setFollowupDetailsAberto(false);
    setAgendaDetailsAberto(true);
  }

  function abrirNovoCiclo() {
    resetForm();
    setDrawerMode("create");
    setDrawerSubTab("dados");
    setDrawerOpen(true);
  }

  async function abrirEditarCiclo(cicloId: string) {
    resetForm();
    setDrawerMode("edit");
    setDrawerSubTab("dados");
    setDrawerOpen(true);
    setSelectedCicloId(cicloId);
    setFormLoading(true);
    try {
      const res = await fetch(`/api/hub/ciclos/${encodeURIComponent(cicloId)}`, {
        headers: internalApiHeaders(),
      });
      const json = await res.json() as Ciclo | { error?: string };
      if (!res.ok || !("id" in json)) {
        throw new Error("error" in json ? json.error : "Falha ao carregar ciclo.");
      }
      const ciclo = json as Ciclo;
      setFAgenteSlug(ciclo.agente_slug || "");
      setFNome(ciclo.nome || "");
      setFDescricao(ciclo.descricao || "");
      setFTipo((ciclo.tipo as CicloTipo) || "programado");
      const rawCron = (ciclo.cron_expressao || "").trim();
      setFCron(rawCron);
      const parsed = rawCron ? parseCronAgendaUi(rawCron) : null;
      if (parsed) {
        setCronMin(parsed.minute);
        setCronHr(parsed.hour);
        setCronDias(parsed.daysOfWeek);
        setCronEditorLivre(false);
      } else if (rawCron) {
        setCronEditorLivre(true);
      } else {
        setCronEditorLivre(false);
        setCronMin(0);
        setCronHr(7);
        setCronDias([1, 2, 3, 4, 5]);
      }
      setFIntervalo(ciclo.intervalo_minutos != null ? String(ciclo.intervalo_minutos) : "");
      setFAtivo(ciclo.ativo !== false);
      aplicarConfigNoForm(ciclo.configuracoes as Record<string, unknown> | undefined);
    } catch (e) {
      setErroDrawer(e instanceof Error ? e.message : "Erro ao abrir ciclo.");
    } finally {
      setFormLoading(false);
    }
  }

  async function salvarCiclo() {
    if (!fAgenteSlug.trim() || !fNome.trim()) {
      setErroDrawer("Preencha agente e nome.");
      return;
    }
    setSaving(true);
    setErroDrawer(null);
    try {
      const configuracoes = montarConfiguracoesPayload();
      const tipoSalvar =
        esconderAgendamentoCron ? ("gatilho" as const) : fTipo;
      const payload = {
        agente_slug: fAgenteSlug.trim(),
        nome: fNome.trim(),
        descricao: fDescricao.trim(),
        tipo: tipoSalvar,
        cron_expressao: tipoSalvar === "gatilho" ? "" : fCron.trim(),
        intervalo_minutos: fIntervalo.trim() ? Number.parseInt(fIntervalo, 10) : null,
        ativo: fAtivo,
        configuracoes,
      };
      const url =
        drawerMode === "create" || !selectedCicloId
          ? "/api/hub/ciclos"
          : `/api/hub/ciclos/${encodeURIComponent(selectedCicloId)}`;
      const method = drawerMode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Falha ao salvar ciclo.");
      }
      setDrawerOpen(false);
      await carregar();
    } catch (e) {
      setErroDrawer(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function pedirExcluirCicloNoDrawer() {
    if (!selectedCicloId) return;
    setDialogExcluirCiclo({ id: selectedCicloId, nome: fNome.trim() || "Ciclo" });
  }

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={abrirNovoCiclo}
            className="rounded px-2 py-1 font-semibold"
            style={{ background: "#21262d", color: "#c9a24a", border: "1px solid #30363d" }}
          >
            Novo ciclo
          </button>
          <span className="rounded px-2 py-1" style={{ background: "#003b2630", color: "#c9a24a" }}>
            {contadores.ativos} ativos
          </span>
          <span
            className="rounded px-2 py-1"
            style={{
              background: alertas.length > 0 ? "#b3261e30" : "#21262d",
              color: alertas.length > 0 ? "#b3261e" : "#8b949e",
            }}
          >
            {alertas.length} alertas
          </span>
        </div>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, contadores.ativos, alertas]);

  return (
    <>
    <div style={{ background: "#0d1117", minHeight: "100vh" }}>
      <CrmStickyTabs
        activeId={aba}
        onChange={(id) => setAba(id as typeof aba)}
        tabs={[
          { id: "ciclos", label: `Ciclos (${contadores.todos})`, icon: Zap },
          { id: "logs", label: `Logs (${logs.length})`, icon: ScrollText },
          { id: "alertas", label: `Alertas (${alertas.length})`, icon: Bell },
        ]}
      />

      <div style={{ padding: 24 }}>
        {aba === "ciclos" && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#8b949e",
                  margin: "0 0 10px",
                  letterSpacing: 0.5,
                }}
              >
                LISTA
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {(
                  [
                    { id: "todos" as const, label: "Todos", count: contadores.todos },
                    { id: "ativos" as const, label: "Ativos", count: contadores.ativos },
                    { id: "inativos" as const, label: "Inativos", count: contadores.inativos },
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
                      {opt.label} ({opt.count})
                    </button>
                  );
                })}
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar nome ou agente…"
                  style={{
                    marginLeft: 8,
                    minWidth: 200,
                    padding: "8px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    background: "#121923",
                    border: "1px solidrgb(13, 13, 13)",
                    color: "#e6edf3",
                  }}
                />
                {ciclosTodos.length > 0 && (
                  <span style={{ fontSize: 12, color: "#708096", marginLeft: 6 }}>
                    mostrando: {ciclosFiltrados.length} ciclo{ciclosFiltrados.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>

            {erroListaCiclos && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "12px 14px",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: "rgba(179, 38, 30, 0.45)",
                  background: "rgba(179, 38, 30, 0.12)",
                  color: "#ffb4ab",
                  fontSize: 13,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <span style={{ lineHeight: 1.45 }}>{erroListaCiclos}</span>
                <button
                  type="button"
                  onClick={() => setErroListaCiclos(null)}
                  style={{
                    flexShrink: 0,
                    background: "transparent",
                    border: "none",
                    color: "#ffb4ab",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Fechar
                </button>
              </div>
            )}

            {ciclosTodos.length === 0 && (
              <p style={{ color: "#8b949e", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
                Nenhum ciclo cadastrado
              </p>
            )}
            {ciclosTodos.length > 0 && ciclosFiltrados.length === 0 && (
              <p style={{ color: "#8b949e", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
                Nenhum ciclo corresponde à busca
              </p>
            )}
            {ciclosFiltrados.length > 0 && (
              <div style={CRM_ENTITY_GRID}>
                {ciclosFiltrados.map((c) => {
                  const tipoCor = TIPO_COR[c.tipo] || "#3b82f6";
                  const st = c.ultimo_status || "nunca_executado";
                  const stCor = STATUS_COR[st] || "#8b949e";
                  const ativo = c.ativo !== false;
                  const selecionado = drawerOpen && selectedCicloId === c.id;
                  const execProgress =
                    c.total_execucoes > 0
                      ? Math.min(0.92, 0.18 + Math.min(c.total_execucoes, 9) * 0.08)
                      : null;

                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => void abrirEditarCiclo(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void abrirEditarCiclo(c.id);
                        }
                      }}
                      style={{
                        ...crmGlassCardSurface(selecionado),
                        opacity: ativo ? 1 : 0.88,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <CrmBotRingAvatar
                          pixelSize={44}
                          accent={tipoCor}
                          Icon={cicloTipoIcon(c.tipo)}
                          progress={execProgress}
                          pulse={!c.ultimo_ciclo}
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
                            {c.nome}
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
                            {c.agente_slug}
                          </p>
                        </div>
                      </div>

                      <p
                        style={{
                          fontSize: 12,
                          color: "#cbd5e1",
                          margin: 0,
                          lineHeight: 1.45,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {c.descricao?.trim() || "—"}
                      </p>

                      <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                        Última exec.: {tempoRelativo(c.ultimo_ciclo)} · {proximaExecucao(c.cron_expressao)} ·{" "}
                        {c.total_execucoes} exec.
                        {c.total_alertas_gerados > 0 ? (
                          <span style={{ color: "#c9a24a" }}> · {c.total_alertas_gerados} alertas</span>
                        ) : null}
                      </p>

                      <div style={{ fontSize: 11, color: "#64748b", margin: 0 }}>
                        <span style={{ color: tipoCor, fontWeight: 600 }}>{c.tipo}</span>
                        {" · "}
                        <span style={{ color: stCor }}>{st.replace(/_/g, " ")}</span>
                      </div>

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
                          aria-label="Ações do ciclo"
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
                            onClick={(e) => {
                              e.stopPropagation();
                              void executarAgora(c);
                            }}
                            disabled={executando === c.id || !c.ativo}
                            title={c.ativo ? "Executar agora" : "Ative o ciclo para executar"}
                            aria-label="Executar ciclo agora"
                            style={{
                              width: 32,
                              height: 28,
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              border: 0,
                              boxShadow: "inset -1px 0 0 rgba(44, 56, 75, 0.95)",
                              cursor: executando === c.id || !c.ativo ? "not-allowed" : "pointer",
                              opacity: executando === c.id || !c.ativo ? 0.45 : 1,
                              background: c.ativo ? "rgba(34, 197, 94, 0.12)" : "rgba(72, 79, 88, 0.2)",
                              color: c.ativo ? "#4ade80" : "#64748b",
                            }}
                          >
                            {executando === c.id ? (
                              <span style={{ fontSize: 11, fontWeight: 700 }}>…</span>
                            ) : (
                              <Play size={13} strokeWidth={2.25} aria-hidden />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void abrirEditarCiclo(c.id);
                            }}
                            disabled={!!excluindoCicloId}
                            title="Editar ciclo"
                            aria-label="Editar ciclo"
                            style={{
                              width: 32,
                              height: 28,
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              border: 0,
                              boxShadow: "inset -1px 0 0 rgba(44, 56, 75, 0.95)",
                              cursor: excluindoCicloId ? "not-allowed" : "pointer",
                              opacity: excluindoCicloId ? 0.45 : 1,
                              background: "rgba(30, 41, 59, 0.65)",
                              color: "#c9a24a",
                            }}
                          >
                            <Pencil size={13} strokeWidth={2.25} aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => void limparAgendamentoCiclo(c, e)}
                            disabled={limpandoCicloId === c.id || excluindoCicloId === c.id}
                            title="Limpar cron e intervalo"
                            aria-label="Limpar agendamento do ciclo"
                            style={{
                              width: 32,
                              height: 28,
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              border: 0,
                              boxShadow: "inset -1px 0 0 rgba(44, 56, 75, 0.95)",
                              cursor:
                                limpandoCicloId === c.id || excluindoCicloId === c.id ? "not-allowed" : "pointer",
                              opacity: limpandoCicloId === c.id || excluindoCicloId === c.id ? 0.45 : 1,
                              background: "rgba(201, 162, 74, 0.12)",
                              color: "#d6b876",
                            }}
                          >
                            {limpandoCicloId === c.id ? (
                              <span style={{ fontSize: 11, fontWeight: 700 }}>…</span>
                            ) : (
                              <RotateCcw size={13} strokeWidth={2.25} aria-hidden />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleCiclo(c.id, !ativo);
                            }}
                            disabled={alternandoCicloId === c.id || excluindoCicloId === c.id}
                            title={ativo ? "Desativar ciclo" : "Ativar ciclo"}
                            aria-label={ativo ? "Desativar ciclo" : "Ativar ciclo"}
                            style={{
                              width: 32,
                              height: 28,
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              border: 0,
                              boxShadow: "inset -1px 0 0 rgba(44, 56, 75, 0.95)",
                              cursor:
                                alternandoCicloId === c.id || excluindoCicloId === c.id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity: alternandoCicloId === c.id || excluindoCicloId === c.id ? 0.45 : 1,
                              background: ativo ? "rgba(34, 197, 94, 0.1)" : "rgba(248, 113, 113, 0.08)",
                              color: ativo ? "#4ade80" : "#f87171",
                            }}
                          >
                            {alternandoCicloId === c.id ? (
                              <span style={{ fontSize: 11, fontWeight: 700 }}>…</span>
                            ) : (
                              <Power size={13} strokeWidth={2.25} aria-hidden />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => void excluirCicloDoCard(c, e)}
                            disabled={excluindoCicloId === c.id || alternandoCicloId === c.id}
                            title="Excluir ciclo"
                            aria-label="Excluir ciclo"
                            style={{
                              width: 32,
                              height: 28,
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              border: 0,
                              boxShadow: "none",
                              cursor:
                                excluindoCicloId === c.id || alternandoCicloId === c.id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity: excluindoCicloId === c.id || alternandoCicloId === c.id ? 0.45 : 1,
                              background: "rgba(127, 29, 29, 0.22)",
                              color: "#fca5a5",
                            }}
                          >
                            {excluindoCicloId === c.id ? (
                              <span style={{ fontSize: 11, fontWeight: 700 }}>…</span>
                            ) : (
                              <Trash2 size={13} strokeWidth={2.25} aria-hidden />
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
        )}

        {aba === "logs" && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: "#484f58" }}>Nenhuma execução registrada ainda</p>
            ) : logs.map(l => (
              <div key={l.id as string} className="rounded-xl p-3" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white font-bold text-sm">{l.agente_slug as string}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${STATUS_COR[l.status as string] || "#8b949e"}30`, color: STATUS_COR[l.status as string] || "#8b949e" }}>
                    {l.status as string}
                  </span>
                </div>
                <p className="text-xs" style={{ color: "#8b949e" }}>{tempoRelativo(l.iniciado_em as string)}</p>
                {typeof l.erro === "string" && <p className="text-xs mt-1" style={{ color: "#b3261e" }}>{l.erro}</p>}
                {Array.isArray(l.acoes_tomadas) && (l.acoes_tomadas as string[]).length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {(l.acoes_tomadas as string[]).slice(0, 3).map((a, i) => (
                      <p key={i} className="text-xs" style={{ color: "#484f58" }}>• {a}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {aba === "alertas" && (
          <div className="space-y-2">
            {alertas.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-2xl mb-2">✓</p>
                <p className="font-bold" style={{ color: "#e6edf3" }}>Nenhum alerta pendente</p>
                <p className="text-xs mt-1" style={{ color: "#484f58" }}>Operação saudável</p>
              </div>
            ) : alertas.map(a => {
              const cor = a.tipo === "critico" ? "#b3261e" : a.tipo === "importante" ? "#c9a24a" : a.tipo === "sugestao" ? "#003b26" : "#8b949e";
              return (
                <div key={a.id as string} className="rounded-xl p-3"
                  style={{
                    background: "#161b22",
                    borderTop: `1px solid ${cor}44`,
                    borderRight: `1px solid ${cor}44`,
                    borderBottom: `1px solid ${cor}44`,
                    borderLeft: `3px solid ${cor}`,
                  }}>
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ background: `${cor}22`, color: cor }}>{a.tipo as string}</span>
                        <span className="text-xs" style={{ color: "#484f58" }}>{a.agente_slug as string}</span>
                      </div>
                      <p className="text-white font-bold text-sm">{a.titulo as string}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#8b949e" }}>{a.mensagem as string}</p>
                    </div>
                    <button onClick={() => resolverAlerta(a.id as string)}
                      className="ml-2 text-xs px-2 py-1 rounded-lg flex-shrink-0"
                      style={{ background: "#21262d", color: "#c9a24a", border: "none", cursor: "pointer" }}>
                      Resolver
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: "#484f58" }}>{tempoRelativo(a.criado_em as string)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: "rgba(1,4,9,0.5)", backdropFilter: "blur(2px)" }}
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="h-full w-full max-w-xl border-l p-4 overflow-auto"
            style={{ background: "#0d1117", borderColor: "#30363d" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs uppercase" style={{ color: "#8b949e" }}>
                  {drawerMode === "create" ? "Novo ciclo" : "Editar ciclo"}
                </p>
                <h2 className="text-lg font-semibold text-white">
                  {drawerMode === "create" ? "Criar ciclo IA" : fNome || "Ciclo IA"}
                </h2>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-sm px-2 py-1 rounded"
                style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30363d" }}
              >
                Fechar
              </button>
            </div>

            {formLoading ? (
              <p className="text-sm" style={{ color: "#8b949e" }}>Carregando...</p>
            ) : (
              <>
                {drawerMode === "edit" && selectedCicloId && (
                  <div
                    className="mb-4 flex w-full overflow-hidden rounded-lg"
                    style={{ border: "1px solid #30363d" }}
                  >
                    {(["dados", "timeline"] as const).map((tab, i) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setDrawerSubTab(tab)}
                        className="min-h-[36px] flex-1 text-xs font-bold px-3 py-2"
                        style={{
                          margin: 0,
                          borderRadius: 0,
                          border: "none",
                          borderLeft: i > 0 ? "1px solid #30363d" : "none",
                          background: drawerSubTab === tab ? "#1b2532" : "#161b22",
                          color: drawerSubTab === tab ? "#c9a24a" : "#8b949e",
                          cursor: "pointer",
                          textTransform: tab === "timeline" ? "none" : "capitalize",
                        }}
                      >
                        {tab === "dados" ? "Dados" : "Timeline"}
                      </button>
                    ))}
                  </div>
                )}

                {drawerMode === "edit" && drawerSubTab === "timeline" && selectedCicloId ? (
                  <div className="space-y-2">
                    <p className="text-xs" style={{ color: "#8b949e" }}>
                      Execuções registradas em <code style={{ color: "#c9a24a" }}>hub_ciclos_log</code> para este ciclo (últimas 50).
                    </p>
                    {timelineLoading ? (
                      <p className="text-sm" style={{ color: "#8b949e" }}>Carregando histórico…</p>
                    ) : timelineLogs.length === 0 ? (
                      <div className="rounded-lg p-4 space-y-2" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                        <p className="text-sm m-0" style={{ color: "#8b949e" }}>
                          Ainda não há linhas em <span style={{ color: "#c9a24a" }}>hub_ciclos_log</span> com o identificador deste ciclo.
                        </p>
                        <p className="text-xs m-0" style={{ color: "#484f58", lineHeight: 1.5 }}>
                          O agendamento da Vercel chama rotas fixas (por exemplo <code style={{ color: "#c9a24a" }}>/api/ciclos/atendente?ciclo=followup</code>).
                          Só após uma execução que grave <code style={{ color: "#c9a24a" }}>ciclo_id</code> vinculado a esta linha é que a timeline aparece aqui.
                          Execuções antigas ou sem vínculo podem existir só na aba «Logs» geral.
                        </p>
                      </div>
                    ) : (
                      <ul className="space-y-2 pl-0 list-none m-0" style={{ borderLeft: "2px solid #30363d", marginLeft: 8, paddingLeft: 16 }}>
                        {timelineLogs.map((log) => {
                          const st = String(log.status ?? "");
                          return (
                            <li
                              key={String(log.id)}
                              className="relative pl-0 pb-3"
                              style={{ borderLeft: "none" }}
                            >
                              <span
                                className="absolute rounded-full"
                                style={{
                                  width: 10,
                                  height: 10,
                                  left: -21,
                                  top: 4,
                                  background: STATUS_COR[st] || "#484f58",
                                }}
                              />
                              <div className="rounded-lg p-3" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="text-xs font-bold" style={{ color: "#e6edf3" }}>
                                    {log.agente_slug as string}
                                  </span>
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full"
                                    style={{
                                      background: `${STATUS_COR[st] || "#8b949e"}30`,
                                      color: STATUS_COR[st] || "#8b949e",
                                    }}
                                  >
                                    {st || "—"}
                                  </span>
                                </div>
                                <p className="text-xs mt-1" style={{ color: "#8b949e" }}>
                                  {tempoRelativo(log.iniciado_em as string)}
                                  {log.finalizado_em ? ` · fim ${tempoRelativo(log.finalizado_em as string)}` : ""}
                                </p>
                                {typeof log.erro === "string" && log.erro && (
                                  <p className="text-xs mt-1" style={{ color: "#b3261e" }}>{log.erro}</p>
                                )}
                                {Array.isArray(log.acoes_tomadas) && (log.acoes_tomadas as string[]).length > 0 && (
                                  <ul className="mt-2 text-xs m-0 pl-4" style={{ color: "#484f58" }}>
                                    {(log.acoes_tomadas as string[]).slice(0, 5).map((ac, i) => (
                                      <li key={i}>{ac}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs mb-1 block" style={{ color: "#8b949e" }}>Agente slug</span>
                  <input
                    value={fAgenteSlug}
                    onChange={(e) => setFAgenteSlug(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
                    placeholder="ex.: gerente_atendimento"
                  />
                </label>
                {agenteSomenteCanalWa && (
                  <p
                    className="text-xs m-0 rounded-lg p-3 leading-relaxed"
                    style={{ background: "#1b2532", border: "1px solid #30363d", color: "#8b949e" }}
                  >
                    Agente <strong style={{ color: "#c9a24a" }}>{MODO_OPERACAO_LABEL.canal_whatsapp}</strong>
                    : a conversa ao vivo é pelo webhook UAZAPI. Use ciclo{" "}
                    <strong style={{ color: "#e6edf3" }}>gatilho</strong> para registo no hub; agendamento cron
                    só faz sentido para <strong style={{ color: "#c9a24a" }}>follow-up</strong> (nome ou dispatch
                    atendente/followup).
                  </p>
                )}
                <label className="block">
                  <span className="text-xs mb-1 block" style={{ color: "#8b949e" }}>Nome</span>
                  <input
                    value={fNome}
                    onChange={(e) => setFNome(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
                  />
                </label>
                <label className="block">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="text-xs block" style={{ color: "#8b949e" }}>
                      Descrição
                    </span>
                    <button
                      type="button"
                      onClick={() => void sugerirDescricaoComIa()}
                      disabled={sugestaoIaLoading !== null || !fNome.trim() || !fAgenteSlug.trim()}
                      className="inline-flex items-center gap-1.5 text-xs font-bold rounded-md px-2 py-1"
                      style={{
                        background: "#21262d",
                        color: "#c9a24a",
                        border: "1px solid #30363d",
                        cursor:
                          sugestaoIaLoading !== null || !fNome.trim() || !fAgenteSlug.trim()
                            ? "not-allowed"
                            : "pointer",
                        opacity: sugestaoIaLoading !== null || !fNome.trim() || !fAgenteSlug.trim() ? 0.5 : 1,
                      }}
                      title="Gera texto com IA (Mistral ou Anthropic conforme .env)."
                    >
                      <Sparkles size={14} aria-hidden />
                      {sugestaoIaLoading === "descricao" ? "A gerar…" : "Gerar com IA"}
                    </button>
                  </div>
                  <textarea
                    value={fDescricao}
                    onChange={(e) => setFDescricao(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
                  />
                </label>
                {esconderAgendamentoCron ? (
                  <div
                    className="rounded-lg p-3 space-y-2"
                    style={{ background: "#161b22", border: "1px solid #30363d" }}
                  >
                    <p className="text-xs font-bold m-0" style={{ color: "#c9a24a" }}>
                      Canal WhatsApp — sem agendamento cron
                    </p>
                    <p className="text-xs m-0 leading-relaxed" style={{ color: "#8b949e" }}>
                      Este agente atua sob <strong style={{ color: "#e6edf3" }}>interação</strong> (mensagens
                      UAZAPI). O tipo do ciclo fica em <strong style={{ color: "#e6edf3" }}>gatilho</strong> para
                      documentação no hub. Para cadências de follow-up programadas, use um nome com «follow» ou
                      configure <code style={{ color: "#8b949e" }}>dispatch.atendente/followup</code> e abra os
                      parâmetros de follow-up abaixo.
                    </p>
                  </div>
                ) : (
                <details
                  open={agendaDetailsAberto}
                  onToggle={(e) => setAgendaDetailsAberto(e.currentTarget.open)}
                  className="rounded-lg"
                  style={{ background: "#161b22", border: "1px solid #30363d" }}
                >
                  <summary
                    className="cursor-pointer list-none flex items-center gap-2 p-3 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#161b22] focus-visible:ring-[#c9a24a66]"
                    style={{ color: "#c9a24a" }}
                    aria-expanded={agendaDetailsAberto}
                  >
                    <ChevronRight
                      size={18}
                      aria-hidden
                      className="flex-shrink-0 transition-transform duration-200 ease-out"
                      style={{
                        color: "#c9a24a",
                        transform: agendaDetailsAberto ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    />
                    <span className="text-xs font-bold">
                      Agendamento — quando o job / cron aciona o agente
                    </span>
                  </summary>
                  <div className="space-y-3 px-3 pb-3">
                  <p className="text-xs m-0 leading-relaxed" style={{ color: "#484f58" }}>
                    O runner lê <code style={{ color: "#8b949e" }}>hub_ciclos_ia</code> (ex.:{" "}
                    <code style={{ color: "#8b949e" }}>/api/cron/dispatch-ciclos</code>
                    ). Escolha o modo abaixo; os campos técnicos são gerados em função dele.
                  </p>
                  <div className="grid gap-2">
                    {(
                      [
                        {
                          id: "continuo" as const,
                          title: "Automático contínuo",
                          sub: "Dispatch repete enquanto o ciclo estiver ativo (use intervalo em minutos).",
                          Icon: Zap,
                        },
                        {
                          id: "programado" as const,
                          title: "Horário fixo ou recorrente",
                          sub: "Cron (ex. 07h, a cada 6h) + intervalo mínimo opcional.",
                          Icon: Clock,
                        },
                        {
                          id: "gatilho" as const,
                          title: "Gatilho / interação",
                          sub: "Só corre quando algo externo pede (fila, webhook, botão Executar).",
                          Icon: Webhook,
                        },
                      ] as const
                    ).map((opt) => {
                      const Icon = opt.Icon;
                      const sel = fTipo === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setFTipo(opt.id);
                            if (opt.id === "gatilho") setFCron("");
                            if (opt.id === "continuo" && !fIntervalo.trim()) setFIntervalo("15");
                            if (opt.id === "programado" && !fIntervalo.trim()) setFIntervalo("360");
                            if (opt.id === "programado") setCronEditorLivre(false);
                          }}
                          className="w-full text-left rounded-lg p-3 transition-colors"
                          style={{
                            border: sel ? "1px solid rgba(201, 162, 74, 0.55)" : "1px solid #30363d",
                            background: sel ? "#1b2532" : "#0d1117",
                            cursor: "pointer",
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className="mt-0.5 inline-flex rounded-md p-1"
                              style={{ background: sel ? "#c9a24a22" : "#21262d", color: sel ? "#c9a24a" : "#8b949e" }}
                            >
                              <Icon size={16} aria-hidden />
                            </span>
                            <span>
                              <span className="block text-sm font-bold" style={{ color: "#e6edf3" }}>
                                {opt.title}
                              </span>
                              <span className="block text-xs mt-0.5" style={{ color: "#8b949e" }}>
                                {opt.sub}
                              </span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                {(fTipo === "continuo" || fTipo === "programado") && (
                  <label className="block">
                    <span className="text-xs mb-1 block" style={{ color: "#8b949e" }}>
                      Intervalo mínimo (minutos)
                    </span>
                    <input
                      value={fIntervalo}
                      onChange={(e) => setFIntervalo(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
                      placeholder={fTipo === "continuo" ? "ex.: 15" : "ex.: 360"}
                    />
                    <p className="text-xs mt-1 m-0" style={{ color: "#484f58" }}>
                      Piso entre execuções que o dispatch respeita para este ciclo.
                    </p>
                  </label>
                )}

                {fTipo === "programado" && (
                  <div
                    className="rounded-lg p-3 space-y-3"
                    style={{ background: "#161b22", border: "1px solid #30363d" }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold m-0" style={{ color: "#c9a24a" }}>
                        Horário fixo (UTC) e dias da semana
                      </p>
                      <label className="flex items-center gap-2 text-xs m-0 cursor-pointer" style={{ color: "#8b949e" }}>
                        <input
                          type="checkbox"
                          checked={cronEditorLivre}
                          onChange={(e) => {
                            const livre = e.target.checked;
                            if (!livre) {
                              const p = parseCronAgendaUi(fCron.trim());
                              if (p) {
                                setCronMin(p.minute);
                                setCronHr(p.hour);
                                setCronDias(p.daysOfWeek);
                              }
                            }
                            setCronEditorLivre(livre);
                          }}
                        />
                        Editar expressão cron manualmente
                      </label>
                    </div>
                    {!cronEditorLivre ? (
                      <>
                        <div className="flex flex-wrap gap-3">
                          <label className="m-0">
                            <span className="text-xs block mb-1" style={{ color: "#8b949e" }}>
                              Hora (0–23 UTC)
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={23}
                              value={cronHr}
                              onChange={(e) =>
                                setCronHr(Math.min(23, Math.max(0, Number.parseInt(e.target.value, 10) || 0)))
                              }
                              className="w-24 rounded-lg px-3 py-2 text-sm"
                              style={{ background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3" }}
                            />
                          </label>
                          <label className="m-0">
                            <span className="text-xs block mb-1" style={{ color: "#8b949e" }}>
                              Minuto (0–59)
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={59}
                              value={cronMin}
                              onChange={(e) =>
                                setCronMin(Math.min(59, Math.max(0, Number.parseInt(e.target.value, 10) || 0)))
                              }
                              className="w-24 rounded-lg px-3 py-2 text-sm"
                              style={{ background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3" }}
                            />
                          </label>
                        </div>
                        <div>
                          <span className="text-xs block mb-2" style={{ color: "#8b949e" }}>
                            Dias em que corre (UTC)
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {CRON_DIAS_SEMANA.map(({ dow, abbr }) => {
                              const on = cronDias.includes(dow);
                              return (
                                <button
                                  key={dow}
                                  type="button"
                                  onClick={() => toggleCronDia(dow)}
                                  className="text-xs font-bold rounded-md px-2.5 py-1.5"
                                  style={{
                                    border: on ? "1px solid #c9a24a" : "1px solid #30363d",
                                    background: on ? "#c9a24a22" : "#0d1117",
                                    color: on ? "#c9a24a" : "#8b949e",
                                    cursor: "pointer",
                                  }}
                                >
                                  {abbr}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <p className="text-xs m-0" style={{ color: "#484f58", lineHeight: 1.45 }}>
                          O dispatch usa <strong style={{ color: "#8b949e" }}>UTC</strong>. Para 09:00 em Brasília
                          (≈ UTC−3), indique por exemplo <strong style={{ color: "#8b949e" }}>12</strong> na hora
                          UTC. Expressão gerada:{" "}
                          <code style={{ color: "#c9a24a" }}>{buildCronUtc(cronMin, cronHr, cronDias)}</code>
                        </p>
                      </>
                    ) : (
                      <label className="block m-0">
                        <span className="text-xs mb-1 block" style={{ color: "#8b949e" }}>
                          Expressão cron (5 campos, UTC)
                        </span>
                        <input
                          value={fCron}
                          onChange={(e) => setFCron(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                          style={{ background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3" }}
                          placeholder="ex.: 0 12 * * 1-5"
                        />
                      </label>
                    )}
                  </div>
                )}

                {fTipo === "gatilho" && (
                  <p className="text-xs m-0 rounded-lg p-3" style={{ background: "#0d1117", border: "1px solid #30363d", color: "#8b949e" }}>
                    Este modo não agenda sozinho: use <strong style={{ color: "#c9a24a" }}>Executar</strong> no card ou ligue o ciclo a filas/webhooks na sua integração.
                  </p>
                )}
                  </div>
                </details>
                )}
                {!mostrarBlocoFollowup ? (
                  <div
                    className="rounded-lg p-3 space-y-2"
                    style={{ background: "#161b22", border: "1px solid #30363d" }}
                  >
                    <p className="text-xs m-0" style={{ color: "#8b949e", lineHeight: 1.5 }}>
                      <strong style={{ color: "#c9a24a" }}>Follow-up WhatsApp</strong> — horas por passo e
                      pré-visualização do hub aplicam-se sobretudo a ciclos de atendimento (ex.: «follow» no nome ou{" "}
                      <code style={{ color: "#8b949e" }}>dispatch</code>{" "}
                      <code style={{ color: "#8b949e" }}>atendente</code> /{" "}
                      <code style={{ color: "#8b949e" }}>followup</code>
                      ). Para outros tipos de ciclo pode ignorar.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFollowupAvancadoForcado(true);
                        setFollowupDetailsAberto(true);
                      }}
                      className="text-xs font-bold px-2.5 py-1.5 rounded-md"
                      style={{
                        background: "#21262d",
                        color: "#c9a24a",
                        border: "1px solid #30363d",
                        cursor: "pointer",
                      }}
                    >
                      Mostrar parâmetros de follow-up
                    </button>
                  </div>
                ) : (
                <details
                  key={`adv-followup-${drawerMode}-${selectedCicloId ?? "novo"}`}
                  className="rounded-lg"
                  style={{ background: "#161b22", border: "1px solid #30363d" }}
                  open={followupDetailsAberto}
                  onToggle={(e) => setFollowupDetailsAberto(e.currentTarget.open)}
                >
                  <summary
                    className="cursor-pointer list-none flex items-center gap-2 p-3 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#161b22] focus-visible:ring-[#c9a24a66]"
                    style={{ color: "#c9a24a" }}
                    aria-expanded={followupDetailsAberto}
                  >
                    <ChevronRight
                      size={18}
                      aria-hidden
                      className="flex-shrink-0 transition-transform duration-200 ease-out"
                      style={{
                        color: "#c9a24a",
                        transform: followupDetailsAberto ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    />
                    <span className="text-xs font-bold">
                      Avançado — follow-up WhatsApp / hub_followup_config
                    </span>
                  </summary>
                  <div className="space-y-3 px-3 pb-3">
                  {followupAvancadoForcado && !followupHeuristica && (
                    <p
                      className="text-xs m-0 rounded-md px-2 py-1.5"
                      style={{
                        background: "#21262d",
                        border: "1px solid #30363d",
                        color: "#8b949e",
                        lineHeight: 1.45,
                      }}
                    >
                      Secção aberta manualmente — use só se este ciclo alimentar{" "}
                      <code style={{ color: "#8b949e" }}>/api/ciclos/atendente?ciclo=followup</code> ou equivalente.
                    </p>
                  )}
                  <p className="text-xs m-0" style={{ color: "#484f58", lineHeight: 1.45 }}>
                    Valores gravados em <code style={{ color: "#8b949e" }}>configuracoes</code> (horas por passo e dias
                    até arquivar); textos das mensagens vêm de <code style={{ color: "#8b949e" }}>hub_followup_config</code>.
                  </p>
                  <p className="text-xs font-bold m-0" style={{ color: "#c9a24a" }}>Parâmetros de follow-up</p>
                  <label className="block m-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-xs block" style={{ color: "#8b949e" }}>
                        Horas para lembretes (lista, separadas por vírgula)
                      </span>
                      <button
                        type="button"
                        onClick={() => void sugerirFollowupComIa()}
                        disabled={sugestaoIaLoading !== null || !fNome.trim() || !fAgenteSlug.trim()}
                        className="inline-flex items-center gap-1.5 text-xs font-bold rounded-md px-2 py-1"
                        style={{
                          background: "#21262d",
                          color: "#c9a24a",
                          border: "1px solid #30363d",
                          cursor:
                            sugestaoIaLoading !== null || !fNome.trim() || !fAgenteSlug.trim()
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            sugestaoIaLoading !== null || !fNome.trim() || !fAgenteSlug.trim() ? 0.5 : 1,
                        }}
                      >
                        <Sparkles size={14} aria-hidden />
                        {sugestaoIaLoading === "followup" ? "A gerar…" : "Sugerir com IA"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(
                        [
                          { label: "2, 24, 48", v: "2, 24, 48" },
                          { label: "1, 6, 24, 72", v: "1, 6, 24, 72" },
                          { label: "4, 12, 48", v: "4, 12, 48" },
                        ] as const
                      ).map((p) => (
                        <button
                          key={p.v}
                          type="button"
                          onClick={() => setFHorasFollowup(p.v)}
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: "#0d1117",
                            border: "1px solid #30363d",
                            color: "#8b949e",
                            cursor: "pointer",
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <input
                      value={fHorasFollowup}
                      onChange={(e) => setFHorasFollowup(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3" }}
                      placeholder="ex.: 2, 24, 48"
                    />
                    <span className="text-xs mt-1 block" style={{ color: "#484f58" }}>
                      Horas após o último contato por passo (quando a lista é válida no job).
                    </span>
                  </label>
                  <label className="block m-0">
                    <span className="text-xs mb-1 block" style={{ color: "#8b949e" }}>Arquivar lead após quantos dias sem resposta</span>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[7, 14, 21, 30].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setFArquivarAposDias(String(d))}
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: "#0d1117",
                            border: "1px solid #30363d",
                            color: "#8b949e",
                            cursor: "pointer",
                          }}
                        >
                          {d} dias
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={fArquivarAposDias}
                      onChange={(e) => setFArquivarAposDias(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3" }}
                    />
                  </label>

                  <div className="rounded-lg p-3 space-y-2" style={{ background: "#0d1117", border: "1px solid #30363d" }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold m-0" style={{ color: "#e6edf3" }}>Pré-visualizar merge com hub_followup_config</p>
                      {mercadosPreviewOptions.length > 1 && (
                        <label className="flex items-center gap-2 m-0 text-xs" style={{ color: "#8b949e" }}>
                          <span>Mercado</span>
                          <select
                            value={previewMercado}
                            onChange={(e) => setPreviewMercado(e.target.value)}
                            className="rounded px-2 py-1 text-xs"
                            style={{
                              background: "#161b22",
                              border: "1px solid #30363d",
                              color: "#e6edf3",
                            }}
                          >
                            {mercadosPreviewOptions.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    {followupHubLoading ? (
                      <p className="text-xs m-0" style={{ color: "#8b949e" }}>Carregando passos do hub…</p>
                    ) : followupHubError ? (
                      <p className="text-xs m-0" style={{ color: "#b3261e" }}>{followupHubError}</p>
                    ) : mergePreviewLinhas.length === 0 ? (
                      <p className="text-xs m-0" style={{ color: "#8b949e" }}>
                        Nenhum passo ativo para «{previewMercado}» (com fallback geral). Cadastre linhas em hub_followup_config.
                      </p>
                    ) : (
                      <>
                        <div className="overflow-x-auto rounded-md" style={{ border: "1px solid #30363d" }}>
                          <table className="w-full text-xs border-collapse" style={{ color: "#e6edf3" }}>
                            <thead>
                              <tr style={{ background: "#161b22", color: "#8b949e", textAlign: "left" }}>
                                <th className="px-2 py-1.5 font-semibold">Passo</th>
                                <th className="px-2 py-1.5 font-semibold">Hub (h)</th>
                                <th className="px-2 py-1.5 font-semibold">Após merge (h)</th>
                                <th className="px-2 py-1.5 font-semibold">Origem</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mergePreviewLinhas.map((row) => (
                                <tr key={row.passo} style={{ borderTop: "1px solid #30363d" }}>
                                  <td className="px-2 py-1.5">{row.passo}</td>
                                  <td className="px-2 py-1.5">{row.hubHoras}</td>
                                  <td
                                    className="px-2 py-1.5 font-semibold"
                                    style={{
                                      color:
                                        row.mergeHoras !== row.hubHoras ? "#c9a24a" : "#e6edf3",
                                    }}
                                  >
                                    {row.mergeHoras}
                                  </td>
                                  <td className="px-2 py-1.5" style={{ color: "#8b949e" }}>
                                    {row.usaLista ? "lista do ciclo" : "hub"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {followupCompat.avisos.length > 0 && (
                          <ul
                            className="m-0 pl-4 space-y-1"
                            style={{
                              color:
                                followupCompat.listaReplicadaAlemDoTamanho ||
                                followupCompat.intervaloMaiorQueMenorMerge
                                  ? "#c9a24a"
                                  : "#8b949e",
                            }}
                          >
                            {followupCompat.avisos.map((t: string, i: number) => (
                              <li key={i}>{t}</li>
                            ))}
                          </ul>
                        )}
                        {followupCompat.intervaloMaiorQueMenorMerge && minMergeHorasDisparo != null && (
                          <div className="flex flex-wrap gap-2 items-center">
                            <button
                              type="button"
                              onClick={aplicarIntervaloNaoMaiorQueMenorMerge}
                              className="text-xs font-bold px-2 py-1.5 rounded"
                              style={{
                                background: "#2d2419",
                                color: "#c9a24a",
                                border: "1px solid #634419",
                                cursor: "pointer",
                              }}
                            >
                              Usar intervalo ≤ {minMergeHorasDisparo} h ({minMergeHorasDisparo * 60} min)
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={preencherHorasDoHubNoForm}
                          className="text-xs px-2 py-1.5 rounded"
                          style={{
                            background: "#21262d",
                            color: "#c9a24a",
                            border: "1px solid #30363d",
                            cursor: "pointer",
                          }}
                        >
                          Preencher campo de horas com valores do hub (este mercado)
                        </button>
                      </>
                    )}
                  </div>

                  {Object.keys(extraConfig).length > 0 && (
                    <p className="text-xs m-0" style={{ color: "#484f58" }}>
                      Este ciclo tem mais campos técnicos em <code style={{ color: "#8b949e" }}>configuracoes</code>; eles são mantidos ao salvar (sem editar aqui).
                    </p>
                  )}
                  <p className="text-xs m-0" style={{ color: "#484f58", lineHeight: 1.45 }}>
                    O texto de cada mensagem continua a vir de <code style={{ color: "#8b949e" }}>hub_followup_config</code> por mercado e passo.
                  </p>
                  </div>
                </details>
                )}
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fAtivo}
                    onChange={(e) => setFAtivo(e.target.checked)}
                  />
                  <span className="text-sm" style={{ color: "#e6edf3" }}>Ciclo ativo</span>
                </label>
                {erroDrawer && (
                  <p className="text-sm" style={{ color: "#b3261e" }}>{erroDrawer}</p>
                )}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    {drawerMode === "edit" && (
                      <button
                        onClick={() => pedirExcluirCicloNoDrawer()}
                        disabled={
                          saving ||
                          (cicloDialogBusy && dialogExcluirCiclo?.id === selectedCicloId)
                        }
                        className="px-3 py-2 rounded text-sm"
                        style={{ background: "#2d1517", color: "#ffb4ab", border: "1px solid #b3261e55" }}
                      >
                        {cicloDialogBusy && dialogExcluirCiclo?.id === selectedCicloId
                          ? "Excluindo..."
                          : "Excluir ciclo"}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => void salvarCiclo()}
                    disabled={
                      saving || (cicloDialogBusy && dialogExcluirCiclo?.id === selectedCicloId)
                    }
                    className="px-3 py-2 rounded text-sm font-semibold"
                    style={{ background: "#003b26", color: "#c9a24a", border: "1px solid #0f5132" }}
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
                )}
              </>
            )}
          </aside>
        </div>
      )}

      <CrmConfirmDialog
        open={dialogExcluirCiclo !== null}
        title="Excluir ciclo em cascata?"
        danger
        confirmLabel="Excluir definitivamente"
        cancelLabel="Cancelar"
        loading={cicloDialogBusy}
        onCancel={() => !cicloDialogBusy && setDialogExcluirCiclo(null)}
        onConfirm={() => void confirmarExcluirCicloModal()}
      >
        <p style={{ margin: "0 0 10px" }}>
          O ciclo <strong style={{ color: "#e6edf3" }}>«{dialogExcluirCiclo?.nome}»</strong> será removido de{" "}
          <code style={{ color: "#c9a24a" }}>hub_ciclos_ia</code> juntamente com as linhas de execução associadas em{" "}
          <code style={{ color: "#c9a24a" }}>hub_ciclos_log</code> (mesma transação no servidor, com autorização de
          exclusão).
        </p>
        <p style={{ margin: 0, color: "#b3261e", fontWeight: 600 }}>Não é possível desfazer.</p>
      </CrmConfirmDialog>

      <CrmConfirmDialog
        open={dialogLimparCiclo !== null}
        title="Limpar agendamento do ciclo?"
        danger={false}
        confirmLabel="Limpar cron e intervalo"
        cancelLabel="Cancelar"
        loading={cicloDialogBusy}
        onCancel={() => !cicloDialogBusy && setDialogLimparCiclo(null)}
        onConfirm={() => void confirmarLimparAgendamentoCiclo()}
      >
        <p style={{ margin: 0 }}>
          Para <strong style={{ color: "#e6edf3" }}>«{dialogLimparCiclo?.nome}»</strong> vamos anular{" "}
          <code style={{ color: "#c9a24a" }}>cron_expressao</code> e <code style={{ color: "#c9a24a" }}>intervalo_minutos</code>.
          O ciclo continua cadastrado; pode voltar a editar o agendamento quando quiser.
        </p>
      </CrmConfirmDialog>
    </>
  );
}
