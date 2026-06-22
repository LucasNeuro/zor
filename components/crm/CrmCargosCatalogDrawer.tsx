"use client";

import type { ChangeEventHandler, CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchHubCargosCatalog } from "@/lib/hub/fetch-hub-cargos-catalog";
import {
  hubQueryKeys,
  invalidateCargosCatalog,
  patchCargosCache,
  patchCargosManyCache,
} from "@/lib/hub/hub-query-keys";
import {
  CheckCircle2,
  CircleSlash2,
  ListChecks,
  ListX,
  Check,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Power,
  Sparkles,
  Trash2,
} from "lucide-react";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { hubApiHeaders } from "@/lib/internal-api-headers-client";
import { slugifyCargoSlug } from "@/lib/hub/cargo-slug";
import {
  especialidadesExemploParaSegmento,
  nomesSegmentosConceito,
  segmentoNoConceito,
} from "@/lib/hub/documento-conceito-catalogo";
import { CrmIconButtonGroup } from "@/components/crm/CrmIconButtonGroup";
import {
  crmBtnDangerSoft,
  crmBtnPrimary,
  crmBtnSecondary,
} from "@/lib/crm/crm-button-styles";
import { RF } from "@/lib/crm/crm-retrofit-dark-theme";

const SEGMENTO_COR: Record<string, string> = {
  Marketing: "#3b82f6",
  Comercial: "#10b981",
  Operações: "#f59e0b",
  Suporte: "#6366f1",
};

/** Tokens retrofit escuro Waje — sideover unificado. */
const OB = RF;

const lbl: CSSProperties = {
  display: "block",
  color: OB.label,
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 6,
};

type ToolbarIconVariant = "green" | "red" | "slate" | "emphasis" | "primary" | "ia";

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
      background: OB.surface,
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
    case "primary":
      return {
        ...base,
        border: "none",
        background: OB.verde,
        color: OB.limao,
      };
    case "ia":
      return {
        ...base,
        border: `1px solid ${OB.borda}`,
        background: OB.okMuted,
        color: OB.limao,
      };
    default:
      return base;
  }
}

type CargoRow = Record<string, unknown> & { slug?: string };

function segmentoFromArea(area: unknown): string {
  const a = String(area ?? "").trim().toLowerCase();
  if (!a || a === "geral") return "";
  const map: Record<string, string> = {
    comercial: "Comercial",
    marketing: "Marketing",
    operacoes: "Operações",
    operac: "Operações",
    suporte: "Suporte",
    financeiro: "Financeiro",
  };
  return map[a] ?? a.charAt(0).toUpperCase() + a.slice(1);
}

function segmentoLabelCargo(c: CargoRow): string {
  const seg = String(c.segmento ?? "").trim();
  if (seg) return seg;
  const fromArea = segmentoFromArea(c.area);
  return fromArea || "Outros";
}

type CargoFormFields = {
  slug: string;
  titulo: string;
  novo_slug: string;
  segmento: string;
  especialidade: string;
  descricao_curta: string;
  area: string;
  nivel: string;
  modelo_padrao: string;
  modelo_critico: string;
  modelo_alto_valor: string;
  supervisor_slug: string;
  pode_fazer_padrao: string;
  nao_pode_fazer_padrao: string;
  prompt_template: string;
  saudacao_cliente: string;
  usar_perguntas_essenciais: boolean;
  ordem_perguntas_essenciais: "inicio" | "final";
  perguntas_essenciais: string;
  comprimento_padrao: string;
  descricao: string;
  limite_autonomia_brl: string;
  ativo: boolean;
  propagar_titulo: boolean;
};

function emptyForm(): CargoFormFields {
  return {
    slug: "",
    titulo: "",
    novo_slug: "",
    segmento: "",
    especialidade: "",
    descricao_curta: "",
    area: "geral",
    nivel: "3",
    modelo_padrao: "mistral",
    modelo_critico: "mistral",
    modelo_alto_valor: "mistral",
    supervisor_slug: "",
    pode_fazer_padrao: "",
    nao_pode_fazer_padrao: "",
    prompt_template: "",
    saudacao_cliente: "",
    usar_perguntas_essenciais: false,
    ordem_perguntas_essenciais: "inicio",
    perguntas_essenciais: "",
    comprimento_padrao: "Máx. 2 frases por mensagem.",
    descricao: "",
    limite_autonomia_brl: "5000",
    ativo: true,
    propagar_titulo: false,
  };
}

function rowToForm(row: CargoRow): CargoFormFields {
  const lines = (...keys: string[]) => {
    for (const key of keys) {
      const v = row[key];
      if (Array.isArray(v)) return v.map((x) => String(x)).join("\n");
      if (typeof v === "string" && v.trim()) {
        return v
          .split(/\n|,/)
          .map((x) => x.trim())
          .filter(Boolean)
          .join("\n");
      }
    }
    return "";
  };
  return {
    slug: String(row.slug ?? ""),
    titulo: String(row.titulo ?? row.nome ?? "").trim(),
    novo_slug: "",
    segmento: String(row.segmento ?? "").trim() || segmentoFromArea(row.area),
    especialidade: String(row.especialidade ?? ""),
    descricao_curta: String(row.descricao_curta ?? ""),
    area: String(row.area ?? "geral"),
    nivel: String(row.nivel ?? "3"),
    modelo_padrao: String(row.modelo_padrao ?? "mistral"),
    modelo_critico: String(row.modelo_critico ?? "mistral"),
    modelo_alto_valor: String(row.modelo_alto_valor ?? "mistral"),
    supervisor_slug: row.supervisor_slug != null ? String(row.supervisor_slug) : "",
    pode_fazer_padrao: lines("pode_fazer_padrao", "pode_fazer"),
    nao_pode_fazer_padrao: lines("nao_pode_fazer_padrao", "nao_pode_fazer"),
    prompt_template: String(row.prompt_template ?? ""),
    saudacao_cliente: String(row.saudacao_cliente ?? ""),
    usar_perguntas_essenciais: row.usar_perguntas_essenciais === true,
    ordem_perguntas_essenciais:
      row.ordem_perguntas_essenciais === "final" ? "final" : "inicio",
    perguntas_essenciais: lines("perguntas_essenciais"),
    comprimento_padrao: String(row.comprimento_padrao ?? ""),
    descricao: String(row.descricao ?? ""),
    limite_autonomia_brl:
      row.limite_autonomia_brl != null && row.limite_autonomia_brl !== ""
        ? String(row.limite_autonomia_brl)
        : "",
    ativo: row.ativo !== false,
    propagar_titulo: false,
  };
}

