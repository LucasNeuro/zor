"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash2, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { hubQueryKeys } from "@/lib/hub/hub-query-keys";
import { fetchHubFerramentasCustom } from "@/lib/hub/fetch-hub-ferramentas-custom";
import {
  catalogoBuiltinPorId,
  HUB_AGENTE_FERRAMENTAS_CATALOGO,
  isHubAgenteFerramentaId,
  type HubAgenteFerramentaId,
  type HubFerramentaCategoria,
} from "@/lib/hub/agente-ferramentas-registry";

type Row = {
  id: string;
  ferramenta_key: string;
  titulo: string;
  descricao_curta?: string | null;
  descricao_modelo: string;
  builtin_impl: string;
  smart_provider: string;
  smart_model: string | null;
  smart_prompt: string | null;
  ativo: boolean;
};

const OB = {
  verde: "var(--obra-verde, #003b26)",
  dourado: "var(--obra-dourado, #c9a24a)",
  douradoLight: "var(--obra-dourado-light, #e0b86a)",
  borda: "var(--obra-borda, #dcebd8)",
  texto: "var(--obra-texto, #0b2210)",
  texto2: "var(--obra-texto-2, #5d7a67)",
  texto3: "var(--obra-texto-3, #484f58)",
  surface: "var(--obra-dark-3, #eef7eb)",
  panel: "#0f1620",
  danger: "#f85149",
  dangerMuted: "rgba(248, 81, 73, 0.14)",
  ok: "#3fb950",
  okMuted: "rgba(63, 185, 80, 0.14)",
};

const CATEGORIA_SECAO: Record<
  HubFerramentaCategoria,
  { label: string; cor: string }
> = {
  cliente: { label: "Dados do cliente nesta conversa", cor: "#10b981" },
  analise: { label: "Análise e partilha", cor: "#3b82f6" },
  registos: { label: "Registos", cor: "#f59e0b" },
};

type ToolbarIconVariant = "green" | "red" | "slate" | "emphasis" | "gold" | "ia";

function toolbarIconButtonStyle(variant: ToolbarIconVariant, disabled: boolean): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    padding: 0,
    borderRadius: 8,
    flexShrink: 0,
    boxSizing: "border-box",
    cursor: disabled ? "not-allowed" : "pointer",
  };

  if (disabled) {
    return {
      ...base,
      border: `1px solid ${OB.borda}`,
      background: "#ffffff",
      color: OB.texto3,
      opacity: 0.72,
    };
  }

  switch (variant) {
    case "green":
      return {
        ...base,
        border: "1px solid rgba(63, 185, 80, 0.38)",
        background: OB.okMuted,
        color: OB.ok,
      };
    case "red":
      return {
        ...base,
        border: "1px solid rgba(248, 81, 73, 0.38)",
        background: OB.dangerMuted,
        color: OB.danger,
      };
    case "slate":
      return {
        ...base,
        border: `1px solid ${OB.borda}`,
        background: OB.surface,
        color: OB.texto2,
      };
    case "emphasis":
      return {
        ...base,
        border: `1px solid rgba(139, 148, 158, 0.35)`,
        background: "rgba(72, 79, 88, 0.2)",
        color: OB.texto,
      };
    case "gold":
      return {
        ...base,
        border: "1px solid rgba(201, 162, 74, 0.45)",
        background: "rgba(201, 162, 74, 0.14)",
        color: OB.dourado,
      };
    case "ia":
      return {
        ...base,
        border: "1px solid rgba(201, 162, 74, 0.42)",
        background: "rgba(201, 162, 74, 0.1)",
        color: OB.douradoLight,
      };
    default:
      return base;
  }
}

const inp: CSSProperties = {
  background: "#ffffff",
  border: `1px solid ${OB.borda}`,
  color: OB.texto,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box",
};

type Form = {
  titulo: string;
  slug_curto: string;
  descricao_curta: string;
  descricao_modelo: string;
  builtin_impl: string;
  smart_provider: string;
  smart_model: string;
  smart_prompt: string;
  ativo: boolean;
};

function slugCurtoFromKey(key: string): string {
  const k = String(key || "");
  return k.startsWith("hub_custom_") ? k.slice("hub_custom_".length) : k;
}

function emptyForm(): Form {
  return {
    titulo: "",
    slug_curto: "",
    descricao_curta: "",
    descricao_modelo: "",
    builtin_impl: "hub_lead_resumo",
    smart_provider: "none",
    smart_model: "",
    smart_prompt: "",
    ativo: true,
  };
}

function rowToForm(row: Row): Form {
  return {
    titulo: String(row.titulo || ""),
    slug_curto: slugCurtoFromKey(row.ferramenta_key),
    descricao_curta: row.descricao_curta != null ? String(row.descricao_curta) : "",
    descricao_modelo: String(row.descricao_modelo || ""),
    builtin_impl: String(row.builtin_impl || "hub_lead_resumo"),
    smart_provider: String(row.smart_provider || "none"),
    smart_model: row.smart_model != null ? String(row.smart_model) : "",
    smart_prompt: row.smart_prompt != null ? String(row.smart_prompt) : "",
    ativo: row.ativo !== false,
  };
}

