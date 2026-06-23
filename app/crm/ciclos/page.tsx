"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useSearchParams } from "next/navigation";
import { hubApiHeaders } from "@/lib/internal-api-headers-client";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { invalidateHubCiclosList, useHubCiclosList } from "@/hooks/useCrmDataQueries";
import { hubQueryKeys } from "@/lib/hub/hub-query-keys";
import { supabase } from "@/lib/supabase/client";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import {
  crmBtnDangerSoft,
  crmBtnPrimary,
  crmBtnPrimaryLg,
  crmBtnSecondary,
  CRM_ACCENT,
} from "@/lib/crm/crm-button-styles";
import {
  RF_ACCENT,
  RF_BG_PANEL,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfAsideBodyStyle,
  rfAsideFooterStyle,
  rfAsideHeaderStyle,
  rfCloseButtonStyle,
  rfInputStyle,
  rfLabelStyle,
  rfOverlayStyle,
  rfAsideStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import {
  buildFollowupMergePreview,
  estimarIntervaloMinutosCron,
  followupCompatibilidadeAvisos,
  type HubFollowupConfigLite,
} from "@/lib/hub-ciclos-configuracoes";
import { buildCronUtc, parseCronAgendaUi } from "@/lib/cron-agenda-ui";
import {
  agenteEhSomenteCanalWhatsapp,
  resolveModoOperacaoAgente,
  type ModoOperacaoAgente,
} from "@/lib/hub/agente-modo-operacao";
import { CRM_ENTITY_GRID } from "@/lib/crm-glass-card";
import { CicloCard, type CicloCardAgente } from "@/components/crm/CicloCard";
import { AgenteSideoverEntityCard, AgenteSideoverInfoGrid } from "@/components/crm/AgenteSideoverCards";
import { cicloTipoMeta, tempoRelativoCiclo, CICLO_STATUS_COR } from "@/lib/crm/ciclo-ui";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import {
  ChevronRight,
  Clock,
  Sparkles,
  Webhook,
  X,
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

function slugParaApiCiclos(agenteSlug: string): string {
  if (agenteSlug === "diretor" || agenteSlug === "diretor_geral_ia" || agenteSlug === "diretor_operacoes") return "diretor";
  if (agenteSlug === "gerente_atendimento") return "gerente";
  return agenteSlug;
}

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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { setSlot } = useCrmHeaderSlot();
  const {
    data: ciclosRaw = [],
    isLoading: carregandoCiclos,
    error: ciclosQueryError,
  } = useHubCiclosList();
  const ciclosTodos = ciclosRaw as unknown as Ciclo[];
  const [modoLista, setModoLista] = useState<ListMode>("todos");
  const [busca, setBusca] = useState(() => searchParams.get("q")?.trim() || "");
  const [executando, setExecutando] = useState<string | null>(null);
  const [alternandoCicloId, setAlternandoCicloId] = useState<string | null>(null);
  const [excluindoCicloId, setExcluindoCicloId] = useState<string | null>(null);
  const [erroListaCiclosLocal, setErroListaCiclos] = useState<string | null>(null);
  const erroListaCiclos = erroListaCiclosLocal ?? ciclosQueryError?.message ?? null;
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
  const [cicloStats, setCicloStats] = useState<{
    ultimo_ciclo?: string | null;
    ultimo_status?: string | null;
    total_execucoes?: number;
  } | null>(null);
  /** Agendamento (modo, intervalo, cron): aberto por defeito. */
  const [agendaDetailsAberto, setAgendaDetailsAberto] = useState(true);
  const [followupHubRows, setFollowupHubRows] = useState<HubFollowupConfigLite[]>([]);
  const [followupHubLoading, setFollowupHubLoading] = useState(false);
  const [followupHubError, setFollowupHubError] = useState<string | null>(null);
  const [previewMercado, setPreviewMercado] = useState("geral");
  const [agentesHub, setAgentesHub] = useState<CicloCardAgente[]>([]);

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

  const agentesPorSlug = useMemo(() => {
    const map = new Map<string, CicloCardAgente>();
    for (const ag of agentesHub) {
      if (ag.agente_slug) map.set(ag.agente_slug, ag);
    }
    return map;
  }, [agentesHub]);

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

  const carregarAuxiliar = useCallback(async () => {
    const agRes = await fetch("/api/hub/agentes?todos=true", { headers: await hubApiHeaders() });

    if (agRes.ok) {
      const agJson = (await agRes.json()) as unknown;
      const rows = Array.isArray(agJson) ? agJson : [];
      setAgentesHub(
        rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            agente_slug: String(r.agente_slug ?? ""),
            nome: typeof r.nome === "string" ? r.nome : undefined,
            cargo: typeof r.cargo === "string" ? r.cargo : undefined,
            avatar_url: typeof r.avatar_url === "string" ? r.avatar_url : null,
            modo_operacao: r.modo_operacao as CicloCardAgente["modo_operacao"],
            ativo: r.ativo === true,
          };
        })
      );
    } else {
      setAgentesHub([]);
    }
  }, []);

  const recarregarCiclos = useCallback(async () => {
    await invalidateHubCiclosList(queryClient);
  }, [queryClient]);

  const recarregarTudo = useCallback(async () => {
    await Promise.all([invalidateHubCiclosList(queryClient), carregarAuxiliar()]);
  }, [queryClient, carregarAuxiliar]);

  useEffect(() => {
    const q = searchParams.get("q")?.trim() || "";
    if (q) setBusca(q);
  }, [searchParams]);

  useEffect(() => {
    void carregarAuxiliar();
  }, [carregarAuxiliar]);

  /** Tempo real: hub_ciclos_ia — invalida cache TanStack. */
  useEffect(() => {
    const onDbChange = () => {
      void invalidateHubCiclosList(queryClient);
    };
    const channel = supabase
      .channel("ciclos_page_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_ciclos_ia" }, onDbChange)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!drawerOpen) return;
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
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen || drawerMode !== "edit" || !selectedCicloId) return;
    const row = ciclosTodos.find((c) => c.id === selectedCicloId);
    if (!row) return;
    setCicloStats({
      ultimo_ciclo: row.ultimo_ciclo ?? null,
      ultimo_status: row.ultimo_status ?? null,
      total_execucoes: row.total_execucoes ?? 0,
    });
  }, [drawerOpen, drawerMode, selectedCicloId, ciclosTodos]);

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

  const modoOperacaoDrawer = useMemo((): ModoOperacaoAgente | null => {
    const slug = fAgenteSlug.trim();
    if (!slug) return null;
    const row = agentesHub.find((a) => a.agente_slug === slug);
    const ciclosDoAgente = ciclosTodos.filter((c) => c.agente_slug === slug);
    return resolveModoOperacaoAgente(row, ciclosDoAgente);
  }, [fAgenteSlug, agentesHub, ciclosTodos]);

  const agenteSomenteCanalWa = agenteEhSomenteCanalWhatsapp(modoOperacaoDrawer);
  const agenteSlugDrawer = fAgenteSlug.trim();
  const mostrarBlocoFollowupLegado =
    !agenteSomenteCanalWa && (followupAvancadoForcado || followupHeuristica);
  const esconderAgendamentoCron = agenteSomenteCanalWa;

  const drawerCicloPreview = useMemo(() => {
    const tipoKey = esconderAgendamentoCron ? "gatilho" : fTipo;
    const meta = cicloTipoMeta(tipoKey);
    const ultimoIso = cicloStats?.ultimo_ciclo ?? null;
    const temExec = !!ultimoIso && !Number.isNaN(new Date(ultimoIso).getTime());
    const st = String(cicloStats?.ultimo_status || "nunca_executado");
    const execN = cicloStats?.total_execucoes ?? null;
    const labelTimer = !fAtivo ? "Pausado" : !temExec ? "Aguardando 1ª exec." : "Ativo";
    return { tipoKey, meta, temExec, st, execN, labelTimer, ultimoIso };
  }, [esconderAgendamentoCron, fTipo, cicloStats, fAtivo]);

  const DrawerPreviewIcon = drawerCicloPreview.meta.Icon;

  useEffect(() => {
    if (!drawerOpen || drawerMode !== "create" || !agenteSomenteCanalWa) return;
    if (fTipo !== "gatilho") setFTipo("gatilho");
  }, [drawerOpen, drawerMode, agenteSomenteCanalWa, fTipo]);

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

  async function toggleCiclo(id: string, ativo: boolean) {
    setAlternandoCicloId(id);
    queryClient.setQueryData<Record<string, unknown>[]>(hubQueryKeys.ciclos.list(), (prev) => {
      if (!prev) return prev;
      return prev.map((row) => (String(row.id) === id ? { ...row, ativo } : row));
    });
    try {
      const res = await fetch(`/api/hub/ciclos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ ativo }),
      });
      if (!res.ok) {
        await invalidateHubCiclosList(queryClient);
        return;
      }
      void carregarAuxiliar();
    } catch {
      await invalidateHubCiclosList(queryClient);
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
      await recarregarTudo();
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
      await recarregarTudo();
    } finally {
      setCicloDialogBusy(false);
      setExcluindoCicloId(null);
    }
  }

  async function executarAgora(ciclo: Ciclo) {
    setExecutando(ciclo.id);
    const slugAgente = ciclo.agente_slug;
    const row = agentesHub.find((a) => a.agente_slug === slugAgente);
    const ciclosDoAgente = ciclosTodos.filter((c) => c.agente_slug === slugAgente);
    const modo = resolveModoOperacaoAgente(row, ciclosDoAgente);
    const ehWaFollowup =
      agenteEhSomenteCanalWhatsapp(modo) &&
      cicloPareceFollowupWhatsApp(ciclo.nome, ciclo.configuracoes || {});

    try {
      if (ehWaFollowup) {
        await fetch(`/api/hub/agentes/${encodeURIComponent(slugAgente)}/followup/test`, {
          method: "POST",
          headers: await hubApiHeaders(),
        });
      } else {
        const agente = slugParaApiCiclos(slugAgente);
        const nome = ciclo.nome.toLowerCase();
        const nomeCiclo = nome.includes("follow")
          ? "followup"
          : nome.includes("sla")
            ? "sla"
            : nome.includes("manha") || nome.includes("matinal")
              ? ciclo.agente_slug === "gerente_atendimento"
                ? "relatorio_manha"
                : "analise_manha"
              : nome.includes("noite")
                ? "analise_noite"
                : nome.includes("tráfego") || nome.includes("trafego")
                  ? "trafego"
                  : nome.includes("supervis")
                    ? "supervisao"
                    : "followup";

        await fetch(
          `/api/ciclos/${agente}?ciclo=${nomeCiclo}&hub_ciclo_id=${encodeURIComponent(ciclo.id)}&secret=obra10plus_cron_2026`,
          { headers: internalApiHeaders() }
        );
      }
    } catch (e) {
      console.error(e);
    }

    await recarregarCiclos();
    setExecutando(null);
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
    setCicloStats(null);
  }

  function abrirNovoCiclo() {
    resetForm();
    setDrawerMode("create");
    setDrawerOpen(true);
  }

  async function abrirEditarCiclo(cicloId: string) {
    resetForm();
    setDrawerMode("edit");
    setDrawerOpen(true);
    setSelectedCicloId(cicloId);
    setFormLoading(true);
    try {
      const res = await fetch(`/api/hub/ciclos/${encodeURIComponent(cicloId)}`, {
        headers: await hubApiHeaders(),
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
      setCicloStats({
        ultimo_ciclo: ciclo.ultimo_ciclo ?? null,
        ultimo_status: ciclo.ultimo_status ?? null,
        total_execucoes: ciclo.total_execucoes ?? 0,
      });
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
        headers: { "Content-Type": "application/json", ...(await hubApiHeaders()) },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Falha ao salvar ciclo.");
      }
      setDrawerOpen(false);
      await recarregarTudo();
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
          <span
            className="rounded-full px-2.5 py-1 font-bold"
            style={{
              background: "rgba(146, 255, 0, 0.14)",
              color: BRAND_TEXT_DARK,
              border: "1px solid rgba(146, 255, 0, 0.35)",
            }}
          >
            {contadores.ativos} ativos
          </span>
        </div>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, contadores.ativos]);

  return (
    <>
    <div style={{ background: "#f8fcf6", minHeight: "100vh" }}>
      <div style={{ padding: 24 }}>
        <div>
            <div style={{ marginBottom: 18 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#5d7a67",
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
                        border: `1px solid ${sel ? "rgba(146,255,0,0.55)" : "#d4ecd0"}`,
                        background: sel ? "#ecffd8" : "#ffffff",
                        color: sel ? BRAND_TEXT_DARK : "#5d7a67",
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
                    minWidth: 220,
                    padding: "8px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    background: "#ffffff",
                    border: "1px solid #d4ecd0",
                    color: BRAND_TEXT_DARK,
                  }}
                />
                {!carregandoCiclos && ciclosTodos.length > 0 && (
                  <span style={{ fontSize: 12, color: "#6b8a76", marginLeft: 6 }}>
                    mostrando: {ciclosFiltrados.length} de {ciclosTodos.length} ciclo
                    {ciclosTodos.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </div>

            {busca.trim() && ciclosFiltrados.length < ciclosTodos.length && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #e6d9a8",
                  background: "#fffbeb",
                  color: "#7a5c00",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span>
                  Filtro activo: <strong>&quot;{busca.trim()}&quot;</strong> — {ciclosFiltrados.length} de{" "}
                  {ciclosTodos.length} ciclos visíveis.
                </span>
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid #e6d9a8",
                    background: "#ffffff",
                    color: "#7a5c00",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Limpar busca
                </button>
              </div>
            )}

            {erroListaCiclos && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #f0c0bd",
                  background: "#fff2f1",
                  color: "#c0392b",
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
                    color: "#c0392b",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  Fechar
                </button>
              </div>
            )}

            {carregandoCiclos ? (
              <p style={{ color: "#5d7a67", fontSize: 13 }}>Carregando ciclos…</p>
            ) : ciclosTodos.length === 0 && !erroListaCiclos ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "48px 24px",
                  borderRadius: 18,
                  border: "1px dashed #d4ecd0",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    margin: "0 auto 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(146, 255, 0, 0.14)",
                    border: "1px solid rgba(146, 255, 0, 0.35)",
                  }}
                >
                  <Zap size={28} color={BRAND_GREEN_BRIGHT} strokeWidth={2} aria-hidden />
                </div>
                <h3 style={{ margin: "0 0 8px", color: BRAND_TEXT_DARK, fontSize: 17, fontWeight: 800 }}>
                  Nenhum ciclo cadastrado
                </h3>
                <p style={{ margin: "0 auto", maxWidth: 420, color: "#5d7a67", fontSize: 13, lineHeight: 1.55 }}>
                  Os ciclos são criados automaticamente ao cadastrar um agente IA. Use esta página para
                  consultar execuções, activar ou editar ciclos de agentes existentes. Follow-up WhatsApp
                  configura-se em <strong>Agentes → Integrações</strong>.
                </p>
              </div>
            ) : null}
            {ciclosTodos.length > 0 && ciclosFiltrados.length === 0 && (
              <p style={{ color: "#5d7a67", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
                Nenhum ciclo corresponde à busca
              </p>
            )}
            {ciclosFiltrados.length > 0 && (
              <div style={CRM_ENTITY_GRID}>
                {ciclosFiltrados.map((c) => (
                  <CicloCard
                    key={c.id}
                    ciclo={c}
                    agente={agentesPorSlug.get(c.agente_slug) ?? { agente_slug: c.agente_slug }}
                    selecionado={drawerOpen && selectedCicloId === c.id}
                    executando={executando === c.id}
                    alternando={alternandoCicloId === c.id}
                    excluindo={excluindoCicloId === c.id}
                    limpando={limpandoCicloId === c.id}
                    proximaExecucao={proximaExecucao(c.cron_expressao)}
                    onOpen={() => void abrirEditarCiclo(c.id)}
                    onExecutar={() => void executarAgora(c)}
                    onEditar={() => void abrirEditarCiclo(c.id)}
                    onLimparAgendamento={(e) => limparAgendamentoCiclo(c, e)}
                    onToggleAtivo={() => void toggleCiclo(c.id, !c.ativo)}
                    onExcluir={(e) => void excluirCicloDoCard(c, e)}
                  />
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
      {drawerOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar painel"
            onClick={() => setDrawerOpen(false)}
            style={rfOverlayStyle(50)}
          />
          <aside style={rfAsideStyle("min(600px, 100vw)", 51)} onClick={(e) => e.stopPropagation()}>
            <div style={rfAsideHeaderStyle()}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, color: RF_TEXT_MUTED, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                    {drawerMode === "create" ? "NOVO CICLO" : "EDITAR CICLO"}
                  </p>
                  <h2 style={{ margin: "4px 0 0", color: RF_TEXT_PRIMARY, fontSize: 18, fontWeight: 700 }}>
                    {drawerMode === "create" ? "Criar ciclo IA" : fNome || "Ciclo IA"}
                  </h2>
                </div>
                <button type="button" onClick={() => setDrawerOpen(false)} style={rfCloseButtonStyle()} aria-label="Fechar">
                  <X size={16} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>

            <div style={rfAsideBodyStyle()}>
            {formLoading ? (
              <p style={{ color: RF_TEXT_MUTED, fontSize: 13, margin: 0 }}>Carregando...</p>
            ) : (
              <div className="space-y-3">
                <AgenteSideoverEntityCard
                  theme="dark"
                  accent={drawerCicloPreview.meta.cor}
                  Icon={DrawerPreviewIcon}
                  pulse={!drawerCicloPreview.temExec && fAtivo}
                  dim={!fAtivo}
                  avatarCaption={drawerCicloPreview.labelTimer}
                  footer={
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          color: drawerCicloPreview.meta.cor,
                          padding: "4px 8px",
                          borderRadius: 6,
                          background: `${drawerCicloPreview.meta.cor}14`,
                          border: `1px solid ${drawerCicloPreview.meta.cor}33`,
                        }}
                      >
                        <DrawerPreviewIcon size={11} strokeWidth={2.2} aria-hidden />
                        {drawerCicloPreview.meta.label}
                      </span>
                      <span style={{ color: RF_TEXT_MUTED, fontSize: 10, fontWeight: 600 }}>
                        {fAgenteSlug.trim() ? `Agente «${fAgenteSlug.trim()}»` : "Defina o agente"}
                      </span>
                    </div>
                  }
                >
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: fAtivo ? "rgba(146, 255, 0, 0.16)" : "#3f1515",
                        color: fAtivo ? "#86efac" : "#fca5a5",
                        border: fAtivo ? "1px solid rgba(146, 255, 0, 0.4)" : "1px solid #7f1d1d",
                      }}
                    >
                      {fAtivo ? "ativo" : "inativo"}
                    </span>
                    {drawerMode === "edit" && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: CICLO_STATUS_COR[drawerCicloPreview.st] || RF_TEXT_MUTED,
                        }}
                      >
                        Último status · {drawerCicloPreview.st.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: 14,
                      fontWeight: 700,
                      color: RF_TEXT_PRIMARY,
                      lineHeight: 1.3,
                    }}
                  >
                    {fNome.trim() || (drawerMode === "create" ? "Novo ciclo" : "Sem nome")}
                  </p>
                  {drawerMode === "edit" ? (
                    <AgenteSideoverInfoGrid
                      rows={[
                        {
                          label: "Última execução",
                          value: drawerCicloPreview.ultimoIso
                            ? tempoRelativoCiclo(drawerCicloPreview.ultimoIso)
                            : "Nunca executado",
                        },
                        {
                          label: "Total exec.",
                          value: drawerCicloPreview.execN != null ? String(drawerCicloPreview.execN) : "0",
                        },
                      ]}
                    />
                  ) : (
                    <p style={{ margin: 0, fontSize: 11, color: RF_TEXT_MUTED, lineHeight: 1.45 }}>
                      {drawerCicloPreview.meta.descricaoCurta}
                    </p>
                  )}
                </AgenteSideoverEntityCard>

                <label className="block">
                  <span style={rfLabelStyle()}>Agente slug</span>
                  <input
                    value={fAgenteSlug}
                    onChange={(e) => setFAgenteSlug(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={rfInputStyle()}
                    placeholder="ex.: gerente_atendimento"
                  />
                </label>
                {agenteSomenteCanalWa && (
                  <div
                    className="rounded-lg p-3 space-y-2"
                    style={{ background: RF_BG_PANEL, border: `1px solid ${RF_BORDER_STRONG}` }}
                  >
                    <p
                      className="text-xs m-0 leading-relaxed"
                      style={{ color: RF_TEXT_SECONDARY }}
                    >
                      Agente <strong style={{ color: RF_ACCENT }}>WhatsApp</strong>: conversa em modo{" "}
                      <strong style={{ color: RF_TEXT_PRIMARY }}>gatilho</strong> (mensagem do cliente). Lembretes
                      automáticos são configurados abaixo — mensagens fixas por passo, com imagens no bucket{" "}
                      <code style={{ color: RF_ACCENT }}>agent-followup</code>.
                    </p>
                    {drawerMode === "create" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!fNome.trim() || fNome === "Sob interação") {
                            setFNome("Follow-up WhatsApp");
                          }
                          if (!fDescricao.trim()) {
                            setFDescricao(
                              "Cadência de lembretes automáticos quando o cliente deixa de responder. Configuração nos passos abaixo."
                            );
                          }
                        }}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-md"
                        style={{
                          background: "rgba(146, 255, 0, 0.12)",
                          color: RF_ACCENT,
                          border: `1px solid ${RF_BORDER_STRONG}`,
                          cursor: "pointer",
                        }}
                      >
                        Usar nome «Follow-up WhatsApp»
                      </button>
                    )}
                  </div>
                )}
                <label className="block">
                  <span style={rfLabelStyle()}>Nome</span>
                  <input
                    value={fNome}
                    onChange={(e) => setFNome(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={rfInputStyle()}
                  />
                </label>
                <label className="block">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="text-xs block" style={{ color: "#5d7a67" }}>
                      Descrição
                    </span>
                    <button
                      type="button"
                      onClick={() => void sugerirDescricaoComIa()}
                      disabled={sugestaoIaLoading !== null || !fNome.trim() || !fAgenteSlug.trim()}
                      className="inline-flex items-center gap-1.5 text-xs font-bold rounded-md px-2 py-1"
                      style={{
                        background: "#eef7eb",
                        color: RF_ACCENT,
                        border: "1px solid #dcebd8",
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
                    style={rfInputStyle()}
                  />
                </label>
                {esconderAgendamentoCron ? (
                  <div
                    className="rounded-lg p-3 space-y-2"
                    style={{ background: RF_BG_PANEL, border: `1px solid ${RF_BORDER_STRONG}` }}
                  >
                    <p className="text-xs font-bold m-0" style={{ color: RF_ACCENT }}>
                      Canal WhatsApp — sem agendamento cron
                    </p>
                    <p className="text-xs m-0 leading-relaxed" style={{ color: "#5d7a67" }}>
                      Este agente atua sob <strong style={{ color: RF_TEXT_PRIMARY }}>interação</strong> (mensagens
                      UAZAPI). O ciclo fica em <strong style={{ color: RF_TEXT_PRIMARY }}>gatilho</strong>. A cadência
                      de follow-up é independente — configure nos passos abaixo; o cron envia a cada ~10 min.
                    </p>
                  </div>
                ) : (
                <details
                  open={agendaDetailsAberto}
                  onToggle={(e) => setAgendaDetailsAberto(e.currentTarget.open)}
                  className="rounded-lg"
                  style={{ background: RF_BG_PANEL, border: `1px solid ${RF_BORDER_STRONG}` }}
                >
                  <summary
                    className="cursor-pointer list-none flex items-center gap-2 p-3 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#ffffff] focus-visible:ring-[#c9a24a66]"
                    style={{ color: RF_ACCENT }}
                    aria-expanded={agendaDetailsAberto}
                  >
                    <ChevronRight
                      size={18}
                      aria-hidden
                      className="flex-shrink-0 transition-transform duration-200 ease-out"
                      style={{
                        color: RF_ACCENT,
                        transform: agendaDetailsAberto ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    />
                    <span className="text-xs font-bold">
                      Agendamento
                    </span>
                  </summary>
                  <div className="space-y-3 px-3 pb-3">
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
                            border: sel ? `1px solid ${RF_BORDER_STRONG}` : `1px solid ${RF_BORDER}`,
                            background: sel ? "rgba(146, 255, 0, 0.1)" : "rgba(6, 13, 8, 0.5)",
                            cursor: "pointer",
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className="mt-0.5 inline-flex rounded-md p-1"
                              style={{ background: sel ? "rgba(146, 255, 0, 0.14)" : "rgba(6, 13, 8, 0.45)", color: sel ? RF_ACCENT : RF_TEXT_MUTED }}
                            >
                              <Icon size={16} aria-hidden />
                            </span>
                            <span>
                              <span className="block text-sm font-bold" style={{ color: RF_TEXT_PRIMARY }}>
                                {opt.title}
                              </span>
                              <span className="block text-xs mt-0.5" style={{ color: "#5d7a67" }}>
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
                    <span style={rfLabelStyle()}>
                      Intervalo mínimo (minutos)
                    </span>
                    <input
                      value={fIntervalo}
                      onChange={(e) => setFIntervalo(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={rfInputStyle()}
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
                    style={{ background: RF_BG_PANEL, border: `1px solid ${RF_BORDER_STRONG}` }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold m-0" style={{ color: RF_ACCENT }}>
                        Horário fixo (UTC) e dias da semana
                      </p>
                      <label className="flex items-center gap-2 text-xs m-0 cursor-pointer" style={{ color: "#5d7a67" }}>
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
                            <span className="text-xs block mb-1" style={{ color: "#5d7a67" }}>
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
                              style={rfInputStyle()}
                            />
                          </label>
                          <label className="m-0">
                            <span className="text-xs block mb-1" style={{ color: "#5d7a67" }}>
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
                              style={rfInputStyle()}
                            />
                          </label>
                        </div>
                        <div>
                          <span className="text-xs block mb-2" style={{ color: "#5d7a67" }}>
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
                                    border: on ? `1px solid ${RF_ACCENT}` : `1px solid ${RF_BORDER}`,
                                    background: on ? "rgba(146, 255, 0, 0.14)" : "rgba(6, 13, 8, 0.45)",
                                    color: on ? RF_ACCENT : RF_TEXT_MUTED,
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
                          O dispatch usa <strong style={{ color: "#5d7a67" }}>UTC</strong>. Para 09:00 em Brasília
                          (≈ UTC−3), indique por exemplo <strong style={{ color: "#5d7a67" }}>12</strong> na hora
                          UTC. Expressão gerada:{" "}
                          <code style={{ color: RF_ACCENT }}>{buildCronUtc(cronMin, cronHr, cronDias)}</code>
                        </p>
                      </>
                    ) : (
                      <label className="block m-0">
                        <span style={rfLabelStyle()}>
                          Expressão cron (5 campos, UTC)
                        </span>
                        <input
                          value={fCron}
                          onChange={(e) => setFCron(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm font-mono"
                          style={rfInputStyle()}
                          placeholder="ex.: 0 12 * * 1-5"
                        />
                      </label>
                    )}
                  </div>
                )}

                {fTipo === "gatilho" && (
                  <p className="text-xs m-0 rounded-lg p-3" style={{ background: "#f8fcf6", border: "1px solid #dcebd8", color: "#5d7a67" }}>
                    Este modo não agenda sozinho: use <strong style={{ color: RF_ACCENT }}>Executar</strong> no card ou ligue o ciclo a filas/webhooks na sua integração.
                  </p>
                )}
                  </div>
                </details>
                )}
                {agenteSomenteCanalWa && agenteSlugDrawer ? (
                  <div
                    className="rounded-lg p-3"
                    style={{ background: RF_BG_PANEL, border: `1px solid ${RF_BORDER_STRONG}` }}
                  >
                    <p className="text-xs m-0 leading-relaxed" style={{ color: RF_TEXT_SECONDARY }}>
                      <strong style={{ color: RF_ACCENT }}>Follow-up WhatsApp</strong> não se configura aqui.
                      Abra <strong style={{ color: RF_TEXT_PRIMARY }}>CRM → Agentes → {agenteSlugDrawer} → Integrações</strong>{" "}
                      e use <strong>Configurar passos</strong> no card Follow-up automático.
                    </p>
                  </div>
                ) : !mostrarBlocoFollowupLegado ? (
                  <div
                    className="rounded-lg p-3 space-y-2"
                    style={{ background: RF_BG_PANEL, border: `1px solid ${RF_BORDER_STRONG}` }}
                  >
                    <p className="text-xs m-0 mb-2" style={{ color: "#7a5c00", lineHeight: 1.5 }}>
                    Novo: configure follow-up por agente em CRM → Agentes → Integrações (recomendado). Este bloco é legado.
                  </p>
                  <p className="text-xs m-0" style={{ color: "#5d7a67", lineHeight: 1.5 }}>
                      <strong style={{ color: RF_ACCENT }}>Follow-up WhatsApp</strong> — cadência de lembretes automáticos
                      para ciclos de atendimento. Pode ignorar se este ciclo não for de follow-up.
                    </p>
                    <p className="text-xs m-0" style={{ color: "#7a5c00", lineHeight: 1.5 }}>
                      Novo: configure follow-up por agente em CRM → Agentes → Integrações (recomendado). Este bloco é legado.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFollowupAvancadoForcado(true);
                        setFollowupDetailsAberto(true);
                      }}
                      className="text-xs font-bold px-2.5 py-1.5 rounded-md"
                      style={{
                        background: "#eef7eb",
                        color: RF_ACCENT,
                        border: "1px solid #dcebd8",
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
                  style={{ background: RF_BG_PANEL, border: `1px solid ${RF_BORDER_STRONG}` }}
                  open={followupDetailsAberto}
                  onToggle={(e) => setFollowupDetailsAberto(e.currentTarget.open)}
                >
                  <summary
                    className="cursor-pointer list-none flex items-center gap-2 p-3 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#ffffff] focus-visible:ring-[#c9a24a66]"
                    style={{ color: RF_ACCENT }}
                    aria-expanded={followupDetailsAberto}
                  >
                    <ChevronRight
                      size={18}
                      aria-hidden
                      className="flex-shrink-0 transition-transform duration-200 ease-out"
                      style={{
                        color: RF_ACCENT,
                        transform: followupDetailsAberto ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    />
                    <span className="text-xs font-bold">
                      Follow-up WhatsApp
                    </span>
                  </summary>
                  <div className="space-y-3 px-3 pb-3">
                  <p className="text-xs m-0" style={{ color: "#7a5c00", lineHeight: 1.5 }}>
                    Novo: configure follow-up por agente em CRM → Agentes → Integrações (recomendado). Este bloco é legado.
                  </p>
                  {followupAvancadoForcado && !followupHeuristica && (
                    <p
                      className="text-xs m-0 rounded-md px-2 py-1.5"
                      style={{
                        background: "#eef7eb",
                        border: "1px solid #dcebd8",
                        color: "#5d7a67",
                        lineHeight: 1.45,
                      }}
                    >
                      Secção aberta manualmente — use apenas em ciclos de lembretes automáticos.
                    </p>
                  )}
                  <p className="text-xs m-0" style={{ color: "#484f58", lineHeight: 1.45 }}>
                    Defina intervalos entre lembretes e dias até arquivar. O texto de cada mensagem vem da configuração
                    de follow-up do hub.
                  </p>
                  <p className="text-xs font-bold m-0" style={{ color: RF_ACCENT }}>Parâmetros de follow-up</p>
                  <label className="block m-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-xs block" style={{ color: "#5d7a67" }}>
                        Horas para lembretes (lista, separadas por vírgula)
                      </span>
                      <button
                        type="button"
                        onClick={() => void sugerirFollowupComIa()}
                        disabled={sugestaoIaLoading !== null || !fNome.trim() || !fAgenteSlug.trim()}
                        className="inline-flex items-center gap-1.5 text-xs font-bold rounded-md px-2 py-1"
                        style={{
                          background: "#eef7eb",
                          color: RF_ACCENT,
                          border: "1px solid #dcebd8",
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
                            background: "#f8fcf6",
                            border: "1px solid #dcebd8",
                            color: "#5d7a67",
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
                      style={rfInputStyle()}
                      placeholder="ex.: 2, 24, 48"
                    />
                    <span className="text-xs mt-1 block" style={{ color: "#484f58" }}>
                      Horas após o último contato por passo (quando a lista é válida no job).
                    </span>
                  </label>
                  <label className="block m-0">
                    <span style={rfLabelStyle()}>Arquivar lead após quantos dias sem resposta</span>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[7, 14, 21, 30].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setFArquivarAposDias(String(d))}
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: "#f8fcf6",
                            border: "1px solid #dcebd8",
                            color: "#5d7a67",
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
                      style={rfInputStyle()}
                    />
                  </label>

                  <div className="rounded-lg p-3 space-y-2" style={{ background: RF_BG_PANEL, border: `1px solid ${RF_BORDER_STRONG}` }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold m-0" style={{ color: RF_TEXT_PRIMARY }}>Pré-visualizar cadência de lembretes</p>
                      {mercadosPreviewOptions.length > 1 && (
                        <label className="flex items-center gap-2 m-0 text-xs" style={{ color: "#5d7a67" }}>
                          <span>Mercado</span>
                          <select
                            value={previewMercado}
                            onChange={(e) => setPreviewMercado(e.target.value)}
                            className="rounded px-2 py-1 text-xs"
                            style={{
                              background: "#ffffff",
                              border: "1px solid #dcebd8",
                              color: "#0b2210",
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
                      <p className="text-xs m-0" style={{ color: "#5d7a67" }}>Carregando passos do hub…</p>
                    ) : followupHubError ? (
                      <p className="text-xs m-0" style={{ color: "#b3261e" }}>{followupHubError}</p>
                    ) : mergePreviewLinhas.length === 0 ? (
                      <p className="text-xs m-0" style={{ color: "#5d7a67" }}>
                        Nenhum passo ativo para «{previewMercado}». Configure os lembretes no hub de follow-up.
                      </p>
                    ) : (
                      <>
                        <div className="overflow-x-auto rounded-md" style={{ border: "1px solid #dcebd8" }}>
                          <table className="w-full text-xs border-collapse" style={{ color: RF_TEXT_PRIMARY }}>
                            <thead>
                              <tr style={{ background: "rgba(6, 13, 8, 0.55)", color: RF_TEXT_MUTED, textAlign: "left" }}>
                                <th className="px-2 py-1.5 font-semibold">Passo</th>
                                <th className="px-2 py-1.5 font-semibold">Hub (h)</th>
                                <th className="px-2 py-1.5 font-semibold">Após merge (h)</th>
                                <th className="px-2 py-1.5 font-semibold">Origem</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mergePreviewLinhas.map((row) => (
                                <tr key={row.passo} style={{ borderTop: "1px solid #dcebd8" }}>
                                  <td className="px-2 py-1.5">{row.passo}</td>
                                  <td className="px-2 py-1.5">{row.hubHoras}</td>
                                  <td
                                    className="px-2 py-1.5 font-semibold"
                                    style={{
                                      color:
                                        row.mergeHoras !== row.hubHoras ? RF_ACCENT : RF_TEXT_PRIMARY,
                                    }}
                                  >
                                    {row.mergeHoras}
                                  </td>
                                  <td className="px-2 py-1.5" style={{ color: "#5d7a67" }}>
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
                                  : "#5d7a67",
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
                                color: RF_ACCENT,
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
                            background: "#eef7eb",
                            color: RF_ACCENT,
                            border: "1px solid #dcebd8",
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
                      Este ciclo tem mais campos técnicos em <code style={{ color: "#5d7a67" }}>configuracoes</code>; eles são mantidos ao salvar (sem editar aqui).
                    </p>
                  )}
                  <p className="text-xs m-0" style={{ color: "#484f58", lineHeight: 1.45 }}>
                    O texto de cada mensagem é definido na configuração de follow-up por mercado e passo.
                  </p>
                  </div>
                </details>
                )}
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={fAtivo}
                    onChange={(e) => setFAtivo(e.target.checked)}
                  />
                  <span style={{ fontSize: 13, color: RF_TEXT_PRIMARY }}>Ciclo ativo</span>
                </label>
                {erroDrawer && (
                  <p style={{ margin: 0, fontSize: 13, color: "#f85149" }}>{erroDrawer}</p>
                )}
              </div>
            )}
            </div>

            {!formLoading && (
              <div style={rfAsideFooterStyle()}>
                {drawerMode === "edit" ? (
                  <button
                    type="button"
                    onClick={() => pedirExcluirCicloNoDrawer()}
                    disabled={saving || (cicloDialogBusy && dialogExcluirCiclo?.id === selectedCicloId)}
                    style={crmBtnDangerSoft(saving || (cicloDialogBusy && dialogExcluirCiclo?.id === selectedCicloId))}
                  >
                    {cicloDialogBusy && dialogExcluirCiclo?.id === selectedCicloId ? "Excluindo..." : "Excluir ciclo"}
                  </button>
                ) : (
                  <button type="button" onClick={() => setDrawerOpen(false)} style={crmBtnSecondary()}>
                    Cancelar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void salvarCiclo()}
                  disabled={saving || (cicloDialogBusy && dialogExcluirCiclo?.id === selectedCicloId)}
                  style={crmBtnPrimaryLg(saving || (cicloDialogBusy && dialogExcluirCiclo?.id === selectedCicloId))}
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            )}
          </aside>
        </>
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
          O ciclo <strong style={{ color: "#0b2210" }}>«{dialogExcluirCiclo?.nome}»</strong> será removido
          permanentemente, incluindo o histórico de execuções associado.
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
          Para <strong style={{ color: "#0b2210" }}>«{dialogLimparCiclo?.nome}»</strong> vamos anular{" "}
          <code style={{ color: CRM_ACCENT }}>cron_expressao</code> e <code style={{ color: CRM_ACCENT }}>intervalo_minutos</code>.
          O ciclo continua cadastrado; pode voltar a editar o agendamento quando quiser.
        </p>
      </CrmConfirmDialog>
    </>
  );
}