function splitLines(blob: string): string[] {
  return blob
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeSugestao(prev: CargoFormFields, s: Record<string, unknown>): CargoFormFields {
  const next = { ...prev };
  const asLines = (value: unknown): string | null => {
    if (Array.isArray(value)) {
      return value
        .map((x) => String(x).trim())
        .filter(Boolean)
        .join("\n");
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(/\n|,/)
        .map((x) => x.trim())
        .filter(Boolean)
        .join("\n");
    }
    return null;
  };
  const pickStr = (field: keyof CargoFormFields, srcKey: string) => {
    const v = s[srcKey];
    if (typeof v === "string" && v.trim()) (next as Record<string, unknown>)[field] = v.trim();
  };
  pickStr("titulo", "titulo");
  pickStr("segmento", "segmento");
  pickStr("especialidade", "especialidade");
  pickStr("descricao_curta", "descricao_curta");
  pickStr("area", "area");
  pickStr("modelo_padrao", "modelo_padrao");
  pickStr("modelo_critico", "modelo_critico");
  pickStr("modelo_alto_valor", "modelo_alto_valor");
  pickStr("prompt_template", "prompt_template");
  pickStr("saudacao_cliente", "saudacao_cliente");
  pickStr("comprimento_padrao", "comprimento_padrao");
  if (typeof s.usar_perguntas_essenciais === "boolean") {
    next.usar_perguntas_essenciais = s.usar_perguntas_essenciais;
  }
  if (s.ordem_perguntas_essenciais === "inicio" || s.ordem_perguntas_essenciais === "final") {
    next.ordem_perguntas_essenciais = s.ordem_perguntas_essenciais;
  }
  const perguntasEssenciais =
    asLines(s.perguntas_essenciais) ??
    asLines(s.perguntas_obrigatorias) ??
    asLines(s.perguntas) ??
    null;
  if (perguntasEssenciais != null) next.perguntas_essenciais = perguntasEssenciais;
  pickStr("descricao", "descricao");
  if (typeof s.supervisor_slug === "string") {
    next.supervisor_slug = s.supervisor_slug.trim();
  }
  if (typeof s.nivel === "number" && Number.isFinite(s.nivel)) {
    next.nivel = String(Math.min(5, Math.max(1, Math.round(s.nivel))));
  }
  if (typeof s.limite_autonomia_brl === "number" && Number.isFinite(s.limite_autonomia_brl)) {
    next.limite_autonomia_brl = String(Math.max(0, s.limite_autonomia_brl));
  }
  const pode =
    asLines(s.pode_fazer_padrao) ??
    asLines(s.pode_fazer) ??
    asLines(s.capacidades) ??
    null;
  if (pode != null) next.pode_fazer_padrao = pode;
  const naoPode =
    asLines(s.nao_pode_fazer_padrao) ??
    asLines(s.nao_pode_fazer) ??
    asLines(s.restricoes) ??
    null;
  if (naoPode != null) next.nao_pode_fazer_padrao = naoPode;
  return next;
}

function slugSugeridoDoTitulo(titulo: string): string {
  const t = titulo.trim();
  return t ? slugifyCargoSlug(t) : "";
}

const inp = {
  background: "rgba(6, 13, 8, 0.85)",
  border: `1px solid ${OB.borda}`,
  color: OB.texto,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
  width: "100%",
  boxSizing: "border-box" as const,
};

/** Checkbox alinhado ao tema CRM (evita quadrados brancos do sistema no modo escuro). */
function ObraCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  "aria-label"?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);

  const parcial = !!indeterminate && !checked;

  return (
    <label
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        flexShrink: 0,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={ariaLabel}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          width: "100%",
          height: "100%",
          margin: 0,
          cursor: disabled ? "not-allowed" : "pointer",
          zIndex: 1,
        }}
      />
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: `1px solid ${
            checked || parcial ? "rgba(146, 255, 0, 0.55)" : OB.borda
          }`,
          background: checked ? OB.verde : parcial ? OB.okMuted : "rgba(6, 13, 8, 0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: disabled ? 0.45 : 1,
          boxSizing: "border-box",
          boxShadow:
            checked || parcial ? `inset 0 0 0 1px rgba(146, 255, 0, 0.2)` : undefined,
        }}
      >
        {checked ? (
          <Check size={11} strokeWidth={3} style={{ color: OB.limao }} aria-hidden />
        ) : parcial ? (
          <Minus size={11} strokeWidth={3} style={{ color: OB.limao }} aria-hidden />
        ) : null}
      </span>
    </label>
  );
}

