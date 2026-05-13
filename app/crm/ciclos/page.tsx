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
import {
  CRM_ENTITY_GRID,
  crmAvatarGlow,
  crmBtnDesativar,
  crmBtnExecutar,
  crmFooterStatusPill,
  crmGlassCardSurface,
} from "@/lib/crm-glass-card";
import { CrmStickyTabs } from "@/components/crm/CrmStickyTabs";
import { Bell, ScrollText, Zap } from "lucide-react";

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

function tempoRelativo(d?: string): string {
  if (!d) return "nunca";
  const diff = (Date.now() - new Date(d).getTime()) / 60000;
  if (diff < 1) return "agora";
  if (diff < 60) return `${Math.round(diff)}min atrás`;
  if (diff < 1440) return `${Math.round(diff / 60)}h atrás`;
  return `${Math.round(diff / 1440)}d atrás`;
}

const TIPO_COR: Record<string, string> = {
  continuo: "#003b26",
  programado: "#c9a24a",
  gatilho: "#8b949e",
};

function slugParaApiCiclos(agenteSlug: string): string {
  if (agenteSlug === "diretor" || agenteSlug === "diretor_geral_ia" || agenteSlug === "diretor_operacoes") return "diretor";
  if (agenteSlug === "gerente_atendimento") return "gerente";
  return agenteSlug;
}

const STATUS_COR: Record<string, string> = {
  sucesso: "#003b26",
  sem_acao: "#8b949e",
  erro: "#b3261e",
  rodando: "#c9a24a",
  nunca_executado: "#484f58",
};

