"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { AgenteNovoWizard } from "@/components/crm/AgenteNovoWizard";

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

function AgentesView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openedFromQuery = useRef(false);
  const { setSlot } = useCrmHeaderSlot();

  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [modoLista, setModoLista] = useState<ListMode>("todos");
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [drawerNovoOpen, setDrawerNovoOpen] = useState(false);
  const [drawerCargosOpen, setDrawerCargosOpen] = useState(false);
  const [alternandoAtivoSlug, setAlternandoAtivoSlug] = useState<string | null>(null);
  const [cargos, setCargos] = useState<CargoCatalogo[]>([]);
  const [carregandoCargos, setCarregandoCargos] = useState(false);
  const [erroCargos, setErroCargos] = useState<string | null>(null);
  const [alternandoCargoSlug, setAlternandoCargoSlug] = useState<string | null>(null);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("editar");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErro, setDetailErro] = useState<string | null>(null);
  const [detailAgente, setDetailAgente] = useState<Agente | null>(null);
  const [logs, setLogs] = useState<AgenteLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsErro, setLogsErro] = useState<string | null>(null);
  const [salvandoDetalhe, setSalvandoDetalhe] = useState(false);

  const [editNome, setEditNome] = useState("");
  const [editMercados, setEditMercados] = useState<string[]>([]);
  const [editBio, setEditBio] = useState("");
  const [editTom, setEditTom] = useState("");
  const [editEstilo, setEditEstilo] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editAtivo, setEditAtivo] = useState(true);

  const detalheAberto = !!selectedSlug;

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

  useEffect(() => {
    carregarAgentes();
  }, [carregarAgentes]);

  useEffect(() => {
    if (!drawerCargosOpen) return;
    carregarCargos();
  }, [drawerCargosOpen, carregarCargos]);

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
    setLogs([]);
    setLogsErro(null);
  }, [selectedSlug, carregarDetalhe]);

  useEffect(() => {
    if (!selectedSlug || detailTab !== "logs") return;
    if (logs.length > 0 || logsLoading) return;
    void carregarLogs(selectedSlug);
  }, [selectedSlug, detailTab, logs.length, logsLoading, carregarLogs]);

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setDrawerCargosOpen(true)}
            style={{
              background: "#1b2330",
              color: "#9fb0c6",
              border: "1px solid #344256",
              borderRadius: 8,
              padding: "10px 14px",
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
              background: "#003b26",
              color: "#c9a24a",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Novo agente
          </button>
        </div>
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
          .filter((a) => {
            if (modoLista === "todos") return true;
            if (modoLista === "ativos") return a.ativo !== false && !a.arquivado_em;
            if (modoLista === "inativos") return a.ativo === false && !a.arquivado_em;
            return !!a.arquivado_em;
          })
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
                  {opt.label}
                </button>
              );
            })}
            {!carregando && !erroLista && (
              <span style={{ fontSize: 12, color: "#708096", marginLeft: 6 }}>
                {agentes.length} agente{agentes.length === 1 ? "" : "s"}
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
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: 14,
            }}
          >
            {agentes.map((agente) => {
              const segCor = SEGMENTO_COR[String(agente.segmento || agente.area || "")] || "#7d8a9a";
              const nivelCor = NIVEL_COR[String(agente.nivel || "")] || "#7d8a9a";
              const ativo = agente.ativo !== false;
              const avatarUrl = typeof agente.avatar_url === "string" && agente.avatar_url.trim() ? agente.avatar_url.trim() : null;
              const selecionado = selectedSlug === agente.agente_slug;

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
                    background: "linear-gradient(160deg, #161f2b 0%, #121a24 52%, #111821 100%)",
                    border: selecionado ? "1px solid #c9a24a66" : "1px solid #273243",
                    borderRadius: 14,
                    padding: 14,
                    cursor: "pointer",
                    boxShadow: selecionado ? "0 12px 36px rgba(0,0,0,0.35)" : "0 8px 22px rgba(0,0,0,0.24)",
                    transition: "all 150ms ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: segCor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: 700,
                        overflow: "hidden",
                        border: "1px solid #ffffff22",
                      }}
                    >
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        iniciais(agente.nome)
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: "#f0f5ff", fontWeight: 700, fontSize: 15, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {agente.nome}
                      </p>
                      <p style={{ color: "#94a3b8", fontSize: 11, margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {agente.cargo}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {agente.segmento && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${segCor}1f`, color: segCor, border: `1px solid ${segCor}44` }}>
                        {agente.segmento}
                      </span>
                    )}
                    {agente.nivel && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${nivelCor}1f`, color: nivelCor, border: `1px solid ${nivelCor}44` }}>
                        {agente.nivel}
                      </span>
                    )}
                    {(modoLista === "arquivados" || modoLista === "todos") && agente.arquivado_em && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#7c3aed1f", color: "#c4b5fd", border: "1px solid #7c3aed44" }}>
                        Arquivado
                      </span>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: ativo ? "#003b2620" : "#b3261e20", color: ativo ? "#22c55e" : "#ef4444", border: `1px solid ${ativo ? "#22c55e44" : "#ef444444"}` }}>
                      {ativo ? "Ativo" : "Inativo"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => alternarAtivo(agente, e)}
                      disabled={!!agente.arquivado_em || alternandoAtivoSlug === agente.agente_slug}
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "4px 8px",
                        borderRadius: 8,
                        border: "1px solid #344256",
                        background: "#1d2633",
                        color: "#afbed1",
                        cursor: agente.arquivado_em ? "not-allowed" : "pointer",
                        opacity: agente.arquivado_em ? 0.5 : 1,
                      }}
                    >
                      {alternandoAtivoSlug === agente.agente_slug ? "..." : ativo ? "Desativar" : "Ativar"}
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
                        <button
                          type="button"
                          onClick={() => alternarCargoAtivo(cargo)}
                          disabled={alternandoCargoSlug === slug}
                          style={{
                            flexShrink: 0,
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
