"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Brain,
  ClipboardPenLine,
  FileCode2,
  ListOrdered,
  PieChart,
  Search,
  StickyNote,
  UserPen,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { CrmFerramentasCustomDrawer } from "@/components/crm/CrmFerramentasCustomDrawer";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { HubAgenteFerramentaId, HubFerramentaCategoria } from "@/lib/hub/agente-ferramentas-registry";
import {
  catalogoBuiltinPorId,
  HUB_AGENTE_FERRAMENTAS_CATALOGO,
  HUB_FERRAMENTA_ACESSO,
  HUB_FERRAMENTA_SECAO_LABEL,
  isHubAgenteFerramentaId,
  mergeUsoFerramentasComPadraoPreservandoCustom,
} from "@/lib/hub/agente-ferramentas-registry";

const ORDEM_SECOES: HubFerramentaCategoria[] = ["cliente", "analise", "registos"];

const ICONE_SECAO: Record<HubFerramentaCategoria, LucideIcon> = {
  cliente: Users,
  analise: PieChart,
  registos: ClipboardPenLine,
};

const ICONE_FERRAMENTA: Record<HubAgenteFerramentaId, LucideIcon> = {
  hub_lead_resumo: UserRound,
  hub_lead_memorias: Brain,
  hub_lead_lookup_por_telefone: Search,
  hub_metricas_escritorio: BarChart3,
  hub_relatorio_html_simples: FileCode2,
  hub_registar_nota_lead: StickyNote,
  hub_whatsapp_menu: ListOrdered,
  hub_atualizar_lead: UserPen,
};

type AgenteLista = {
  agente_slug: string;
  nome: string;
  motor_ferramentas_habilitado?: boolean;
  uso_ferramentas_ia?: unknown;
  ativo?: boolean;
  arquivado_em?: string | null;
};

type CustomRow = {
  ferramenta_key: string;
  titulo: string;
  descricao_curta: string | null;
  builtin_impl: string;
  smart_provider: string;
  ativo: boolean;
};

function agenteUsaFerramentaKey(a: AgenteLista, key: string): boolean {
  if (a.motor_ferramentas_habilitado !== true) return false;
  const uso = mergeUsoFerramentasComPadraoPreservandoCustom(a.uso_ferramentas_ia);
  return uso[key] === true;
}