function iniciais(nome: string): string {
  return (nome || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [selectedCicloId, setSelectedCicloId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [erroDrawer, setErroDrawer] = useState<string | null>(null);
  const [fAgenteSlug, setFAgenteSlug] = useState("");
  const [fNome, setFNome] = useState("");
  const [fDescricao, setFDescricao] = useState("");
  const [fTipo, setFTipo] = useState<CicloTipo>("programado");
  const [fCron, setFCron] = useState("");
  const [fIntervalo, setFIntervalo] = useState("");
  const [fAtivo, setFAtivo] = useState(true);
  /** Chaves além de follow-up preservadas ao salvar (sem exibir JSON). */
  const [extraConfig, setExtraConfig] = useState<Record<string, unknown>>({});
  const [fHorasFollowup, setFHorasFollowup] = useState("2, 24, 48");
  const [fArquivarAposDias, setFArquivarAposDias] = useState("7");
  const [followupHubRows, setFollowupHubRows] = useState<HubFollowupConfigLite[]>([]);
  const [followupHubLoading, setFollowupHubLoading] = useState(false);
  const [followupHubError, setFollowupHubError] = useState<string | null>(null);
  const [previewMercado, setPreviewMercado] = useState("geral");

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
    const [cRes, l, a] = await Promise.all([
      fetch("/api/hub/ciclos", { headers: internalApiHeaders() }),
      fetch("/api/hub/ciclos-log?limit=20", { headers: internalApiHeaders() }),
      fetch("/api/hub/alertas?resolvido=false&limit=30", { headers: internalApiHeaders() }),
    ]);

    if (cRes.ok) {
      const cJson = await cRes.json() as { ciclos?: Ciclo[] };
      setCiclosTodos(Array.isArray(cJson.ciclos) ? cJson.ciclos : []);
    } else {
      setCiclosTodos([]);
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
      await fetch(`/api/ciclos/${agente}?ciclo=${nomeCiclo}&secret=obra10plus_cron_2026`, {
        headers: internalApiHeaders(),
      });
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

  function resetForm() {
    setSelectedCicloId(null);
    setFAgenteSlug("");
    setFNome("");
    setFDescricao("");
    setFTipo("programado");
    setFCron("");
    setFIntervalo("");
    setFAtivo(true);
    aplicarConfigNoForm({});
    setErroDrawer(null);
    setFormLoading(false);
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
      setFCron(ciclo.cron_expressao || "");
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
      const payload = {
        agente_slug: fAgenteSlug.trim(),
        nome: fNome.trim(),
        descricao: fDescricao.trim(),
        tipo: fTipo,
        cron_expressao: fCron.trim(),
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

  async function excluirCiclo() {
    if (!selectedCicloId) return;
    setDeleting(true);
    setErroDrawer(null);
    try {
      const res = await fetch(`/api/hub/ciclos/${encodeURIComponent(selectedCicloId)}`, {
        method: "DELETE",
        headers: internalApiHeaders(),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Falha ao excluir ciclo.");
      }
      setDrawerOpen(false);
      await carregar();
    } catch (e) {
      setErroDrawer(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setDeleting(false);
    }
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
                        <div style={crmAvatarGlow(tipoCor)}>{iniciais(c.nome)}</div>
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

                      <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                        Status:{" "}
                        <strong style={{ color: ativo ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                          {ativo ? "Ativo" : "Inativo"}
                        </strong>
                      </p>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                          marginTop: "auto",
                          gap: 10,
                          paddingTop: 4,
                        }}
                      >
                        <span style={crmFooterStatusPill(ativo)}>{ativo ? "Ativo" : "Inativo"}</span>
                        <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void executarAgora(c);
                            }}
                            disabled={executando === c.id || !c.ativo}
                            style={crmBtnExecutar(executando === c.id || !c.ativo)}
                          >
                            {executando === c.id ? "…" : "▶ Executar"}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleCiclo(c.id, !ativo);
                          }}
                          disabled={alternandoCicloId === c.id}
                          style={crmBtnDesativar(alternandoCicloId === c.id)}
                        >
                          {alternandoCicloId === c.id ? "…" : `⏻ ${ativo ? "Desativar" : "Ativar"}`}
                        </button>
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
                  <div className="flex gap-2 mb-4">
                    {(["dados", "timeline"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setDrawerSubTab(tab)}
                        className="text-xs font-bold px-3 py-2 rounded-lg"
                        style={{
                          border: "1px solid #30363d",
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
                  <span className="text-xs mb-1 block" style={{ color: "#8b949e" }}>Descrição</span>
                  <textarea
                    value={fDescricao}
                    onChange={(e) => setFDescricao(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs mb-1 block" style={{ color: "#8b949e" }}>Tipo</span>
                    <select
                      value={fTipo}
                      onChange={(e) => setFTipo(e.target.value as CicloTipo)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
                    >
                      <option value="programado">programado</option>
                      <option value="continuo">continuo</option>
                      <option value="gatilho">gatilho</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs mb-1 block" style={{ color: "#8b949e" }}>Intervalo (min)</span>
                    <input
                      value={fIntervalo}
                      onChange={(e) => setFIntervalo(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
                      placeholder="ex.: 30"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs mb-1 block" style={{ color: "#8b949e" }}>Cron expressão</span>
                  <input
                    value={fCron}
                    onChange={(e) => setFCron(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3" }}
                    placeholder="ex.: */30 * * * *"
                  />
                  <p className="text-xs mt-1 m-0" style={{ color: "#484f58" }}>
                    No Vercel, o horário real costuma vir do <strong style={{ color: "#8b949e", fontWeight: 600 }}>vercel.json</strong> (crons).
                    Este campo documenta a intenção no banco; alinhe com o agendamento do projeto.
                  </p>
                </label>

                <div className="rounded-lg p-3 space-y-3" style={{ background: "#161b22", border: "1px solid #30363d" }}>
                  <p className="text-xs font-bold m-0" style={{ color: "#c9a24a" }}>Parâmetros de follow-up (salvos no banco)</p>
                  <label className="block m-0">
                    <span className="text-xs mb-1 block" style={{ color: "#8b949e" }}>Horas para lembretes (lista, separadas por vírgula)</span>
                    <input
                      value={fHorasFollowup}
                      onChange={(e) => setFHorasFollowup(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3" }}
                      placeholder="ex.: 2, 24, 48"
                    />
                    <span className="text-xs mt-1 block" style={{ color: "#484f58" }}>
                      Ex.: horas após o último contato para planejar etapas de follow-up.
                    </span>
                  </label>
                  <label className="block m-0">
                    <span className="text-xs mb-1 block" style={{ color: "#8b949e" }}>Arquivar lead após quantos dias sem resposta</span>
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
                    O job <code style={{ color: "#8b949e" }}>/api/ciclos/atendente?ciclo=followup</code> lê estes valores:
                    as <strong style={{ color: "#8b949e", fontWeight: 600 }}>horas</strong> substituem a espera por passo (quando houver lista válida);
                    os <strong style={{ color: "#8b949e", fontWeight: 600 }}>dias</strong> definem o arquivamento após o passo 3 sem resposta.
                    O texto de cada mensagem continua vindo de <code style={{ color: "#8b949e" }}>hub_followup_config</code> por mercado e passo.
                  </p>
                </div>
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
                        onClick={() => void excluirCiclo()}
                        disabled={deleting || saving}
                        className="px-3 py-2 rounded text-sm"
                        style={{ background: "#2d1517", color: "#ffb4ab", border: "1px solid #b3261e55" }}
                      >
                        {deleting ? "Excluindo..." : "Excluir ciclo"}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => void salvarCiclo()}
                    disabled={saving || deleting}
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
    </>
  );
}