function categoriaDaRow(row: Row): HubFerramentaCategoria {
  const bid = row.builtin_impl;
  if (!isHubAgenteFerramentaId(bid)) return "registos";
  return catalogoBuiltinPorId(bid)?.categoria ?? "registos";
}

export function CrmFerramentasCustomDrawer({
  open,
  onClose,
  onCustomListChanged,
}: {
  open: boolean;
  onClose: () => void;
  /** Chamado após criar/eliminar ferramenta para actualizar a página por trás do drawer (opcional). */
  onCustomListChanged?: () => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: hubQueryKeys.ferramentasCustom(),
    queryFn: () => fetchHubFerramentasCustom(internalApiHeaders(), true),
    enabled: open,
  });

  const rows = (q.data ?? []) as Row[];
  const [focusId, setFocusId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<HubFerramentaCategoria | "">("");
  const [sugerindo, setSugerindo] = useState(false);
  const [iaProgressPct, setIaProgressPct] = useState(0);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<Row | null>(null);

  const listaPendente = open && q.isPending;
  const listaErro =
    q.isError && q.error instanceof Error
      ? q.error.message
      : q.isError
        ? String(q.error)
        : null;
  const painelBusy = busy !== null || sugerindo || bulkLoading;

  const [drawerColumn, setDrawerColumn] = useState<"row" | "column">("row");
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setDrawerColumn(mq.matches ? "column" : "row");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const focusRow = focusId ? rows.find((r) => r.id === focusId) : undefined;

  const podeSugerirIa = Boolean(form.titulo.trim()) && !painelBusy;

  useEffect(() => {
    if (!open) {
      setFocusId(null);
      setCriando(false);
      setForm(emptyForm());
      setErro(null);
      setFiltroBusca("");
      setFiltroCategoria("");
      setSugerindo(false);
      setIaProgressPct(0);
      setBulkLoading(false);
      setConfirmDeleteRow(null);
      return;
    }
    /* Ao abrir: mesmo fluxo que «+» — formulário visível de imediato (padrão cargos). */
    setFocusId(null);
    setCriando(true);
    setForm(emptyForm());
    setErro(null);
  }, [open]);

  useEffect(() => {
    if (!confirmDeleteRow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRowId) {
        setConfirmDeleteRow(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDeleteRow, busyRowId]);

  const filtroNorm = filtroBusca.trim().toLowerCase();
  const listaFiltrada = useMemo(() => {
    return rows.filter((r) => {
      if (filtroCategoria && categoriaDaRow(r) !== filtroCategoria) return false;
      if (!filtroNorm) return true;
      const blob = [
        r.titulo,
        r.ferramenta_key,
        slugCurtoFromKey(r.ferramenta_key),
        r.descricao_curta,
        r.descricao_modelo,
        r.builtin_impl,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(filtroNorm);
    });
  }, [rows, filtroNorm, filtroCategoria]);

  const temFiltroLista = Boolean(filtroNorm || filtroCategoria);

  const porCategoria = useMemo(() => {
    const ordem: HubFerramentaCategoria[] = ["cliente", "analise", "registos"];
    const map = new Map<HubFerramentaCategoria, Row[]>();
    for (const c of ordem) map.set(c, []);
    for (const r of listaFiltrada) {
      const c = categoriaDaRow(r);
      map.get(c)!.push(r);
    }
    return ordem.map((c) => [c, map.get(c)!] as const).filter(([, lista]) => lista.length > 0);
  }, [listaFiltrada]);

  function abrirNovo() {
    setFocusId(null);
    setCriando(true);
    setForm(emptyForm());
    setErro(null);
  }

  function abrirEditar(row: Row) {
    setCriando(false);
    setFocusId(row.id);
    setForm(rowToForm(row));
    setErro(null);
  }

  async function sugerirComMistral() {
    const titulo = form.titulo.trim();
    if (!titulo) {
      setErro("Escreva um título antes de pedir sugestão.");
      return;
    }
    setErro(null);
    setIaProgressPct(6);
    setSugerindo(true);
    const tick = window.setInterval(() => {
      setIaProgressPct((p) => {
        if (p >= 92) return p;
        const step = Math.max(1, Math.round((92 - p) * (0.06 + Math.random() * 0.06)));
        return Math.min(92, p + step);
      });
    }, 180);
    let ok = false;
    try {
      const res = await fetch("/api/hub/ferramentas-custom/sugerir", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ titulo }),
      });
      const data = await res.json().catch(() => ({}));
      ok = res.ok;
      if (!res.ok) {
        setErro(typeof data?.error === "string" ? data.error : `Erro HTTP ${res.status}`);
        return;
      }
      const s = data?.sugestao as Partial<Form> | undefined;
      if (!s || typeof s !== "object") {
        setErro("Resposta sem sugestão.");
        ok = false;
        return;
      }
      setForm((f) => ({
        ...f,
        slug_curto: typeof s.slug_curto === "string" ? s.slug_curto : f.slug_curto,
        descricao_curta:
          typeof s.descricao_curta === "string" ? s.descricao_curta : f.descricao_curta,
        descricao_modelo:
          typeof s.descricao_modelo === "string" ? s.descricao_modelo : f.descricao_modelo,
        builtin_impl: typeof s.builtin_impl === "string" ? s.builtin_impl : f.builtin_impl,
        smart_provider:
          typeof s.smart_provider === "string" ? s.smart_provider : f.smart_provider,
        smart_prompt: typeof s.smart_prompt === "string" ? s.smart_prompt : f.smart_prompt,
      }));
    } finally {
      window.clearInterval(tick);
      if (ok) {
        setIaProgressPct(100);
        await new Promise((r) => setTimeout(r, 420));
      }
      setSugerindo(false);
      setIaProgressPct(0);
    }
  }

  async function salvar() {
    const titulo = form.titulo.trim();
    const descricao_modelo = form.descricao_modelo.trim();
    if (!titulo) {
      setErro("Título é obrigatório.");
      return;
    }
    if (!descricao_modelo) {
      setErro("A descrição para o modelo (quando invocar) é obrigatória.");
      return;
    }
    if (!isHubAgenteFerramentaId(form.builtin_impl)) {
      setErro("Função base inválida.");
      return;
    }

    setBusy("save");
    setErro(null);
    try {
      if (criando) {
        const res = await fetch("/api/hub/ferramentas-custom", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...internalApiHeaders() },
          body: JSON.stringify({
            titulo,
            slug_curto: form.slug_curto.trim() || undefined,
            descricao_curta: form.descricao_curta.trim() || null,
            descricao_modelo,
            builtin_impl: form.builtin_impl,
            smart_provider: form.smart_provider,
            smart_model: form.smart_model.trim() || null,
            smart_prompt: form.smart_prompt.trim() || null,
            ativo: form.ativo,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as Row & { error?: string };
        if (!res.ok) throw new Error(data.error || "Falha ao criar.");
        await qc.refetchQueries({ queryKey: hubQueryKeys.ferramentasCustom() });
        onCustomListChanged?.();
        setCriando(false);
        if (typeof data.id === "string") {
          setFocusId(data.id);
          setForm(rowToForm(data));
        }
        return;
      }

      if (!focusId) return;
      const res = await fetch(`/api/hub/ferramentas-custom/${encodeURIComponent(focusId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          titulo,
          descricao_curta: form.descricao_curta.trim() || null,
          descricao_modelo,
          builtin_impl: form.builtin_impl as HubAgenteFerramentaId,
          smart_provider: form.smart_provider,
          smart_model: form.smart_model.trim() || null,
          smart_prompt: form.smart_prompt.trim() || null,
          ativo: form.ativo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Falha ao guardar.");
      await qc.refetchQueries({ queryKey: hubQueryKeys.ferramentasCustom() });
      onCustomListChanged?.();
      setForm(rowToForm(data as Row));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  async function alternarAtivo(row: Row) {
    const novo = row.ativo === false;
    setBusyRowId(row.id);
    setErro(null);
    try {
      const res = await fetch(`/api/hub/ferramentas-custom/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ ativo: novo }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Falha.");
      await qc.invalidateQueries({ queryKey: hubQueryKeys.ferramentasCustom() });
      if (focusId === row.id) {
        setForm((f) => ({ ...f, ativo: novo }));
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusyRowId(null);
    }
  }

  async function definirTodosAtivosFerramentas(ativoAlvo: boolean) {
    const alvo = temFiltroLista ? listaFiltrada : rows;
    if (alvo.length === 0) return;
    setBulkLoading(true);
    setErro(null);
    try {
      const outcomes = await Promise.all(
        alvo.map(async (r) => {
          const res = await fetch(`/api/hub/ferramentas-custom/${encodeURIComponent(r.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...internalApiHeaders() },
            body: JSON.stringify({ ativo: ativoAlvo }),
          });
          return res.ok;
        })
      );
      if (outcomes.every(Boolean)) {
        await qc.invalidateQueries({ queryKey: hubQueryKeys.ferramentasCustom() });
        const alvoIds = new Set(alvo.map((r) => r.id));
        if (focusId && alvoIds.has(focusId)) {
          setForm((f) => ({ ...f, ativo: ativoAlvo }));
        }
      } else {
        setErro("Não foi possível actualizar todas as ferramentas.");
        await qc.invalidateQueries({ queryKey: hubQueryKeys.ferramentasCustom() });
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha em lote.");
      await qc.invalidateQueries({ queryKey: hubQueryKeys.ferramentasCustom() });
    } finally {
      setBulkLoading(false);
    }
  }

  async function confirmarEliminacao() {
    const row = confirmDeleteRow;
    if (!row) return;
    setBusyRowId(row.id);
    setErro(null);
    try {
      const res = await fetch(`/api/hub/ferramentas-custom/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        headers: internalApiHeaders(),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error || "Falha ao eliminar.");
      await qc.refetchQueries({ queryKey: hubQueryKeys.ferramentasCustom() });
      onCustomListChanged?.();
      setConfirmDeleteRow(null);
      if (focusId === row.id) {
        setFocusId(null);
        setForm(emptyForm());
        setCriando(true);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusyRowId(null);
    }
  }

  function abrirConfirmEliminar(row: Row) {
    setErro(null);
    setConfirmDeleteRow(row);
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fechar gestão de ferramentas custom"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 52,
          background: "rgba(0,0,0,0.55)",
          border: "none",
          padding: 0,
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(960px, 100vw)",
          zIndex: 53,
          background: OB.panel,
          borderLeft: `1px solid ${OB.borda}`,
          boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
        role="dialog"
        aria-modal
        aria-labelledby="ferramentas-custom-drawer-title"
      >
        <div
          style={{
            borderBottom: `1px solid ${OB.borda}`,
            padding: 16,
            background: "linear-gradient(180deg,#121a26 0%, #101722 100%)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <p
                style={{
                  margin: 0,
                  color: OB.texto2,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  fontWeight: 700,
                }}
              >
                ADMINISTRAÇÃO
              </p>
              <h3 id="ferramentas-custom-drawer-title" style={{ margin: "3px 0 0", color: OB.texto, fontSize: 17 }}>
                Ferramentas custom (tenant)
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: `1px solid ${OB.borda}`,
                background: OB.surface,
                color: OB.texto2,
                borderRadius: 8,
                width: 34,
                height: 34,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: "8px 0 0", color: OB.texto2, fontSize: 12, lineHeight: 1.45 }}>
            Nome e descrição próprios para o Mistral, com função base segura do Hub. Camada{" "}
            <strong style={{ color: OB.dourado }}>smart</strong> opcional (Mistral ou Gemini) pós-processa o JSON. Para
            Gemini, defina <code style={{ fontSize: 11, color: OB.douradoLight }}>GOOGLE_AI_API_KEY</code> ou{" "}
            <code style={{ fontSize: 11, color: OB.douradoLight }}>GEMINI_API_KEY</code> no{" "}
            <code style={{ fontSize: 11 }}>.env</code> do servidor (nunca commite a chave).
          </p>

          {!listaPendente ? (
            <>
              <div
                style={{
                  display: "flex",
                  flexWrap: "nowrap",
                  alignItems: "stretch",
                  gap: 0,
                  marginTop: 12,
                  borderRadius: 10,
                  border: `1px solid ${OB.borda}`,
                  overflowX: "auto",
                  maxWidth: "100%",
                  background: "#121923",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 140,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    background: "#0f1419",
                  }}
                >
                  <input
                    type="search"
                    value={filtroBusca}
                    onChange={(e) => setFiltroBusca(e.target.value)}
                    placeholder="Buscar título, chave, builtin…"
                    aria-label="Buscar ferramentas"
                    disabled={listaPendente}
                    style={{
                      flex: "1 1 96px",
                      minWidth: 72,
                      height: 32,
                      boxSizing: "border-box",
                      background: "#ffffff",
                      border: `1px solid ${OB.borda}`,
                      color: OB.texto,
                      borderRadius: 8,
                      padding: "0 10px",
                      fontSize: 12,
                    }}
                  />
                  <select
                    value={filtroCategoria}
                    onChange={(e) =>
                      setFiltroCategoria((e.target.value || "") as HubFerramentaCategoria | "")
                    }
                    aria-label="Filtrar por área da função base"
                    style={{
                      flex: "0 1 160px",
                      maxWidth: "min(200px, 40vw)",
                      height: 32,
                      boxSizing: "border-box",
                      background: "#ffffff",
                      border: `1px solid ${OB.borda}`,
                      color: OB.texto,
                      borderRadius: 8,
                      padding: "0 8px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    <option value="">Todas as áreas</option>
                    {(Object.keys(CATEGORIA_SECAO) as HubFerramentaCategoria[]).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORIA_SECAO[c].label}
                      </option>
                    ))}
                  </select>
                </div>
                {rows.length > 0 ? (
                  <>
                    <div
                      style={{
                        width: 1,
                        background: OB.borda,
                        flexShrink: 0,
                        alignSelf: "stretch",
                      }}
                      aria-hidden
                    />
                    <div
                      role="group"
                      aria-label="Em lote"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        background: "#141d29",
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => void definirTodosAtivosFerramentas(true)}
                        disabled={painelBusy}
                        title={
                          temFiltroLista
                            ? "Ativar todas as ferramentas visíveis nos filtros"
                            : "Ativar todas as ferramentas custom"
                        }
                        aria-label="Ativar todas as ferramentas"
                        style={toolbarIconButtonStyle("green", painelBusy)}
                      >
                        {bulkLoading ? (
                          <Loader2 size={17} strokeWidth={2} className="animate-spin" aria-hidden />
                        ) : (
                          <CheckCircle2 size={17} strokeWidth={2} aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void definirTodosAtivosFerramentas(false)}
                        disabled={painelBusy}
                        title={
                          temFiltroLista
                            ? "Desativar todas as ferramentas visíveis nos filtros"
                            : "Desativar todas as ferramentas custom"
                        }
                        aria-label="Desativar todas as ferramentas"
                        style={toolbarIconButtonStyle("red", painelBusy)}
                      >
                        <CircleSlash2 size={17} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </>
                ) : null}
                <div
                  style={{
                    width: 1,
                    background: OB.borda,
                    flexShrink: 0,
                    alignSelf: "stretch",
                  }}
                  aria-hidden
                />
                <div
                  role="group"
                  aria-label="Registo"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    background: "#161c26",
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={abrirNovo}
                    disabled={painelBusy}
                    title="Nova ferramenta"
                    aria-label="Nova ferramenta"
                    style={toolbarIconButtonStyle("gold", painelBusy)}
                  >
                    <Plus size={17} strokeWidth={2} aria-hidden />
                  </button>
                </div>
                <div
                  style={{
                    width: 1,
                    background: OB.borda,
                    flexShrink: 0,
                    alignSelf: "stretch",
                  }}
                  aria-hidden
                />
                <div
                  role="group"
                  aria-label="Sugestão por IA"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    background: "rgba(0, 59, 38, 0.15)",
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void sugerirComMistral()}
                    disabled={!podeSugerirIa}
                    title={
                      podeSugerirIa
                        ? "Sugerir ferramenta (Mistral) com base no título"
                        : "Preencha o título no formulário à direita"
                    }
                    aria-label="Sugerir com IA"
                    style={toolbarIconButtonStyle("ia", !podeSugerirIa)}
                  >
                    {sugerindo ? (
                      <Loader2 size={17} strokeWidth={2} className="animate-spin" aria-hidden />
                    ) : (
                      <Sparkles size={17} strokeWidth={2} aria-hidden />
                    )}
                  </button>
                </div>
              </div>
              {sugerindo ? (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        color: OB.douradoLight,
                      }}
                    >
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      A gerar sugestão…
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: OB.dourado,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {iaProgressPct}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: OB.surface,
                      border: `1px solid ${OB.borda}`,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${iaProgressPct}%`,
                        borderRadius: 999,
                        background: `linear-gradient(90deg, ${OB.verde} 0%, ${OB.dourado} 100%)`,
                        transition: "width 0.22s ease-out",
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: drawerColumn,
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <div
            style={{
              flex: drawerColumn === "column" ? "0 0 auto" : "0 0 clamp(300px, 48%, 520px)",
              maxHeight: drawerColumn === "column" ? "min(40vh, 300px)" : undefined,
              borderRight: drawerColumn === "column" ? "none" : `1px solid ${OB.borda}`,
              borderBottom: drawerColumn === "column" ? `1px solid ${OB.borda}` : "none",
              overflowY: "auto",
              padding: 12,
              minWidth: drawerColumn === "column" ? undefined : 0,
            }}
          >
            <p style={{ margin: "0 0 10px", color: OB.texto3, fontSize: 10, lineHeight: 1.45 }}>
              Aqui figuram só ferramentas <strong style={{ color: OB.dourado }}>custom</strong> do tenant (
              <code style={{ fontSize: 10 }}>hub_custom_*</code>). O catálogo <strong>builtin</strong> na página
              principal não é editado nesta lista.
            </p>
            {listaErro ? (
              <div
                style={{
                  marginBottom: 12,
                  padding: 10,
                  borderRadius: 8,
                  background: "#3a1518",
                  border: "1px solid #7f1d1d",
                  color: "#f87171",
                  fontSize: 12,
                }}
              >
                <strong style={{ display: "block", marginBottom: 6 }}>Não foi possível carregar a lista.</strong>
                {listaErro}
                <button
                  type="button"
                  onClick={() => {
                    void q.refetch();
                  }}
                  style={{
                    marginTop: 10,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1px solid ${OB.borda}`,
                    background: OB.surface,
                    color: OB.douradoLight,
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Tentar novamente
                </button>
              </div>
            ) : null}
            {listaPendente ? (
              <p style={{ color: OB.texto2, fontSize: 12 }}>Carregando…</p>
            ) : rows.length === 0 ? (
              <p style={{ color: OB.texto2, fontSize: 12 }}>
                Nenhuma ferramenta custom neste tenant. Use o formulário à direita para criar a primeira.
              </p>
            ) : listaFiltrada.length === 0 ? (
              <p style={{ color: OB.texto2, fontSize: 12 }}>Nenhum resultado com os filtros actuais.</p>
            ) : (
              porCategoria.map(([cat, lista], secIdx) => {
                const { label, cor } = CATEGORIA_SECAO[cat];
                return (
                  <div key={cat} style={{ marginTop: secIdx === 0 ? 0 : 16 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                        paddingBottom: 6,
                        borderBottom: `1px solid ${OB.borda}`,
                      }}
                    >
                      <span
                        style={{ width: 3, minWidth: 3, height: 14, borderRadius: 2, background: cor }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#b8c5d6", letterSpacing: 0.4 }}>
                        {label}
                      </span>
                      <span style={{ fontSize: 11, color: "#5c6b80" }}>({lista.length})</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {lista.map((r) => {
                        const sel = focusId === r.id && !criando;
                        const ativo = r.ativo !== false;
                        const smart = r.smart_provider !== "none" ? r.smart_provider : null;
                        return (
                          <div
                            key={r.id}
                            style={{
                              background: sel ? "#1a2838" : "#131c28",
                              border: `1px solid ${sel ? "rgba(201, 162, 74, 0.45)" : OB.borda}`,
                              borderRadius: 10,
                              padding: "10px 12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p
                                style={{
                                  margin: 0,
                                  color: "#0b2210",
                                  fontSize: 13,
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {r.titulo}
                              </p>
                              <p
                                style={{
                                  margin: "2px 0 0",
                                  color: "#8394ab",
                                  fontSize: 11,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                <code style={{ color: "#93c5fd" }}>{r.ferramenta_key}</code>
                                {" · "}
                                {r.builtin_impl}
                                {smart ? ` · smart:${smart}` : ""}
                                {!ativo ? " · inactiva" : ""}
                              </p>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 6,
                                alignItems: "center",
                                justifyContent: "flex-end",
                                flexShrink: 0,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => abrirEditar(r)}
                                disabled={painelBusy}
                                style={{
                                  border: `1px solid ${OB.borda}`,
                                  background: OB.surface,
                                  color: painelBusy ? OB.texto3 : OB.texto2,
                                  borderRadius: 8,
                                  padding: "6px 9px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: painelBusy ? "not-allowed" : "pointer",
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void alternarAtivo(r)}
                                disabled={painelBusy || busyRowId === r.id}
                                style={{
                                  border: `1px solid ${ativo ? "rgba(248, 81, 73, 0.35)" : "rgba(63, 185, 80, 0.35)"}`,
                                  background: ativo ? OB.dangerMuted : OB.okMuted,
                                  color: ativo ? OB.danger : OB.ok,
                                  borderRadius: 999,
                                  padding: "6px 10px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: painelBusy || busyRowId === r.id ? "wait" : "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {busyRowId === r.id ? "…" : ativo ? "Desativar" : "Ativar"}
                              </button>
                              <button
                                type="button"
                                title={`Eliminar permanentemente «${r.titulo}»`}
                                aria-label="Eliminar ferramenta permanentemente"
                                onClick={() => abrirConfirmEliminar(r)}
                                disabled={painelBusy || busyRowId === r.id || sugerindo}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: 34,
                                  height: 32,
                                  padding: 0,
                                  border: `1px solid rgba(248, 81, 73, 0.35)`,
                                  background: OB.dangerMuted,
                                  color: OB.danger,
                                  borderRadius: 8,
                                  cursor:
                                    painelBusy || busyRowId === r.id || sugerindo
                                      ? "not-allowed"
                                      : "pointer",
                                  opacity: painelBusy || busyRowId === r.id || sugerindo ? 0.45 : 1,
                                }}
                              >
                                <Trash2 size={15} aria-hidden />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16, minWidth: 0 }}>
            {erro ? (
              <div
                style={{
                  color: "#f87171",
                  background: "#3a1518",
                  border: "1px solid #7f1d1d",
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {erro}
              </div>
            ) : null}

            {!focusId && !criando ? (
              <p style={{ color: OB.texto2, fontSize: 13, marginTop: 24 }}>
                Seleccione uma ferramenta na lista ou clique em{" "}
                <strong style={{ color: OB.dourado }}>+</strong> para criar uma nova.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      background: criando ? "rgba(201, 162, 74, 0.2)" : "rgba(63, 185, 80, 0.16)",
                      color: criando ? OB.dourado : OB.ok,
                      border: `1px solid ${criando ? "rgba(201, 162, 74, 0.35)" : "rgba(63, 185, 80, 0.3)"}`,
                    }}
                  >
                    {criando ? "NOVO" : "EDITAR"}
                  </span>
                  <span style={{ fontSize: 11, color: OB.texto2, lineHeight: 1.45 }}>
                    Sugestão IA: ícone{" "}
                    <Sparkles size={13} strokeWidth={2} style={{ verticalAlign: "-2px", color: OB.dourado }} /> na
                    barra acima — preencha o <strong style={{ color: OB.texto }}>título</strong> primeiro.
                  </span>
                </div>

                {criando ? (
                  <label style={{ display: "block" }}>
                    <span style={{ display: "block", color: OB.texto2, fontSize: 11, marginBottom: 6 }}>
                      Slug curto (opcional — gera hub_custom_*)
                    </span>
                    <input
                      value={form.slug_curto}
                      onChange={(e) => setForm((p) => ({ ...p, slug_curto: e.target.value }))}
                      placeholder="ex.: resumo_vip"
                      style={{ ...inp, fontFamily: "ui-monospace, monospace" }}
                    />
                  </label>
                ) : focusRow ? (
                  <label style={{ display: "block" }}>
                    <span style={{ display: "block", color: OB.texto2, fontSize: 11, marginBottom: 6 }}>
                      Chave (só leitura)
                    </span>
                    <input
                      readOnly
                      value={focusRow.ferramenta_key}
                      style={{ ...inp, fontFamily: "ui-monospace, monospace", opacity: 0.85 }}
                    />
                  </label>
                ) : null}

                <label style={{ display: "block" }}>
                  <span style={{ display: "block", color: OB.texto2, fontSize: 11, marginBottom: 6 }}>
                    Título *
                  </span>
                  <input
                    value={form.titulo}
                    onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                    style={inp}
                  />
                </label>

                <label style={{ display: "block" }}>
                  <span style={{ display: "block", color: OB.texto2, fontSize: 11, marginBottom: 6 }}>
                    Descrição curta (admin / CRM)
                  </span>
                  <input
                    value={form.descricao_curta}
                    onChange={(e) => setForm((p) => ({ ...p, descricao_curta: e.target.value }))}
                    placeholder="Uma linha: o que esta ferramenta faz na prática"
                    style={inp}
                  />
                </label>

                <label style={{ display: "block" }}>
                  <span style={{ display: "block", color: OB.texto2, fontSize: 11, marginBottom: 6 }}>
                    Descrição para o modelo — quando deve invocar *
                  </span>
                  <textarea
                    value={form.descricao_modelo}
                    onChange={(e) => setForm((p) => ({ ...p, descricao_modelo: e.target.value }))}
                    rows={4}
                    style={{ ...inp, minHeight: 88, resize: "vertical" as const }}
                  />
                </label>

                <label style={{ display: "block" }}>
                  <span style={{ display: "block", color: OB.texto2, fontSize: 11, marginBottom: 6 }}>
                    Função base (execução no servidor)
                  </span>
                  <select
                    value={form.builtin_impl}
                    onChange={(e) => setForm((p) => ({ ...p, builtin_impl: e.target.value }))}
                    style={inp}
                  >
                    {HUB_AGENTE_FERRAMENTAS_CATALOGO.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.id} — {t.titulo}
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ display: "block" }}>
                  <span style={{ display: "block", color: OB.texto2, fontSize: 11, marginBottom: 8 }}>
                    IA interna (camada smart) — quem pós-processa o resultado da função base
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Provedor da camada smart"
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {(
                      [
                        {
                          value: "none",
                          titulo: "Nenhum",
                          subtitulo: "Devolver o JSON bruto ao agente principal.",
                        },
                        {
                          value: "mistral",
                          titulo: "Mistral",
                          subtitulo: "Mini-agente Mistral para resumir ou formatar o JSON.",
                        },
                        {
                          value: "gemini",
                          titulo: "Gemini",
                          subtitulo: "Mini-agente Gemini (exige GOOGLE_AI_API_KEY ou GEMINI_API_KEY no servidor).",
                        },
                      ] as const
                    ).map((opt) => {
                      const sel = form.smart_provider === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={sel}
                          disabled={painelBusy}
                          onClick={() => setForm((p) => ({ ...p, smart_provider: opt.value }))}
                          style={{
                            textAlign: "left",
                            cursor: painelBusy ? "not-allowed" : "pointer",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: `1px solid ${
                              sel ? "rgba(201, 162, 74, 0.55)" : OB.borda
                            }`,
                            background: sel ? "rgba(201, 162, 74, 0.1)" : "#131c28",
                            color: OB.texto,
                            boxSizing: "border-box",
                            width: "100%",
                          }}
                        >
                          <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>{opt.titulo}</span>
                          <span
                            style={{
                              display: "block",
                              marginTop: 4,
                              fontSize: 11,
                              color: OB.texto2,
                              lineHeight: 1.4,
                            }}
                          >
                            {opt.subtitulo}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {form.smart_provider !== "none" ? (
                  <>
                    <label style={{ display: "block" }}>
                      <span style={{ display: "block", color: OB.texto2, fontSize: 11, marginBottom: 6 }}>
                        Modelo opcional (vazio = padrão)
                      </span>
                      <input
                        value={form.smart_model}
                        onChange={(e) => setForm((p) => ({ ...p, smart_model: e.target.value }))}
                        placeholder={
                          form.smart_provider === "gemini" ? "gemini-2.0-flash" : "mistral-small-latest"
                        }
                        style={{ ...inp, fontFamily: "ui-monospace, monospace" }}
                      />
                    </label>
                    <label style={{ display: "block" }}>
                      <span style={{ display: "block", color: OB.texto2, fontSize: 11, marginBottom: 6 }}>
                        Instruções para o modelo interno
                      </span>
                      <textarea
                        value={form.smart_prompt}
                        onChange={(e) => setForm((p) => ({ ...p, smart_prompt: e.target.value }))}
                        rows={3}
                        style={{ ...inp, minHeight: 72, resize: "vertical" as const }}
                      />
                    </label>
                  </>
                ) : null}

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: painelBusy ? "not-allowed" : "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    disabled={painelBusy}
                    onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: OB.dourado }}
                  />
                  <span style={{ fontSize: 12, color: OB.texto }}>Ferramenta activa no catálogo</span>
                </label>

                <p style={{ margin: 0, fontSize: 10, color: OB.texto3, lineHeight: 1.45 }}>
                  Funções base declaradas em{" "}
                  <code style={{ fontSize: 10, color: OB.texto2 }}>lib/hub/agente-ferramentas-registry.ts</code>.
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    disabled={painelBusy}
                    onClick={() => void salvar()}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: "#238636",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: painelBusy ? "wait" : "pointer",
                    }}
                  >
                    {busy === "save" ? "A gravar…" : criando ? "Criar ferramenta" : "Guardar alterações"}
                  </button>
                  {criando ? (
                    <button
                      type="button"
                      disabled={painelBusy}
                      onClick={() => {
                        setCriando(false);
                        setForm(emptyForm());
                        setFocusId(null);
                      }}
                      style={{
                        padding: "10px 18px",
                        borderRadius: 8,
                        border: `1px solid ${OB.borda}`,
                        background: OB.surface,
                        color: OB.texto2,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: painelBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      Cancelar
                    </button>
                  ) : focusRow ? (
                    <button
                      type="button"
                      disabled={painelBusy || busyRowId === focusRow.id}
                      onClick={() => abrirConfirmEliminar(focusRow)}
                      style={{
                        padding: "10px 18px",
                        borderRadius: 8,
                        border: `1px solid rgba(248, 81, 73, 0.35)`,
                        background: OB.dangerMuted,
                        color: OB.danger,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: painelBusy ? "not-allowed" : "pointer",
                      }}
                    >
                      {busyRowId === focusRow.id ? "A eliminar…" : "Eliminar permanentemente"}
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {confirmDeleteRow ? (
        <>
          <button
            type="button"
            aria-label="Fechar confirmação de eliminação"
            onClick={() => {
              if (!busyRowId) setConfirmDeleteRow(null);
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              background: "rgba(0,0,0,0.72)",
              border: "none",
              padding: 0,
              cursor: busyRowId ? "wait" : "pointer",
            }}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-del-title"
            aria-describedby="confirm-del-desc"
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 61,
              width: "min(420px, calc(100vw - 32px))",
              background: "linear-gradient(180deg,#161d2a 0%, #121822 100%)",
              border: `1px solid ${OB.borda}`,
              borderRadius: 12,
              boxShadow: "0 24px 48px rgba(0,0,0,0.55)",
              padding: "20px 22px 18px",
            }}
          >
            <h4
              id="confirm-del-title"
              style={{
                margin: "0 0 10px",
                color: OB.texto,
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              Eliminar ferramenta custom?
            </h4>
            <p id="confirm-del-desc" style={{ margin: 0, color: OB.texto2, fontSize: 13, lineHeight: 1.5 }}>
              <strong style={{ color: "#0b2210" }}>{confirmDeleteRow.titulo}</strong>
              <br />
              <code style={{ fontSize: 12, color: "#93c5fd" }}>{confirmDeleteRow.ferramenta_key}</code>
              <br />
              <br />
              Esta acção remove o registo na base de dados. Agentes que tiverem esta chave em{" "}
              <code style={{ fontSize: 11 }}>uso_ferramentas_ia</code> podem ficar com referência órfã até limpar manualmente a
              ficha do agente.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={Boolean(busyRowId)}
                onClick={() => setConfirmDeleteRow(null)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: `1px solid ${OB.borda}`,
                  background: OB.surface,
                  color: OB.texto2,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: busyRowId ? "not-allowed" : "pointer",
                  opacity: busyRowId ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(busyRowId)}
                onClick={() => void confirmarEliminacao()}
                style={{
                  padding: "9px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(248, 81, 73, 0.45)",
                  background: OB.dangerMuted,
                  color: OB.danger,
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: busyRowId ? "wait" : "pointer",
                }}
              >
                {busyRowId === confirmDeleteRow.id ? "A eliminar…" : "Eliminar permanentemente"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