export default function FerramentasHubPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [agentes, setAgentes] = useState<AgenteLista[]>([]);
  const [customRows, setCustomRows] = useState<CustomRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setErro(null);
    setLoading(true);
    try {
      const headers = internalApiHeaders();
      const [resAgentes, resCustom] = await Promise.all([
        fetch("/api/hub/agentes?todos=true", { headers }),
        fetch("/api/hub/ferramentas-custom?all=true", { headers }),
      ]);

      const json: unknown = await resAgentes.json();
      if (!resAgentes.ok) {
        const msg =
          json && typeof json === "object" && "error" in json && typeof (json as Record<string, unknown>).error === "string"
            ? String((json as Record<string, unknown>).error)
            : "Falha ao listar agentes.";
        throw new Error(msg);
      }
      setAgentes(Array.isArray(json) ? (json as AgenteLista[]) : []);

      let list: CustomRow[] = [];
      if (resCustom.ok) {
        const raw = await resCustom.json().catch(() => null);
        if (Array.isArray(raw)) {
          list = raw.map((x: Record<string, unknown>) => ({
            ferramenta_key: String(x.ferramenta_key ?? ""),
            titulo: String(x.titulo ?? ""),
            descricao_curta:
              x.descricao_curta != null && String(x.descricao_curta).trim()
                ? String(x.descricao_curta).trim()
                : null,
            builtin_impl: String(x.builtin_impl ?? ""),
            smart_provider: String(x.smart_provider ?? "none"),
            ativo: x.ativo !== false,
          }));
        }
      }
      setCustomRows(list);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
      setAgentes([]);
      setCustomRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const agentesProducao = useMemo(
    () => agentes.filter((a) => !a.arquivado_em && a.ativo !== false),
    [agentes]
  );

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "#8b949e" }}>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded px-2 py-1 font-semibold"
            style={{ background: "#21262d", color: "#c9a24a", border: "1px solid #30363d", cursor: "pointer" }}
          >
            Gerir custom + IA
          </button>
          <span className="rounded px-2 py-1" style={{ background: "#21262d", border: "1px solid #30363d" }}>
            {HUB_AGENTE_FERRAMENTAS_CATALOGO.length} builtins
          </span>
          <span className="rounded px-2 py-1" style={{ background: "#003b2630", color: "#c9a24a" }}>
            {agentesProducao.length} agentes activos
          </span>
        </div>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, agentesProducao.length]);

  const porId = useMemo(() => {
    const m = new Map<HubAgenteFerramentaId, AgenteLista[]>();
    for (const { id } of HUB_AGENTE_FERRAMENTAS_CATALOGO) {
      m.set(
        id,
        agentesProducao.filter((a) => agenteUsaFerramentaKey(a, id))
      );
    }
    return m;
  }, [agentesProducao]);

  const customComChave = useMemo(() => customRows.filter((c) => c.ferramenta_key), [customRows]);

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh" }}>
      <CrmFerramentasCustomDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          void carregar();
        }}
        onCustomListChanged={() => void carregar()}
      />
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6" style={{ paddingBottom: 48 }}>
        <header className="mb-6">
          <h1 className="m-0 text-xl font-bold md:text-2xl" style={{ color: "#e6edf3" }}>
            Ferramentas IA (Hub)
          </h1>
          <p className="mt-2 text-sm leading-relaxed m-0" style={{ color: "#8b949e" }}>
            Catálogo <strong style={{ color: "#aebccf" }}>built-in</strong> mais ferramentas{" "}
            <strong style={{ color: "#c9a24a" }}>custom</strong> do tenant (nome e descrição próprios, mesma execução
            segura; opcional smart Mistral/Gemini). Activar por agente em{" "}
            <Link href="/crm/agentes" className="underline font-medium" style={{ color: "#93c5fd" }}>
              Modelos
            </Link>
            .
          </p>
        </header>

        {erro && (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{ background: "#b3261e22", border: "1px solid #b3261e55", color: "#f85149" }}
          >
            {erro}
          </div>
        )}

        {loading && (
          <p className="text-sm" style={{ color: "#8b949e" }}>
            A carregar…
          </p>
        )}

        {!loading &&
          ORDEM_SECOES.map((sec) => {
            const ferramentas = HUB_AGENTE_FERRAMENTAS_CATALOGO.filter((f) => f.categoria === sec);
            if (ferramentas.length === 0) return null;
            const SecIcon = ICONE_SECAO[sec];
            return (
              <section key={sec} className="mb-10">
                <h2 className="mb-4 flex items-center gap-2 text-base font-bold m-0" style={{ color: "#e6edf3" }}>
                  <SecIcon size={20} strokeWidth={1.5} style={{ color: "#c9a24a" }} />
                  {HUB_FERRAMENTA_SECAO_LABEL[sec]}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {ferramentas.map((f) => {
                    const IconF = ICONE_FERRAMENTA[f.id];
                    const nivel = HUB_FERRAMENTA_ACESSO[f.id];
                    const comTool = porId.get(f.id) ?? [];
                    return (
                      <article
                        key={f.id}
                        className="rounded-2xl p-4"
                        style={{
                          background: "#161b22",
                          border: "1px solid #30363d",
                          boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                            style={{ background: "#21262d", color: "#c9a24a" }}
                          >
                            <IconF size={22} strokeWidth={1.5} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="m-0 text-sm font-bold" style={{ color: "#e6edf3" }}>
                                {f.titulo}
                              </h3>
                              <span
                                className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                                style={{
                                  background:
                                    nivel === "escrita" ? "rgba(248,81,73,0.15)" : "rgba(63,185,80,0.12)",
                                  color: nivel === "escrita" ? "#f85149" : "#3fb950",
                                }}
                              >
                                {nivel === "escrita" ? "Escrita" : "Só leitura"}
                              </span>
                              {f.recomendadoWhatsApp && (
                                <span
                                  className="rounded px-2 py-0.5 text-[10px] font-semibold"
                                  style={{ background: "#30363d", color: "#8b949e" }}
                                >
                                  Sugerido WhatsApp
                                </span>
                              )}
                            </div>
                            <code
                              className="mt-1 block truncate text-[11px]"
                              style={{ color: "#93c5fd" }}
                              title={f.mistralFunction.name}
                            >
                              {f.mistralFunction.name}
                            </code>
                            <p className="mt-2 mb-0 text-[13px] leading-relaxed" style={{ color: "#8b949e" }}>
                              {f.descricao}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 border-t pt-3" style={{ borderColor: "#30363d" }}>
                          <p
                            className="mb-2 text-[11px] font-bold uppercase tracking-wide m-0"
                            style={{ color: "#6e7681" }}
                          >
                            Agentes com esta ferramenta activa ({comTool.length})
                          </p>
                          {comTool.length === 0 ? (
                            <p className="m-0 text-xs" style={{ color: "#484f58" }}>
                              Nenhum agente activo com motor + toggle ligados.
                            </p>
                          ) : (
                            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                              {comTool.map((a) => (
                                <li key={a.agente_slug}>
                                  <Link
                                    href={`/crm/agentes/${encodeURIComponent(a.agente_slug)}`}
                                    className="inline-block rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:brightness-110"
                                    style={{
                                      background: "#21262d",
                                      color: "#c9a24a",
                                      border: "1px solid #30363d",
                                      textDecoration: "none",
                                    }}
                                  >
                                    {a.nome?.trim() || a.agente_slug}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}

        {!loading && customComChave.length > 0 ? (
          <section className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold m-0" style={{ color: "#e6edf3" }}>
              <Wrench size={20} strokeWidth={1.5} style={{ color: "#c9a24a" }} />
              Ferramentas custom do tenant
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {customComChave.map((c) => {
                const comTool = agentesProducao.filter((a) => agenteUsaFerramentaKey(a, c.ferramenta_key));
                const baseCat = isHubAgenteFerramentaId(c.builtin_impl)
                  ? catalogoBuiltinPorId(c.builtin_impl)
                  : undefined;
                const nivelBase = baseCat ? HUB_FERRAMENTA_ACESSO[baseCat.id] : "leitura";
                const descricaoCard =
                  (c.descricao_curta && c.descricao_curta.trim()) ||
                  (baseCat?.descricao ??
                    `Alias sobre a função base «${c.builtin_impl}» com nome e instruções próprios para o modelo Mistral.`);
                const IconBase = baseCat ? ICONE_FERRAMENTA[baseCat.id] : Wrench;
                return (
                  <article
                    key={c.ferramenta_key}
                    className="rounded-2xl p-4"
                    style={{
                      background: "#161b22",
                      border: "1px solid #30363d",
                      boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
                      opacity: c.ativo ? 1 : 0.88,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                        style={{ background: "#21262d", color: "#c9a24a" }}
                      >
                        <IconBase size={22} strokeWidth={1.5} aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="m-0 text-sm font-bold" style={{ color: "#e6edf3" }}>
                            {c.titulo}
                          </h3>
                          <span
                            className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={{
                              background:
                                nivelBase === "escrita" ? "rgba(248,81,73,0.15)" : "rgba(63,185,80,0.12)",
                              color: nivelBase === "escrita" ? "#f85149" : "#3fb950",
                            }}
                          >
                            {nivelBase === "escrita" ? "Escrita" : "Só leitura"}
                          </span>
                          <span
                            className="rounded px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: "#30363d", color: "#c9a24a" }}
                          >
                            Custom
                          </span>
                          {!c.ativo ? (
                            <span
                              className="rounded px-2 py-0.5 text-[10px] font-bold"
                              style={{ background: "#484f5822", color: "#8b949e" }}
                            >
                              Inactiva no catálogo
                            </span>
                          ) : null}
                          {c.smart_provider !== "none" ? (
                            <span
                              className="rounded px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: "#30363d", color: "#8b949e" }}
                            >
                              Smart {c.smart_provider}
                            </span>
                          ) : null}
                          {baseCat?.recomendadoWhatsApp ? (
                            <span
                              className="rounded px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: "#30363d", color: "#8b949e" }}
                            >
                              Sugerido WhatsApp
                            </span>
                          ) : null}
                        </div>
                        <code
                          className="mt-1 block break-all text-[11px]"
                          style={{ color: "#93c5fd" }}
                          title={c.ferramenta_key}
                        >
                          {c.ferramenta_key}
                        </code>
                        <p className="mt-1 mb-0 text-[11px] leading-relaxed m-0" style={{ color: "#6e7781" }}>
                          Execução:{" "}
                          <code className="text-[11px]" style={{ color: "#c9a24a" }}>
                            {c.builtin_impl}
                          </code>
                        </p>
                        <p className="mt-2 mb-0 text-[13px] leading-relaxed" style={{ color: "#8b949e" }}>
                          {descricaoCard}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 border-t pt-3" style={{ borderColor: "#30363d" }}>
                      <p
                        className="mb-2 text-[11px] font-bold uppercase tracking-wide m-0"
                        style={{ color: "#6e7681" }}
                      >
                        Agentes com esta ferramenta activa ({comTool.length})
                      </p>
                      {comTool.length === 0 ? (
                        <p className="m-0 text-xs" style={{ color: "#484f58" }}>
                          Nenhum agente activo com motor + toggle ligados.
                        </p>
                      ) : (
                        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                          {comTool.map((a) => (
                            <li key={a.agente_slug}>
                              <Link
                                href={`/crm/agentes/${encodeURIComponent(a.agente_slug)}`}
                                className="inline-block rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:brightness-110"
                                style={{
                                  background: "#21262d",
                                  color: "#c9a24a",
                                  border: "1px solid #30363d",
                                  textDecoration: "none",
                                }}
                              >
                                {a.nome?.trim() || a.agente_slug}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