export function CrmCargosCatalogDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const cargosQuery = useQuery({
    queryKey: hubQueryKeys.cargosCatalog(),
    queryFn: async () => {
      const res = await fetchHubCargosCatalog();
      if (!res.ok) throw new Error(res.error);
      return res.cargos as CargoRow[];
    },
    enabled: open,
  });
  const cargos = cargosQuery.data ?? [];
  const cargosListaPendente =
    open && (cargosQuery.isPending || (cargosQuery.isFetching && cargosQuery.data === undefined));
  const erroExibicao = cargosQuery.isError
    ? cargosQuery.error instanceof Error
      ? cargosQuery.error.message
      : "Falha ao carregar cargos."
    : null;

  const [erro, setErro] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  type ConfirmExclusaoCargo =
    | null
    | { kind: "one"; slug: string; rotulo: string }
    | { kind: "batch"; slugs: string[] };
  const [confirmExclusaoCargo, setConfirmExclusaoCargo] = useState<ConfirmExclusaoCargo>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [sugerindo, setSugerindo] = useState(false);
  const [iaProgressPct, setIaProgressPct] = useState(0);
  const iaAbortRef = useRef<AbortController | null>(null);
  const iaTickRef = useRef<number | null>(null);

  /** Selecção para eliminar vários cargos de uma vez */
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(() => new Set());

  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");

  /** Slug da linha em edição; vazio em modo criar */
  const [focusSlug, setFocusSlug] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState<CargoFormFields>(() => emptyForm());
  /** Quando true, o slug deixa de ser derivado automaticamente do título. */
  const slugEditadoManualRef = useRef(false);
  /** Evita duplo POST ao clicar «Guardar» duas vezes seguidas. */
  const salvarLockRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setFocusSlug(null);
      setCriando(false);
      setForm(emptyForm());
      setSelectedSlugs(new Set());
      setFiltroBusca("");
      setFiltroSetor("");
      slugEditadoManualRef.current = false;
    }
  }, [open]);

  const setoresOpcoes = useMemo(() => {
    const s = new Set<string>(nomesSegmentosConceito());
    for (const c of cargos) {
      const seg = segmentoLabelCargo(c);
      if (seg !== "Outros") s.add(seg);
    }
    return [...s].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [cargos]);

  const especialidadesDatalistOpcoes = useMemo(() => {
    const ex = especialidadesExemploParaSegmento(form.segmento);
    const seg = form.segmento.trim().toLowerCase();
    const sameSeg = cargos
      .filter((c) => String((c as { segmento?: string }).segmento || "").trim().toLowerCase() === seg)
      .map((c) => String((c as { especialidade?: string }).especialidade || "").trim())
      .filter(Boolean);
    return [...new Set([...ex, ...sameSeg])];
  }, [cargos, form.segmento]);

  const segmentoForaDoConceito =
    Boolean(form.segmento.trim()) && !segmentoNoConceito(form.segmento);

  const cargosFiltrados = useMemo(() => {
    const q = filtroBusca.trim().toLowerCase();
    const setorSel = filtroSetor.trim();
    return cargos.filter((c) => {
      const seg = segmentoLabelCargo(c);
      if (setorSel && seg !== setorSel) return false;
      if (!q) return true;
      const slug = String(c.slug || "").toLowerCase();
      const titulo = String(c.titulo || c.nome || "").toLowerCase();
      const esp = String(c.especialidade || "").toLowerCase();
      const segL = seg.toLowerCase();
      return titulo.includes(q) || slug.includes(q) || esp.includes(q) || segL.includes(q);
    });
  }, [cargos, filtroBusca, filtroSetor]);

  const cargosPorSegmento = useMemo(() => {
    const m = new Map<string, CargoRow[]>();
    for (const c of cargosFiltrados) {
      const seg = segmentoLabelCargo(c);
      const bucket = m.get(seg);
      if (bucket) bucket.push(c);
      else m.set(seg, [c]);
    }
    const keys = [...m.keys()].sort((a, b) => {
      if (a === "Outros") return 1;
      if (b === "Outros") return -1;
      return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
    });
    return keys.map((k) => {
      const list = [...(m.get(k) || [])];
      list.sort((a, b) =>
        String(a.titulo || a.nome || a.slug).localeCompare(String(b.titulo || b.nome || b.slug), "pt-BR", {
          sensitivity: "base",
        })
      );
      return [k, list] as const;
    });
  }, [cargosFiltrados]);

  const temFiltroLista = Boolean(filtroBusca.trim()) || Boolean(filtroSetor.trim());

  const painelBusy = cargosListaPendente || bulkLoading || bulkDeleting || busySlug !== null;

  const podeSugerirIa =
    !cargosListaPendente && (criando || focusSlug !== null) && form.titulo.trim().length > 0;

  async function eliminarPorSlug(slug: string, tituloOuSlugParaMsg: string) {
    const rotulo = tituloOuSlugParaMsg.trim() || slug;
    setBusySlug(slug);
    setErro(null);
    try {
      const res = await fetch(`/api/hub/cargos?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
        headers: await hubApiHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(typeof data?.error === "string" ? data.error : `Erro HTTP ${res.status}`);
        return;
      }
      await invalidateCargosCatalog(queryClient);
      setSelectedSlugs((prev) => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
      if (focusSlug === slug) {
        setFocusSlug(null);
        setCriando(false);
        setForm(emptyForm());
      }
    } finally {
      setBusySlug(null);
    }
  }

  async function eliminarSeleccionados(slugs: string[]) {
    if (slugs.length === 0) return;
    setBulkDeleting(true);
    setErro(null);
    try {
      const res = await fetch("/api/hub/cargos/delete-batch", {
        method: "POST",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ slugs }),
      });
      const data = await res.json().catch(() => ({}));
      const deleted = Array.isArray(data?.deleted) ? (data.deleted as string[]) : [];
      const blocked = Array.isArray(data?.blocked) ? (data.blocked as { slug: string; error: string }[]) : [];

      setSelectedSlugs((prev) => {
        const next = new Set(prev);
        for (const s of deleted) next.delete(s);
        return next;
      });

      if (focusSlug && deleted.includes(focusSlug)) {
        setFocusSlug(null);
        setCriando(false);
        setForm(emptyForm());
      }

      await invalidateCargosCatalog(queryClient);

      if (blocked.length > 0) {
        const linhas = blocked.map((b) => `• ${b.slug}: ${b.error}`).join("\n");
        setErro(
          deleted.length > 0
            ? `${deleted.length} eliminado(s). Bloqueados (${blocked.length}):\n${linhas}`
            : `Nenhum cargo eliminado. Motivos:\n${linhas}`
        );
      } else if (!res.ok && typeof data?.error === "string") {
        setErro(data.error);
      }
    } catch (e) {
      setErro((e as Error)?.message || "Falha ao eliminar em lote.");
      await invalidateCargosCatalog(queryClient);
    } finally {
      setBulkDeleting(false);
    }
  }

  function seleccionarTodosDaLista() {
    const todos = cargosFiltrados.map((c) => String(c.slug || "").trim()).filter(Boolean);
    setSelectedSlugs(new Set(todos));
  }

  function limparSeleccionados() {
    setSelectedSlugs(new Set());
  }

  async function alternarAtivo(cargo: CargoRow) {
    const slug = String(cargo.slug || "").trim();
    if (!slug) return;
    const proximo = cargo.ativo === false;
    setBusySlug(slug);
    try {
      const res = await fetch("/api/hub/cargos", {
        method: "PATCH",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ativo: proximo }),
      });
      if (!res.ok) return;
      patchCargosCache(queryClient, slug, { ativo: proximo });
      if (focusSlug === slug) setForm((f) => ({ ...f, ativo: proximo }));
    } finally {
      setBusySlug(null);
    }
  }

  async function definirTodosAtivos(ativoAlvo: boolean) {
    const alvo = temFiltroLista ? cargosFiltrados : cargos;
    if (alvo.length === 0) return;
    setBulkLoading(true);
    setErro(null);
    try {
      const outcomes = await Promise.all(
        alvo.map(async (c) => {
          const slug = String(c.slug || "").trim();
          if (!slug) return false;
          const res = await fetch("/api/hub/cargos", {
            method: "PATCH",
            headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
            body: JSON.stringify({ slug, ativo: ativoAlvo }),
          });
          return res.ok;
        })
      );
      if (outcomes.every(Boolean)) {
        if (temFiltroLista) {
          const slugsAlvo = new Set(alvo.map((c) => String(c.slug || "").trim()).filter(Boolean));
          patchCargosManyCache(
            queryClient,
            alvo.map((c) => ({ slug: String(c.slug || "").trim(), ativo: ativoAlvo })).filter((u) => u.slug.length > 0)
          );
          if (focusSlug && slugsAlvo.has(focusSlug)) {
            setForm((f) => ({ ...f, ativo: ativoAlvo }));
          }
        } else {
          queryClient.setQueryData<CargoRow[]>(hubQueryKeys.cargosCatalog(), (prev) =>
            prev?.map((c) => ({ ...c, ativo: ativoAlvo }))
          );
          setForm((f) => ({ ...f, ativo: ativoAlvo }));
        }
      } else {
        setErro("Não foi possível atualizar todos os cargos.");
        void invalidateCargosCatalog(queryClient);
      }
    } catch (e) {
      setErro((e as Error)?.message || "Falha em lote.");
      void invalidateCargosCatalog(queryClient);
    } finally {
      setBulkLoading(false);
    }
  }

  function abrirNovo() {
    slugEditadoManualRef.current = false;
    setCriando(true);
    setFocusSlug(null);
    setForm(emptyForm());
  }

  function abrirEditar(cargo: CargoRow) {
    const slug = String(cargo.slug || "");
    slugEditadoManualRef.current = false;
    setCriando(false);
    setFocusSlug(slug);
    setForm(rowToForm(cargo));
  }

  function actualizarTituloNovo(titulo: string) {
    setForm((p) => {
      const next = { ...p, titulo };
      if (criando && !slugEditadoManualRef.current) {
        next.slug = slugSugeridoDoTitulo(titulo);
      }
      return next;
    });
  }

  function actualizarSlugNovo(valor: string) {
    if (!valor.trim()) slugEditadoManualRef.current = false;
    else slugEditadoManualRef.current = true;
    setForm((p) => ({ ...p, slug: valor }));
  }

  async function salvar() {
    if (salvarLockRef.current) return;
    const titulo = form.titulo.trim();
    if (!titulo) {
      setErro("Título é obrigatório.");
      return;
    }
    const nivelNum = Math.min(5, Math.max(1, Math.round(Number(form.nivel) || 3)));
    const limRaw = form.limite_autonomia_brl.trim();
    const limNum = limRaw.length ? Math.max(0, Number(limRaw)) : undefined;

    const basePayload: Record<string, unknown> = {
      titulo,
      segmento: form.segmento.trim() || null,
      especialidade: form.especialidade.trim() || null,
      descricao_curta: form.descricao_curta.trim() || null,
      area: form.area.trim() || "geral",
      nivel: nivelNum,
      modelo_padrao: form.modelo_padrao.trim() || "mistral",
      modelo_critico: form.modelo_critico.trim() || "mistral",
      modelo_alto_valor: form.modelo_alto_valor.trim() || "mistral",
      supervisor_slug: form.supervisor_slug.trim() || null,
      pode_fazer_padrao: splitLines(form.pode_fazer_padrao),
      nao_pode_fazer_padrao: splitLines(form.nao_pode_fazer_padrao),
      prompt_template: form.prompt_template.trim(),
      saudacao_cliente: form.saudacao_cliente.trim(),
      usar_perguntas_essenciais: form.usar_perguntas_essenciais,
      ordem_perguntas_essenciais: form.ordem_perguntas_essenciais,
      perguntas_essenciais: splitLines(form.perguntas_essenciais),
      comprimento_padrao: form.comprimento_padrao.trim(),
      descricao: form.descricao.trim(),
      ativo: form.ativo,
    };
    if (limNum !== undefined && Number.isFinite(limNum)) {
      basePayload.limite_autonomia_brl = limNum;
    }

    salvarLockRef.current = true;
    setBusySlug("_save");
    setErro(null);
    try {
      if (criando || !focusSlug) {
        const slugDigitado = form.slug.trim();
        const slugFinal = slugDigitado ? slugifyCargoSlug(slugDigitado) : slugifyCargoSlug(titulo);
        const res = await fetch("/api/hub/cargos", {
          method: "POST",
          headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
          body: JSON.stringify({ slug: slugFinal, ...basePayload }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro(typeof data?.error === "string" ? data.error : `Erro HTTP ${res.status}`);
          return;
        }
        await invalidateCargosCatalog(queryClient);
        setCriando(false);
        setFocusSlug(String(data.slug || slugFinal));
        setForm(rowToForm(data as CargoRow));
        return;
      }

      const novoSlugNorm = form.novo_slug.trim() ? slugifyCargoSlug(form.novo_slug) : "";
      const patch: Record<string, unknown> = {
        slug: focusSlug,
        propagar_titulo_para_agentes: form.propagar_titulo,
        ...basePayload,
      };
      if (novoSlugNorm && novoSlugNorm !== focusSlug) {
        patch.novo_slug = novoSlugNorm;
      }

      const res = await fetch("/api/hub/cargos", {
        method: "PATCH",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(typeof data?.error === "string" ? data.error : `Erro HTTP ${res.status}`);
        return;
      }
      await invalidateCargosCatalog(queryClient);
      const newSlug = typeof data.slug === "string" ? data.slug : focusSlug;
      setFocusSlug(newSlug);
      setForm(rowToForm(data as CargoRow));
    } finally {
      salvarLockRef.current = false;
      setBusySlug(null);
    }
  }

  function eliminar() {
    if (!focusSlug || criando) return;
    setConfirmExclusaoCargo({
      kind: "one",
      slug: focusSlug,
      rotulo: form.titulo.trim() || focusSlug,
    });
  }

  function pararProgressoSugestaoIa() {
    if (iaTickRef.current != null) {
      window.clearInterval(iaTickRef.current);
      iaTickRef.current = null;
    }
  }

  function cancelarSugestaoIa() {
    iaAbortRef.current?.abort();
    iaAbortRef.current = null;
    pararProgressoSugestaoIa();
    setSugerindo(false);
    setIaProgressPct(0);
    setErro("Sugestão cancelada.");
  }

  async function sugerirComMistral() {
    const titulo = form.titulo.trim();
    if (!titulo) {
      setErro("Escreva um título para o cargo antes de pedir sugestão.");
      return;
    }
    iaAbortRef.current?.abort();
    const abort = new AbortController();
    iaAbortRef.current = abort;

    setErro(null);
    setIaProgressPct(6);
    setSugerindo(true);

    pararProgressoSugestaoIa();
    iaTickRef.current = window.setInterval(() => {
      setIaProgressPct((p) => {
        if (p >= 92) return p;
        const step = Math.max(1, Math.round((92 - p) * (0.06 + Math.random() * 0.06)));
        return Math.min(92, p + step);
      });
    }, 180);

    let ok = false;
    try {
      const res = await fetch("/api/hub/cargos/sugerir", {
        method: "POST",
        headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ titulo }),
        signal: abort.signal,
      });
      const data = await res.json().catch(() => ({}));
      ok = res.ok;
      if (!res.ok) {
        setErro(typeof data?.error === "string" ? data.error : `Erro HTTP ${res.status}`);
        return;
      }
      const sug = data?.sugestao as Record<string, unknown> | undefined;
      if (!sug || typeof sug !== "object") {
        setErro("Resposta sem sugestão.");
        ok = false;
        return;
      }
      setForm((prev) => {
        const merged = mergeSugestao(prev, sug);
        if (criando && !slugEditadoManualRef.current) {
          merged.slug = slugSugeridoDoTitulo(merged.titulo);
        }
        return merged;
      });
    } catch (e) {
      if (abort.signal.aborted) return;
      setErro(e instanceof Error ? e.message : "Falha ao pedir sugestão.");
    } finally {
      if (abort.signal.aborted) {
        pararProgressoSugestaoIa();
        iaAbortRef.current = null;
        return;
      }
      pararProgressoSugestaoIa();
      iaAbortRef.current = null;
      if (ok) {
        setIaProgressPct(100);
        await new Promise((r) => setTimeout(r, 420));
      }
      setSugerindo(false);
      setIaProgressPct(0);
    }
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fechar gerenciamento de cargos"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 52,
          background: "rgba(11, 31, 16, 0.55)",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(1180px, 98vw)",
          zIndex: 53,
          background: OB.panel,
          borderLeft: `1px solid ${OB.borda}`,
          boxShadow: "-8px 0 32px rgba(11, 31, 16, 0.12)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div
          style={{
            borderBottom: `1px solid ${OB.borda}`,
            padding: 16,
            background: OB.shell,
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
              <h3 style={{ margin: "3px 0 0", color: OB.titulo, fontSize: 18, fontWeight: 800 }}>
                Gerenciar cargos
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
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ margin: "8px 0 0", color: OB.texto2, fontSize: 12 }}>
            Cargos disponíveis no wizard de novos agentes quando activos. As sugestões de IA usam os cargos e mercados
            actuais da empresa como contexto.
          </p>
          {!cargosListaPendente && (
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
                  overflowY: "hidden",
                  WebkitOverflowScrolling: "touch",
                  maxWidth: "100%",
                  background: "rgba(6, 13, 8, 0.85)",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 140,
                    flexShrink: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    background: OB.surface,
                    boxSizing: "border-box",
                  }}
                >
                  <input
                    type="search"
                    value={filtroBusca}
                    onChange={(e) => setFiltroBusca(e.target.value)}
                    placeholder="Buscar cargo…"
                    aria-label="Buscar cargos"
                    disabled={cargosListaPendente}
                    style={{
                      flex: "1 1 96px",
                      minWidth: 72,
                      height: 32,
                      boxSizing: "border-box",
                      background: "rgba(6, 13, 8, 0.85)",
                      border: `1px solid ${OB.borda}`,
                      color: OB.texto,
                      borderRadius: 8,
                      padding: "0 10px",
                      fontSize: 12,
                    }}
                  />
                  <select
                    value={filtroSetor}
                    onChange={(e) => setFiltroSetor(e.target.value)}
                    aria-label="Filtrar por setor"
                    disabled={cargosListaPendente}
                    style={{
                      flex: "0 1 148px",
                      maxWidth: "min(168px, 34vw)",
                      height: 32,
                      boxSizing: "border-box",
                      background: "rgba(6, 13, 8, 0.85)",
                      border: `1px solid ${OB.borda}`,
                      color: OB.texto,
                      borderRadius: 8,
                      padding: "0 8px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    <option value="">Todos os setores</option>
                    {setoresOpcoes.map((nom) => (
                      <option key={nom} value={nom}>
                        {nom}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "nowrap",
                    alignItems: "stretch",
                    flexShrink: 0,
                    gap: 0,
                  }}
                >
                  {cargos.length > 0 ? (
                    <>
                      <div
                        role="group"
                        aria-label="Em lote"
                        style={{
                          display: "flex",
                          flexWrap: "nowrap",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 10px",
                          background: OB.surface,
                          flexShrink: 0,
                        }}
                      >
                      <button
                        type="button"
                        onClick={() => void definirTodosAtivos(true)}
                        disabled={painelBusy}
                        title="Ativar todos os cargos"
                        aria-label="Ativar todos os cargos"
                        style={toolbarIconButtonStyle("green", painelBusy)}
                      >
                        <CheckCircle2 size={17} strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => void definirTodosAtivos(false)}
                        disabled={painelBusy}
                        title="Desativar todos os cargos"
                        aria-label="Desativar todos os cargos"
                        style={toolbarIconButtonStyle("red", painelBusy)}
                      >
                        <CircleSlash2 size={17} strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={seleccionarTodosDaLista}
                        disabled={painelBusy}
                        title="Seleccionar todos na lista"
                        aria-label="Seleccionar todos na lista"
                        style={toolbarIconButtonStyle("slate", painelBusy)}
                      >
                        <ListChecks size={17} strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={limparSeleccionados}
                        disabled={painelBusy || selectedSlugs.size === 0}
                        title="Limpar seleção"
                        aria-label="Limpar seleção"
                        style={toolbarIconButtonStyle(
                          "emphasis",
                          painelBusy || selectedSlugs.size === 0
                        )}
                      >
                        <ListX size={17} strokeWidth={2} aria-hidden />
                      </button>
                      <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => {
                            const slugs = [...selectedSlugs];
                            if (slugs.length === 0) return;
                            setConfirmExclusaoCargo({ kind: "batch", slugs });
                          }}
                          disabled={painelBusy || selectedSlugs.size === 0}
                          title={
                            selectedSlugs.size > 0
                              ? `Eliminar ${selectedSlugs.size} cargo(s) seleccionados`
                              : "Eliminar cargos seleccionados"
                          }
                          aria-label={
                            selectedSlugs.size > 0
                              ? `Eliminar ${selectedSlugs.size} cargo(s) seleccionados`
                              : "Eliminar cargos seleccionados"
                          }
                          style={toolbarIconButtonStyle(
                            "red",
                            painelBusy || selectedSlugs.size === 0
                          )}
                        >
                          {bulkDeleting ? (
                            <Loader2 size={17} strokeWidth={2} className="animate-spin" aria-hidden />
                          ) : (
                            <Trash2 size={17} strokeWidth={2} aria-hidden />
                          )}
                        </button>
                        {selectedSlugs.size > 0 ? (
                          <span
                            aria-hidden
                            style={{
                              position: "absolute",
                              top: -5,
                              right: -5,
                              minWidth: 17,
                              height: 17,
                              padding: "0 4px",
                              borderRadius: 999,
                              background: OB.danger,
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              lineHeight: 1,
                              border: `1px solid ${OB.panel}`,
                              pointerEvents: "none",
                            }}
                          >
                            {selectedSlugs.size > 99 ? "99+" : selectedSlugs.size}
                          </span>
                        ) : null}
                      </span>
                      {bulkLoading ? (
                        <span
                          title="A aplicar alterações em lote…"
                          style={{
                            ...toolbarIconButtonStyle("slate", true),
                            pointerEvents: "none",
                          }}
                          aria-live="polite"
                          aria-busy="true"
                        >
                          <Loader2 size={17} strokeWidth={2} className="animate-spin" aria-hidden />
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        width: 1,
                        background: OB.borda,
                        flexShrink: 0,
                        alignSelf: "stretch",
                        minHeight: 32,
                      }}
                      aria-hidden
                    />
                  </>
                ) : null}
                <div
                  role="group"
                  aria-label="Registo"
                  style={{
                    display: "flex",
                    flexWrap: "nowrap",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    background: OB.surface,
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={abrirNovo}
                    disabled={painelBusy}
                    title="Novo cargo"
                    aria-label="Novo cargo"
                    style={toolbarIconButtonStyle("primary", painelBusy)}
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
                    minHeight: 32,
                  }}
                  aria-hidden
                />
                <div
                  role="group"
                  aria-label="Sugestão por IA"
                  style={{
                    display: "flex",
                    flexWrap: "nowrap",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    background: OB.okMuted,
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void sugerirComMistral()}
                    disabled={!podeSugerirIa || sugerindo || painelBusy}
                    title={
                      podeSugerirIa
                        ? "Sugerir cargo (Mistral) — preenche campos com base no título e no Hub"
                        : "Seleccione ou crie um cargo e preencha o título à direita"
                    }
                    aria-label="Sugerir cargo com Mistral"
                    style={toolbarIconButtonStyle(
                      "ia",
                      !podeSugerirIa || sugerindo || painelBusy
                    )}
                  >
                    {sugerindo ? (
                      <Loader2 size={17} strokeWidth={2} className="animate-spin" aria-hidden />
                    ) : (
                      <Sparkles size={17} strokeWidth={2} aria-hidden />
                    )}
                  </button>
                </div>
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
                        color: OB.texto2,
                      }}
                    >
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      A gerar sugestão com base no Hub…
                    </span>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: OB.limao,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {iaProgressPct}%
                      </span>
                      <button
                        type="button"
                        onClick={cancelarSugestaoIa}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 8,
                          border: "1px solid rgba(248, 81, 73, 0.45)",
                          background: "rgba(248, 81, 73, 0.1)",
                          color: "#f85149",
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
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
                        background: `linear-gradient(90deg, ${OB.verde} 0%, ${OB.limao} 100%)`,
                        transition: "width 0.22s ease-out",
                      }}
                    />
                  </div>
                  {form.titulo.trim() ? (
                    <p
                      style={{
                        margin: "8px 0 0",
                        color: OB.texto2,
                        fontSize: 11,
                        lineHeight: 1.45,
                        textAlign: "center",
                      }}
                    >
                      {form.titulo.trim()}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <div
            style={{
              flex: "0 0 clamp(300px, 36%, 420px)",
              borderRight: `1px solid ${OB.borda}`,
              overflowY: "auto",
              padding: 12,
              background: OB.shell,
            }}
          >
            {cargosListaPendente ? (
              <p style={{ color: OB.texto2, fontSize: 12 }}>Carregando…</p>
            ) : erroExibicao ? (
              <div
                style={{
                  color: OB.danger,
                  background: "#fff5f5",
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 12,
                }}
              >
                {erroExibicao}
              </div>
            ) : cargos.length === 0 ? (
              <p style={{ color: OB.texto2, fontSize: 12 }}>Nenhum cargo.</p>
            ) : cargosFiltrados.length === 0 ? (
              <p style={{ color: OB.texto2, fontSize: 12 }}>
                Nenhum cargo corresponde à busca ou ao setor seleccionado.
              </p>
            ) : (
              cargosPorSegmento.map(([segmentoLabel, lista], secIdx) => {
                const corBarra = SEGMENTO_COR[segmentoLabel] || "#64748b";
                const slugsInSeg = lista.map((c) => String(c.slug || "").trim()).filter(Boolean);
                const todosMarcados =
                  slugsInSeg.length > 0 && slugsInSeg.every((s) => selectedSlugs.has(s));
                const parcialSeleccao =
                  slugsInSeg.length > 0 &&
                  slugsInSeg.some((s) => selectedSlugs.has(s)) &&
                  !todosMarcados;
                return (
                  <div key={segmentoLabel} style={{ marginTop: secIdx === 0 ? 0 : 16 }}>
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
                      <ObraCheckbox
                        aria-label={`Seleccionar todos os cargos em ${segmentoLabel}`}
                        checked={todosMarcados}
                        indeterminate={parcialSeleccao}
                        disabled={painelBusy}
                        onChange={() => {
                          setSelectedSlugs((prev) => {
                            const next = new Set(prev);
                            if (todosMarcados) {
                              slugsInSeg.forEach((s) => next.delete(s));
                            } else {
                              slugsInSeg.forEach((s) => next.add(s));
                            }
                            return next;
                          });
                        }}
                      />
                      <span style={{ width: 3, minWidth: 3, height: 14, borderRadius: 2, background: corBarra }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: OB.texto, letterSpacing: 0.4 }}>
                        {segmentoLabel}
                      </span>
                      <span style={{ fontSize: 11, color: OB.texto3 }}>({lista.length})</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {lista.map((cargo) => {
                        const slug = String(cargo.slug || "");
                        const sel = focusSlug === slug && !criando;
                        const ativo = cargo.ativo !== false;
                        const seg = segmentoLabelCargo(cargo);
                        const segDisplay = seg !== "Outros" ? seg : "";
                        const esp = cargo.especialidade ? String(cargo.especialidade) : "";
                        const meta = [segDisplay, esp].filter(Boolean).join(" · ");
                        return (
                          <div
                            key={slug}
                            style={{
                              background: sel ? OB.okMuted : "rgba(6, 13, 8, 0.72)",
                              border: sel ? `2px solid ${OB.limao}` : `1px solid ${OB.borda}`,
                              borderRadius: 12,
                              padding: "10px 12px",
                              boxShadow: sel ? "0 2px 8px rgba(146, 255, 0, 0.12)" : "0 1px 3px rgba(11, 31, 16, 0.04)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <ObraCheckbox
                              aria-label={`Seleccionar cargo ${slug}`}
                              checked={selectedSlugs.has(slug)}
                              disabled={
                                painelBusy || bulkLoading || busySlug === slug || sugerindo
                              }
                              onChange={() => {
                                setSelectedSlugs((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(slug)) next.delete(slug);
                                  else next.add(slug);
                                  return next;
                                });
                              }}
                            />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p
                                style={{
                                  margin: 0,
                                  color: OB.texto,
                                  fontSize: 13,
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {String(cargo.titulo || cargo.nome || slug)}
                              </p>
                              {meta ? (
                              <p
                                style={{
                                  margin: "2px 0 0",
                                  color: OB.texto3,
                                  fontSize: 11,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {meta}
                              </p>
                              ) : null}
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <CrmIconButtonGroup
                                aria-label={`Ações do cargo ${slug}`}
                                items={[
                                  {
                                    key: "editar",
                                    variant: "green",
                                    icon: <Pencil size={14} strokeWidth={2.25} aria-hidden />,
                                    onClick: () => abrirEditar(cargo),
                                    disabled: painelBusy || bulkLoading,
                                    title: "Editar cargo",
                                    "aria-label": `Editar cargo ${slug}`,
                                  },
                                  {
                                    key: "toggle",
                                    variant: "green",
                                    icon: <Power size={14} strokeWidth={2.25} aria-hidden />,
                                    onClick: () => void alternarAtivo(cargo),
                                    disabled: painelBusy || bulkLoading || busySlug === slug,
                                    loading: busySlug === slug,
                                    title: ativo ? "Desativar cargo" : "Ativar cargo",
                                    "aria-label": ativo ? `Desativar cargo ${slug}` : `Ativar cargo ${slug}`,
                                  },
                                  {
                                    key: "excluir",
                                    variant: "red",
                                    icon: <Trash2 size={14} strokeWidth={2.25} aria-hidden />,
                                    onClick: () =>
                                      setConfirmExclusaoCargo({
                                        kind: "one",
                                        slug,
                                        rotulo: String(cargo.titulo || cargo.nome || slug),
                                      }),
                                    disabled: painelBusy || bulkLoading || busySlug === slug || sugerindo,
                                    title: `Eliminar «${String(cargo.titulo || cargo.nome || slug)}»`,
                                    "aria-label": `Eliminar cargo ${slug}`,
                                  },
                                ]}
                              />
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

          <div style={{ flex: 1, overflowY: "auto", padding: 16, background: OB.shell }}>
            {erro ? (
              <div
                style={{
                  color: OB.danger,
                  background: "#fff5f5",
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {erro}
              </div>
            ) : null}

            {!focusSlug && !criando ? (
              <p style={{ color: OB.texto2, fontSize: 13, marginTop: 24 }}>
                Seleccione um cargo na lista ou clique em{" "}
                <strong style={{ color: OB.limao }}>+ Novo cargo</strong>.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: `1px solid ${OB.borda}`,
                    background: OB.surface,
                    fontSize: 11,
                    color: OB.texto2,
                    lineHeight: 1.45,
                  }}
                >
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      background: criando ? OB.okMuted : "rgba(11, 31, 16, 0.06)",
                      color: criando ? OB.limao : OB.ok,
                      border: `1px solid ${criando ? "rgba(146, 255, 0, 0.35)" : OB.borda}`,
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {criando ? "NOVO" : "EDITAR"}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      flexWrap: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    <span style={{ whiteSpace: "nowrap" }}>
                      Sugestão IA: use o ícone
                    </span>
                    <Sparkles
                      size={13}
                      strokeWidth={2}
                      style={{ flexShrink: 0, color: OB.limao }}
                      aria-hidden
                    />
                    <span style={{ whiteSpace: "nowrap" }}>na barra acima (à direita).</span>
                    {(criando || focusSlug !== null) &&
                    !cargosListaPendente &&
                    !form.titulo.trim() &&
                    !sugerindo ? (
                      <>
                        <span style={{ color: OB.texto3, padding: "0 2px" }} aria-hidden>
                          ·
                        </span>
                        <span>
                          Preencha o <strong style={{ color: OB.texto }}>título</strong> para activar a sugestão.
                        </span>
                      </>
                    ) : null}
                  </span>
                </div>

                <label style={{ display: "block" }}>
                  <span style={lbl}>
                    Título *
                  </span>
                  <input
                    value={form.titulo}
                    onChange={(e) => actualizarTituloNovo(e.target.value)}
                    style={inp}
                  />
                </label>

                {criando ? null : (
                  <label style={{ display: "block" }}>
                    <span style={lbl}>Renomear identificador interno (opcional)</span>
                    <input
                      value={form.novo_slug}
                      onChange={(e) => setForm((p) => ({ ...p, novo_slug: e.target.value }))}
                      placeholder="Deixe vazio para manter o actual"
                      style={inp}
                    />
                  </label>
                )}

                <datalist id="crm-catalog-segmentos-conceito">
                  {nomesSegmentosConceito().map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <datalist id="crm-catalog-especialidades">
                  {especialidadesDatalistOpcoes.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "block" }}>
                    <span style={lbl}>
                      Segmento (setor)
                    </span>
                    <input
                      list="crm-catalog-segmentos-conceito"
                      autoComplete="off"
                      value={form.segmento}
                      onChange={(e) => setForm((p) => ({ ...p, segmento: e.target.value }))}
                      placeholder="Marketing · Comercial · Operações"
                      style={inp}
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <span style={lbl}>
                      Especialidade (secção interna do setor)
                    </span>
                    <input
                      list="crm-catalog-especialidades"
                      autoComplete="off"
                      value={form.especialidade}
                      onChange={(e) => setForm((p) => ({ ...p, especialidade: e.target.value }))}
                      placeholder="Ex.: SDR, Obra, Performance…"
                      style={inp}
                    />
                  </label>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: OB.texto2, lineHeight: 1.45 }}>
                  Use os setores e especialidades oficiais da empresa para manter relatórios e sugestões de IA
                  alinhados. Novos setores devem ser acordados com a equipa antes de criar cargos.
                </p>
                {segmentoForaDoConceito ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      color: OB.limao,
                      lineHeight: 1.45,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid rgba(146, 255, 0, 0.35)`,
                      background: OB.okMuted,
                    }}
                  >
                    Este segmento não está na lista oficial ({nomesSegmentosConceito().join(", ")}). Prefira um dos
                    setores listados para manter relatórios e sugestões de IA consistentes.
                  </p>
                ) : null}

                <label style={{ display: "block" }}>
                  <span style={lbl}>
                    Descrição curta
                  </span>
                  <input
                    value={form.descricao_curta}
                    onChange={(e) => setForm((p) => ({ ...p, descricao_curta: e.target.value }))}
                    style={inp}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "block" }}>
                    <span style={lbl}>Área</span>
                    <input
                      value={form.area}
                      onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
                      style={inp}
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <span style={lbl}>
                      Nível (1–5)
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={form.nivel}
                      onChange={(e) => setForm((p) => ({ ...p, nivel: e.target.value }))}
                      style={inp}
                    />
                  </label>
                </div>

                <label style={{ display: "block" }}>
                  <span style={lbl}>
                    Limite autonomia (BRL, opcional)
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={form.limite_autonomia_brl}
                    onChange={(e) => setForm((p) => ({ ...p, limite_autonomia_brl: e.target.value }))}
                    style={inp}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <label style={{ display: "block" }}>
                    <span style={lbl}>
                      Modelo padrão
                    </span>
                    <input
                      value={form.modelo_padrao}
                      onChange={(e) => setForm((p) => ({ ...p, modelo_padrao: e.target.value }))}
                      style={inp}
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <span style={lbl}>
                      Modelo crítico
                    </span>
                    <input
                      value={form.modelo_critico}
                      onChange={(e) => setForm((p) => ({ ...p, modelo_critico: e.target.value }))}
                      style={inp}
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <span style={lbl}>
                      Alto valor
                    </span>
                    <input
                      value={form.modelo_alto_valor}
                      onChange={(e) => setForm((p) => ({ ...p, modelo_alto_valor: e.target.value }))}
                      style={inp}
                    />
                  </label>
                </div>

                <label style={{ display: "block" }}>
                  <span style={lbl}>
                    Supervisor (outro cargo)
                  </span>
                  <input
                    value={form.supervisor_slug}
                    onChange={(e) => setForm((p) => ({ ...p, supervisor_slug: e.target.value }))}
                    style={inp}
                  />
                </label>

                <label style={{ display: "block" }}>
                  <span style={lbl}>
                    Pode fazer (um por linha)
                  </span>
                  <textarea
                    value={form.pode_fazer_padrao}
                    onChange={(e) => setForm((p) => ({ ...p, pode_fazer_padrao: e.target.value }))}
                    rows={4}
                    style={{ ...inp, resize: "vertical", fontFamily: "inherit" }}
                  />
                </label>

                <label style={{ display: "block" }}>
                  <span style={lbl}>
                    Não pode fazer (um por linha)
                  </span>
                  <textarea
                    value={form.nao_pode_fazer_padrao}
                    onChange={(e) => setForm((p) => ({ ...p, nao_pode_fazer_padrao: e.target.value }))}
                    rows={4}
                    style={{ ...inp, resize: "vertical", fontFamily: "inherit" }}
                  />
                </label>

                <label style={{ display: "block" }}>
                  <span style={lbl}>
                    Prompt template (base para novos agentes)
                  </span>
                  <textarea
                    value={form.prompt_template}
                    onChange={(e) => setForm((p) => ({ ...p, prompt_template: e.target.value }))}
                    rows={6}
                    style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.45 }}
                  />
                </label>

                <div
                  style={{
                    border: `1px solid ${OB.borda}`,
                    borderRadius: 12,
                    background: "rgba(6, 13, 8, 0.85)",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    boxShadow: "0 1px 3px rgba(11, 31, 16, 0.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <p style={{ margin: 0, color: OB.limao, fontSize: 11, fontWeight: 800, letterSpacing: 0.3 }}>
                      CONFIGURAÇÃO DE ATENDIMENTO EXTERNO
                    </p>
                    <button
                      type="button"
                      onClick={() => void sugerirComMistral()}
                      disabled={sugerindo || !form.titulo.trim()}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        ...crmBtnSecondary(sugerindo || !form.titulo.trim()),
                        padding: "6px 10px",
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                      title="Gera saudação e sequência de perguntas com IA a partir do cargo."
                    >
                      <Sparkles size={12} aria-hidden />
                      {sugerindo ? "Gerando…" : "Gerar com IA"}
                    </button>
                  </div>

                  <label style={{ display: "block" }}>
                    <span style={lbl}>
                      Saudação padrão (cliente)
                    </span>
                    <textarea
                      value={form.saudacao_cliente}
                      onChange={(e) => setForm((p) => ({ ...p, saudacao_cliente: e.target.value }))}
                      rows={3}
                      placeholder='Ex.: "Olá! Aqui é a Maria, do time de atendimento. Como posso te ajudar hoje?"'
                      style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.45 }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <span style={lbl}>
                      Comprimento padrão
                    </span>
                    <input
                      value={form.comprimento_padrao}
                      onChange={(e) => setForm((p) => ({ ...p, comprimento_padrao: e.target.value }))}
                      placeholder="Ex.: Máx. 2 frases por mensagem."
                      style={inp}
                    />
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <ObraCheckbox
                      checked={form.usar_perguntas_essenciais}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, usar_perguntas_essenciais: e.target.checked }))
                      }
                    />
                    <span style={{ color: OB.texto, fontSize: 12 }}>
                      Usar sequência de perguntas essenciais
                    </span>
                  </label>

                  {form.usar_perguntas_essenciais ? (
                    <label style={{ display: "block" }}>
                      <span style={lbl}>
                        Perguntas essenciais (uma por linha)
                      </span>
                      <textarea
                        value={form.perguntas_essenciais}
                        onChange={(e) => setForm((p) => ({ ...p, perguntas_essenciais: e.target.value }))}
                        rows={5}
                        placeholder={"Qual o seu nome?\nO que procura?\nQual região/faixa de valor?\nQual prazo para decidir?"}
                        style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.45 }}
                      />
                    </label>
                  ) : null}

                  {form.usar_perguntas_essenciais ? (
                    <label style={{ display: "block" }}>
                      <span style={lbl}>
                        Ordem das perguntas
                      </span>
                      <select
                        value={form.ordem_perguntas_essenciais}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            ordem_perguntas_essenciais:
                              e.target.value === "final" ? "final" : "inicio",
                          }))
                        }
                        style={inp}
                      >
                        <option value="inicio">No início da conversa (recomendado)</option>
                        <option value="final">No final da conversa</option>
                      </select>
                    </label>
                  ) : null}

                  <p style={{ margin: 0, color: OB.texto2, fontSize: 11, lineHeight: 1.45 }}>
                    Estes campos definem comportamento no canal externo. Evite mencionar cargo/função interna na
                    saudação (ex.: “qualificador”, “SDR”, “closer”).
                  </p>
                </div>

                <label style={{ display: "block" }}>
                  <span style={lbl}>
                    Descrição longa (documentação interna)
                  </span>
                  <textarea
                    value={form.descricao}
                    onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                    rows={5}
                    style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.45 }}
                  />
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <ObraCheckbox
                    checked={form.ativo}
                    onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))}
                  />
                  <span style={{ color: OB.texto, fontSize: 12 }}>Cargo activo no wizard</span>
                </label>

                {!criando && focusSlug ? (
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <span style={{ paddingTop: 2, flexShrink: 0 }}>
                      <ObraCheckbox
                        checked={form.propagar_titulo}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, propagar_titulo: e.target.checked }))
                        }
                      />
                    </span>
                    <span style={{ color: OB.texto, fontSize: 12, lineHeight: 1.45 }}>
                      Ao alterar o título, actualizar também todos os agentes que ainda usam o título antigo.
                    </span>
                  </label>
                ) : null}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => void salvar()}
                    disabled={painelBusy}
                    style={crmBtnPrimary(painelBusy)}
                  >
                    {busySlug === "_save" ? "A gravar…" : "Guardar"}
                  </button>
                  {!criando && focusSlug ? (
                    <button
                      type="button"
                      onClick={eliminar}
                      disabled={painelBusy}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        ...crmBtnDangerSoft(painelBusy),
                      }}
                    >
                      <Trash2 size={14} aria-hidden />
                      Eliminar do catálogo
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <CrmConfirmDialog
        open={confirmExclusaoCargo?.kind === "one"}
        title="Eliminar cargo do catálogo?"
        theme="dark"
        danger
        confirmLabel="Eliminar definitivamente"
        cancelLabel="Cancelar"
        loading={busySlug !== null && confirmExclusaoCargo?.kind === "one"}
        onCancel={() => !busySlug && setConfirmExclusaoCargo(null)}
        onConfirm={() => {
          if (confirmExclusaoCargo?.kind !== "one") return;
          const { slug, rotulo } = confirmExclusaoCargo;
          setConfirmExclusaoCargo(null);
          void eliminarPorSlug(slug, rotulo);
        }}
      >
        {confirmExclusaoCargo?.kind === "one" ? (
          <>
            <p style={{ margin: 0, color: OB.texto2, fontSize: 13, lineHeight: 1.55 }}>
              O cargo <strong style={{ color: OB.limao }}>«{confirmExclusaoCargo.rotulo}»</strong> será removido do
              catálogo.
            </p>
            <p style={{ margin: "10px 0 0", color: OB.texto3, fontSize: 12, lineHeight: 1.5 }}>
              Se existirem agentes com este título, a operação será bloqueada.
            </p>
          </>
        ) : null}
      </CrmConfirmDialog>

      <CrmConfirmDialog
        open={confirmExclusaoCargo?.kind === "batch"}
        title="Eliminar cargos seleccionados?"
        theme="dark"
        danger
        confirmLabel="Eliminar seleccionados"
        cancelLabel="Cancelar"
        loading={bulkDeleting}
        onCancel={() => !bulkDeleting && setConfirmExclusaoCargo(null)}
        onConfirm={() => {
          if (confirmExclusaoCargo?.kind !== "batch") return;
          const { slugs } = confirmExclusaoCargo;
          setConfirmExclusaoCargo(null);
          void eliminarSeleccionados(slugs);
        }}
      >
        {confirmExclusaoCargo?.kind === "batch" ? (
          <>
            <p style={{ margin: 0, color: OB.texto2, fontSize: 13, lineHeight: 1.55 }}>
              Serão eliminados <strong style={{ color: OB.limao }}>{confirmExclusaoCargo.slugs.length}</strong>{" "}
              cargo(s) do catálogo.
            </p>
            <p style={{ margin: "10px 0 0", color: OB.texto3, fontSize: 12, lineHeight: 1.5 }}>
              Cargos em uso por agentes não serão apagados e aparecerão no relatório de erros.
            </p>
          </>
        ) : null}
      </CrmConfirmDialog>
    </>
  );
}
