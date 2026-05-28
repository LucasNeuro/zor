"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { estagioParaColunaKanban } from "@/lib/crm/estagio-map";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import { FUNIL_LEAD_ETAPAS } from "@/lib/crm/pipelines";
import { CrmStickyTabs } from "@/components/crm/CrmStickyTabs";
import { LeadPropostasPanel } from "@/components/crm/LeadPropostasPanel";
import {
  codigoParticipante,
  emailExibicao,
  type PessoaMini,
  ultimaMensagemExibicao,
  type UltimaFilaMini,
} from "@/lib/crm/enrich-lead-crm";
import {
  ArrowLeft,
  Brain,
  Briefcase,
  Check,
  ChevronLeft,
  ClipboardList,
  FileText,
  IdCard,
  MessageSquare,
  Sparkles,
  User,
  X,
} from "lucide-react";

const ESTAGIO_COR: Record<string, string> = Object.fromEntries(
  FUNIL_LEAD_ETAPAS.map((e) => [e.slug, e.cor])
);

/** Fundo mais escuro (timelapse / OLED-ish), alinhado ao pedido */
const BG_DEEP = "#05080e";
const BG_PANEL = "#0a1018";
const BORDER_SUBTLE = "rgba(48, 54, 61, 0.38)";
const TIMELINE_TRACK = "rgba(201, 162, 74, 0.35)";

function tempoRelativo(data: string) {
  const diff = (Date.now() - new Date(data).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.round(diff / 60)}min`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return new Date(data).toLocaleDateString("pt-BR");
}

function formatarDataHora(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function confiancaPercentual(mem: Record<string, unknown>): string {
  const c = (mem.confianca ?? mem.relevancia) as number | undefined;
  if (c == null || Number.isNaN(Number(c))) return "—";
  const n = Number(c);
  const p = n > 1 ? n : n * 100;
  return `${Math.round(p)}%`;
}

type ChipMemoria = {
  key: string;
  titulo: string;
  corpo: string;
  rodape: string;
};

/**
 * Suporta:
 * - Legado (código atual / webhook): chave, valor, confianca, criado_por
 * - Schema “documento” com JSON: resumo_ia, dados_coletados, preferencias_detectadas, arrays, nivel_engajamento, etc.
 */
function chipsFromMemoriaRow(mem: Record<string, unknown>): ChipMemoria[] {
  const id = String(mem.id ?? Math.random());
  const ts =
    formatarDataHora(
      (mem.atualizado_em ?? mem.criado_em) as string | undefined
    ) || "—";
  const criadoPor = mem.criado_por ? String(mem.criado_por) : "";

  const out: ChipMemoria[] = [];

  if (mem.chave != null && (mem.valor != null || mem.conteudo != null)) {
    out.push({
      key: `${id}-kv`,
      titulo: String(mem.chave),
      corpo: String(mem.valor ?? mem.conteudo ?? ""),
      rodape: [confiancaPercentual(mem), criadoPor].filter(Boolean).join(" · ") || ts,
    });
    return out;
  }

  if (mem.resumo_ia != null && String(mem.resumo_ia).trim()) {
    out.push({
      key: `${id}-resumo`,
      titulo: "Resumo IA",
      corpo: String(mem.resumo_ia).trim(),
      rodape: [ts, criadoPor].filter(Boolean).join(" · "),
    });
  }

  const dump = (label: string, obj: unknown) => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v == null || v === "") continue;
      out.push({
        key: `${id}-${label}-${k}`,
        titulo: `${label}: ${k}`,
        corpo: typeof v === "object" ? JSON.stringify(v, null, 0) : String(v),
        rodape: ts,
      });
    }
  };

  dump("Dado", mem.dados_coletados);
  dump("Preferência", mem.preferencias_detectadas);

  const arr = (label: string, a: unknown) => {
    if (!Array.isArray(a) || a.length === 0) return;
    out.push({
      key: `${id}-arr-${label}`,
      titulo: label,
      corpo: a.map((x) => `• ${String(x)}`).join("\n"),
      rodape: ts,
    });
  };

  arr("Objeções", mem.objecoes_levantadas as unknown);
  arr("Interesses", mem.interesses_confirmados as unknown);
  arr("Abordagens eficazes", mem.abordagens_eficazes as unknown);
  arr("Abordagens ineficazes", mem.abordagens_ineficazes as unknown);

  if (mem.melhor_horario_resposta != null && String(mem.melhor_horario_resposta).trim()) {
    out.push({
      key: `${id}-horario`,
      titulo: "Melhor horário",
      corpo: String(mem.melhor_horario_resposta),
      rodape: ts,
    });
  }
  if (mem.humor_predominante != null && String(mem.humor_predominante).trim()) {
    out.push({
      key: `${id}-humor`,
      titulo: "Humor predominante",
      corpo: String(mem.humor_predominante),
      rodape: ts,
    });
  }
  if (mem.nivel_engajamento != null) {
    out.push({
      key: `${id}-eng`,
      titulo: "Engajamento",
      corpo: `${mem.nivel_engajamento}/10`,
      rodape: ts,
    });
  }

  if (out.length === 0 && mem.id) {
    out.push({
      key: `${id}-raw`,
      titulo: "Registo (estrutura mista)",
      corpo:
        "Existe uma linha em hub_memorias_lead sem campos reconhecidos pelo painel. Verifique se o BD usa o mesmo modelo que o código (chave/valor vs. JSON) e se lead_id referencia hub_leads_crm.",
      rodape: ts,
    });
  }

  return out;
}

/** Colunas da view PostgREST — retiradas antes de guardar o lead (mutações usam hub_leads_crm). */
const VW_LEAD_CRM_EXTRA = [
  "pessoa_codigo",
  "pessoa_nome_completo",
  "email_exibicao",
  "pessoa_cidade",
  "pessoa_estado",
  "ultima_mensagem_fila",
  "ultima_mensagem_fila_em",
] as const;

function leadRecordFromVwRow(row: Record<string, unknown>): Record<string, unknown> {
  const o = { ...row };
  for (const k of VW_LEAD_CRM_EXTRA) delete o[k];
  return o;
}

export default function LeadFichaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [lead, setLead] = useState<Record<string, unknown> | null>(null);
  const [pessoaHub, setPessoaHub] = useState<PessoaMini | null>(null);
  const [ultimaFila, setUltimaFila] = useState<UltimaFilaMini | null>(null);
  const [atividades, setAtividades] = useState<Record<string, unknown>[]>([]);
  const [memorias, setMemorias] = useState<Record<string, unknown>[]>([]);
  const [aba, setAba] = useState<"atividades" | "memorias" | "propostas" | "dados">("atividades");
  const [memoriasErro, setMemoriasErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setMemoriasErro(null);

    const [vwRes, a, memRes] = await Promise.all([
      supabase.from("vw_hub_leads_crm_enriquecido").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("hub_atividades")
        .select("*")
        .eq("lead_id", id)
        .order("criado_em", { ascending: false })
        .limit(80),
      supabase.from("hub_memorias_lead").select("*").eq("lead_id", id),
    ]);

    let lData: Record<string, unknown> | null = null;

    if (!vwRes.error && vwRes.data) {
      const row = vwRes.data as Record<string, unknown>;
      lData = leadRecordFromVwRow(row);
      setLead(lData);

      const pid = row.pessoa_id as string | null | undefined;
      const hasPessoa =
        pid &&
        (row.pessoa_codigo != null ||
          row.pessoa_nome_completo != null ||
          row.pessoa_cidade != null ||
          row.pessoa_estado != null);
      if (hasPessoa) {
        const emailLead = (row.email && String(row.email).trim()) || "";
        setPessoaHub({
          codigo: row.pessoa_codigo != null ? String(row.pessoa_codigo) : null,
          nome: row.pessoa_nome_completo != null ? String(row.pessoa_nome_completo) : null,
          email:
            emailLead || row.email_exibicao == null
              ? null
              : String(row.email_exibicao),
          cidade: row.pessoa_cidade != null ? String(row.pessoa_cidade) : null,
          estado: row.pessoa_estado != null ? String(row.pessoa_estado) : null,
        });
      } else if (pid) {
        const { data: pes } = await supabase
          .from("hub_pessoas")
          .select("codigo, nome, email, cidade, estado")
          .eq("id", pid)
          .maybeSingle();
        setPessoaHub(
          pes
            ? {
                codigo: pes.codigo != null ? String(pes.codigo) : null,
                nome: pes.nome != null ? String(pes.nome) : null,
                email: pes.email != null ? String(pes.email) : null,
                cidade: pes.cidade != null ? String(pes.cidade) : null,
                estado: pes.estado != null ? String(pes.estado) : null,
              }
            : null
        );
      } else {
        setPessoaHub(null);
      }

      if (row.ultima_mensagem_fila != null || row.ultima_mensagem_fila_em) {
        setUltimaFila({
          conteudo:
            row.ultima_mensagem_fila != null ? String(row.ultima_mensagem_fila) : null,
          criado_em:
            row.ultima_mensagem_fila_em != null ? String(row.ultima_mensagem_fila_em) : null,
        });
      } else {
        setUltimaFila(null);
      }
    } else {
      const [l, filaRes] = await Promise.all([
        supabase.from("hub_leads_crm").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("hub_fila_mensagens")
          .select("conteudo, criado_em")
          .eq("lead_id", id)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (filaRes.data?.conteudo != null || filaRes.data?.criado_em) {
        setUltimaFila({
          conteudo: filaRes.data.conteudo != null ? String(filaRes.data.conteudo) : null,
          criado_em: filaRes.data.criado_em != null ? String(filaRes.data.criado_em) : null,
        });
      } else {
        setUltimaFila(null);
      }

      if (l.data) {
        lData = l.data as Record<string, unknown>;
        setLead(lData);
        const pid = (l.data as { pessoa_id?: string | null }).pessoa_id;
        if (pid) {
          const { data: pes } = await supabase
            .from("hub_pessoas")
            .select("codigo, nome, email, cidade, estado")
            .eq("id", pid)
            .maybeSingle();
          setPessoaHub(
            pes
              ? {
                  codigo: pes.codigo != null ? String(pes.codigo) : null,
                  nome: pes.nome != null ? String(pes.nome) : null,
                  email: pes.email != null ? String(pes.email) : null,
                  cidade: pes.cidade != null ? String(pes.cidade) : null,
                  estado: pes.estado != null ? String(pes.estado) : null,
                }
              : null
          );
        } else {
          setPessoaHub(null);
        }
      } else {
        setLead(null);
        setPessoaHub(null);
        setUltimaFila(null);
      }
    }

    if (a.data) setAtividades(a.data);

    let rows = memRes.data ?? [];
    let memErr = memRes.error;

    if (!memErr && rows.length === 0 && lData && (lData as { pessoa_id?: string }).pessoa_id) {
      const pid = (lData as { pessoa_id: string }).pessoa_id;
      const { data: hl } = await supabase
        .from("hub_leads")
        .select("id")
        .eq("pessoa_id", pid)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (hl?.id) {
        const m2 = await supabase.from("hub_memorias_lead").select("*").eq("lead_id", hl.id);
        if (m2.error) memErr = m2.error;
        else rows = m2.data ?? [];
      }
    }

    if (memErr) {
      setMemoriasErro(memErr.message);
      setMemorias([]);
    } else {
      rows.sort((x, y) => {
        const cx = Number(x.confianca ?? 0);
        const cy = Number(y.confianca ?? 0);
        if (cx !== cy) return cy - cx;
        const tx = new Date(String(x.atualizado_em ?? x.criado_em ?? 0)).getTime();
        const ty = new Date(String(y.atualizado_em ?? y.criado_em ?? 0)).getTime();
        return ty - tx;
      });
      setMemorias(rows);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const chipsMemoria = useMemo(() => memorias.flatMap(chipsFromMemoriaRow), [memorias]);

  async function criarNegocio() {
    const res = await fetch(`/api/crm/leads/${id}/converter-negocio`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({}),
    });
    const json = (await res.json()) as { data?: { id: string }; error?: string };
    if (!res.ok) {
      alert(json.error || "Não foi possível criar o negócio.");
      return;
    }
    if (json.data?.id) router.push(`/crm/negocios/${json.data.id}`);
  }

  async function moverEstagio(estagioNovo: string, extra?: Record<string, unknown>) {
    const res = await patchLeadCrm(id, {
      estagio: estagioNovo,
      _estagio_anterior: lead?.estagio as string,
      ...extra,
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    carregar();
  }

  if (!lead) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm"
        style={{ backgroundColor: BG_DEEP, color: "#8b949e" }}
      >
        Carregando ficha…
      </div>
    );
  }

  const estagio = estagioParaColunaKanban(lead.estagio as string);
  const corEstagio = ESTAGIO_COR[estagio] || "#888";
  const meta = (lead.metadata as Record<string, unknown>) || {};
  const mercadoMeta =
    (meta.mercado as string) || (meta.primeira_mensagem != null ? "ver metadata" : null);

  const camposDados: { label: string; value: string }[] = [
    {
      label: "Código participante",
      value: codigoParticipante(pessoaHub),
    },
    { label: "Score", value: `${lead.score ?? 0}/100` },
    { label: "Origem", value: (lead.origem as string) || "—" },
    {
      label: "E-mail",
      value: emailExibicao(lead.email as string | null | undefined, pessoaHub ?? undefined),
    },
    { label: "Campanha", value: (lead.campanha as string) || "—" },
    { label: "Mercado (metadata)", value: mercadoMeta || "—" },
    { label: "Interesse", value: (lead.interesse_principal as string) || "—" },
    {
      label: "Cidade / UF",
      value:
        [pessoaHub?.cidade, pessoaHub?.estado].filter(Boolean).join(" / ") || "—",
    },
    { label: "Agente", value: (lead.agente_responsavel as string) || "—" },
    { label: "Responsável", value: (lead.humano_responsavel as string) || "IA" },
    {
      label: "Última mensagem",
      value: ultimaMensagemExibicao(
        lead.ultima_mensagem as string | null | undefined,
        ultimaFila,
        120
      ),
    },
    {
      label: "Último contato",
      value: lead.ultimo_contato
        ? formatarDataHora(lead.ultimo_contato as string)
        : ultimaFila?.criado_em
          ? formatarDataHora(ultimaFila.criado_em)
          : "—",
    },
    { label: "Próxima ação", value: (lead.proxima_acao as string) || "—" },
    {
      label: "Valor",
      value:
        (lead.valor_estimado as number) > 0
          ? `R$ ${((lead.valor_estimado as number) / 1000).toFixed(0)}k`
          : "—",
    },
    {
      label: "Criado em",
      value: new Date(lead.criado_em as string).toLocaleDateString("pt-BR"),
    },
  ];

  const CARD_INNER = "rgba(8, 12, 20, 0.65)";

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: BG_DEEP }}>
      <header
        className="flex flex-shrink-0 items-center justify-between gap-3 border-b px-4 py-3 md:px-5"
        style={{ borderColor: BORDER_SUBTLE, backgroundColor: BG_PANEL }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            style={{ borderColor: BORDER_SUBTLE }}
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-base font-bold tracking-tight text-white md:text-lg">
                {lead.nome as string}
              </h1>
              <span
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: `${corEstagio}18`,
                  color: corEstagio,
                  border: `1px solid ${corEstagio}44`,
                }}
              >
                {estagio}
              </span>
            </div>
            {(lead.codigo as string | undefined) && (
              <p className="mt-0.5 font-mono text-xs font-semibold text-[#c9a24a]">
                {String(lead.codigo)}
              </p>
            )}
            <p className="mt-0.5 truncate text-xs" style={{ color: "#7d8a99" }}>
              {lead.telefone as string} · {lead.origem as string}
              {(lead.valor_estimado as number) > 0 &&
                ` · R$ ${((lead.valor_estimado as number) / 1000).toFixed(0)}k`}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void criarNegocio()}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-colors md:text-sm"
            style={{ borderColor: BORDER_SUBTLE, color: "#c9a24a", background: "#003b2622" }}
          >
            <Briefcase className="h-4 w-4" strokeWidth={2} />
            Criar negócio
          </button>
          <button
            type="button"
            onClick={() => router.push(`/crm/atendimento?lead=${id}`)}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors md:text-sm"
            style={{
              background: "linear-gradient(180deg, #c45c26 0%, #9a471d 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
            }}
          >
            <MessageSquare className="h-4 w-4 opacity-90" strokeWidth={2} />
            Central de atendimento
          </button>
        </div>
      </header>

      <div
        className="flex flex-shrink-0 gap-1 overflow-x-auto border-b px-3 py-2 md:px-4"
        style={{ borderColor: BORDER_SUBTLE, backgroundColor: "rgba(5, 8, 14, 0.92)" }}
      >
        {FUNIL_LEAD_ETAPAS.map((e) => (
          <button
            key={e.slug}
            type="button"
            onClick={() => void moverEstagio(e.slug)}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors md:text-xs ${
              estagio === e.slug ? "font-semibold" : "text-gray-500 hover:bg-white/[0.05] hover:text-gray-300"
            }`}
            style={
              estagio === e.slug
                ? {
                    backgroundColor: `${e.cor}22`,
                    color: e.cor,
                    border: `1px solid ${e.cor}55`,
                  }
                : { border: `1px solid transparent` }
            }
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CrmStickyTabs
          activeId={aba}
          onChange={(tabId) => setAba(tabId as typeof aba)}
          equalColumns
          tabs={[
            { id: "atividades", label: `Atividades (${atividades.length})`, icon: ClipboardList },
            { id: "memorias", label: `Memórias IA (${chipsMemoria.length})`, icon: Brain },
            { id: "propostas", label: "Propostas", icon: FileText },
            { id: "dados", label: "Dados", icon: IdCard },
          ]}
          style={{
            background: BG_PANEL,
            borderBottom: `1px solid ${BORDER_SUBTLE}`,
            boxShadow: "none",
          }}
        />

          {aba === "atividades" && (
            <div
              className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6"
              style={{ backgroundColor: BG_DEEP }}
            >
              {atividades.length === 0 ? (
                <p className="pt-12 text-center text-xs" style={{ color: "#5c6570" }}>
                  Nenhuma atividade registada
                </p>
              ) : (
                <div className="relative mx-auto max-w-2xl">
                  <div
                    className="absolute bottom-0 left-[15px] top-2 w-px md:left-[17px]"
                    style={{ background: `linear-gradient(180deg, ${TIMELINE_TRACK}, transparent)` }}
                    aria-hidden
                  />
                  <ul className="relative flex flex-col gap-0">
                    {atividades.map((at, idx) => {
                      const isIa = (at.feito_por_tipo as string) === "ia";
                      const dataAbs = formatarDataHora(at.criado_em as string);
                      return (
                        <li key={at.id as string} className="relative flex gap-4 pb-8 pl-10 md:gap-5 md:pl-11">
                          <div
                            className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border md:left-0.5 md:h-9 md:w-9"
                            style={{
                              borderColor: isIa ? "rgba(201,162,74,0.45)" : BORDER_SUBTLE,
                              backgroundColor: isIa ? "rgba(201,162,74,0.12)" : "rgba(15,22,32,0.95)",
                              boxShadow: "0 0 0 4px rgba(5,8,14,0.9)",
                            }}
                          >
                            {isIa ? (
                              <Sparkles className="h-4 w-4 text-[#d6b976]" strokeWidth={2} />
                            ) : (
                              <User className="h-4 w-4 text-gray-400" strokeWidth={2} />
                            )}
                          </div>
                          <div
                            className="min-w-0 flex-1 rounded-lg border px-3 py-2.5 md:px-4"
                            style={{
                              borderColor: BORDER_SUBTLE,
                              backgroundColor: idx === 0 ? "rgba(16,24,36,0.85)" : "rgba(10,14,22,0.72)",
                            }}
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8b949e]">
                                {String(at.tipo || "evento").replace(/_/g, " ")}
                              </span>
                              <time
                                className="text-[10px] tabular-nums text-[#5c6570]"
                                dateTime={at.criado_em as string}
                              >
                                {dataAbs}
                              </time>
                            </div>
                            <p className="mt-1.5 text-sm leading-relaxed text-gray-200">
                              {at.descricao as string}
                            </p>
                            <p className="mt-2 text-[11px]" style={{ color: "#5c6570" }}>
                              <span className="text-[#7d8a99]">{(at.feito_por as string) || "—"}</span>
                              {" · "}
                              {tempoRelativo(at.criado_em as string)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {aba === "memorias" && (
            <div
              className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6"
              style={{ backgroundColor: BG_DEEP }}
            >
              <div
                className="mb-4 max-w-2xl rounded-lg border px-3 py-2.5 text-xs leading-relaxed"
                style={{
                  borderColor: BORDER_SUBTLE,
                  backgroundColor: "rgba(10, 16, 24, 0.9)",
                  color: "#8b949e",
                }}
              >
                <p className="font-medium text-gray-300">Memórias e schema</p>
                <p className="mt-1.5">
                  O CRM lê <code className="rounded bg-black/40 px-1 py-0.5 text-[10px]">hub_memorias_lead</code> com{" "}
                  <code className="rounded bg-black/40 px-1 py-0.5 text-[10px]">lead_id</code> igual ao deste lead em{" "}
                  <code className="rounded bg-black/40 px-1 py-0.5 text-[10px]">hub_leads_crm</code>, ou ao{" "}
                  <code className="rounded bg-black/40 px-1 py-0.5 text-[10px]">hub_leads</code> mais recente da mesma{" "}
                  <code className="rounded bg-black/40 px-1 py-0.5 text-[10px]">pessoa_id</code> quando a primeira
                  consulta vem vazia. Se a tabela no Supabase tiver FK só para um dos modelos ou colunas só em JSON
                  (sem <code className="text-[10px]">chave</code>/<code className="text-[10px]">valor</code>), os
                  inserts antigos podem falhar ou esta lista fica vazia até alinhar migração e RLS.
                </p>
              </div>

              {memoriasErro && (
                <div
                  className="mb-4 max-w-2xl rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
                >
                  Erro ao ler memórias: {memoriasErro}
                </div>
              )}

              {chipsMemoria.length === 0 && !memoriasErro ? (
                <p className="pt-4 text-center text-xs" style={{ color: "#5c6570" }}>
                  Nenhum conteúdo de memória para exibir (0 linhas ou formato não mapeado).
                </p>
              ) : (
                <div className="mx-auto flex max-w-2xl flex-col gap-2">
                  {chipsMemoria.map((c) => (
                    <div
                      key={c.key}
                      className="rounded-lg border px-3 py-2.5"
                      style={{
                        borderColor: BORDER_SUBTLE,
                        backgroundColor: "rgba(10, 16, 24, 0.88)",
                      }}
                    >
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#c9a24a]">
                          {c.titulo}
                        </span>
                        <span className="text-[10px] text-[#5c6570]">{c.rodape}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{c.corpo}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {aba === "propostas" && (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6" style={{ backgroundColor: BG_DEEP }}>
              <div className="mx-auto max-w-lg">
                <LeadPropostasPanel leadId={id} />
              </div>
            </div>
          )}

          {aba === "dados" && (
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{ backgroundColor: BG_DEEP }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
                <article
                  className="mx-auto max-w-5xl rounded-2xl border p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] md:p-6"
                  style={{
                    borderColor: BORDER_SUBTLE,
                    background:
                      "linear-gradient(165deg, rgba(18, 26, 38, 0.95) 0%, rgba(8, 12, 18, 0.98) 100%)",
                  }}
                >
                  <div
                    className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-dashed pb-4"
                    style={{ borderColor: BORDER_SUBTLE }}
                  >
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-white" title={`ID técnico (copiar): ${id}`}>
                        Registo CRM
                      </h2>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#8b949e]">
                        {pessoaHub ? (
                          <>
                            <span className="text-[#6b7280]">Participante</span>{" "}
                            {pessoaHub.codigo ? (
                              <span className="font-mono font-semibold text-[#c9a24a]">{pessoaHub.codigo}</span>
                            ) : (
                              <span className="text-[#8b949e]">(sem código PES)</span>
                            )}
                            {pessoaHub.nome ? (
                              <>
                                {" · "}
                                <span className="text-gray-300">{pessoaHub.nome}</span>
                              </>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <span className="text-[#6b7280]">Sem código PES neste lead</span>
                            {" · "}
                            <span>entrada manual ou associe em hub_pessoas</span>
                          </>
                        )}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-[#8b949e]">
                        <span className="text-gray-300">{(lead.telefone as string) || "—"}</span>
                        {" · "}
                        <span>{(lead.origem as string) || "—"}</span>
                        {" · "}
                        <span>
                          score{" "}
                          {`${Number(lead.score ?? 0)}/100`}
                        </span>
                        {" · "}
                        <span>
                          {(lead.agente_responsavel as string) || "—"} /{" "}
                          {(lead.humano_responsavel as string) || "IA"}
                        </span>
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        backgroundColor: `${corEstagio}20`,
                        color: corEstagio,
                        border: `1px solid ${corEstagio}44`,
                      }}
                    >
                      {estagio}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-4 lg:gap-y-3">
                    {camposDados.map((f) => (
                      <div
                        key={f.label}
                        className="rounded-lg border px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
                        style={{
                          borderColor: BORDER_SUBTLE,
                          backgroundColor: CARD_INNER,
                        }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
                          {f.label}
                        </p>
                        <p className="mt-1 break-words text-sm font-medium leading-snug text-gray-100">
                          {f.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              </div>

              <footer
                className="flex-shrink-0 border-t px-4 py-3 md:px-6"
                style={{ borderColor: BORDER_SUBTLE, backgroundColor: BG_PANEL }}
              >
                <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] sm:mr-auto sm:self-center">
                    Ações
                  </p>
                  <div
                    className="flex w-full overflow-hidden rounded-lg border sm:w-auto sm:min-w-0"
                    style={{ borderColor: BORDER_SUBTLE }}
                    role="group"
                    aria-label="Ações do lead"
                  >
                    <button
                      type="button"
                      onClick={() => router.push(`/crm/atendimento?lead=${id}`)}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 border-r px-3 text-xs font-semibold text-white transition-opacity hover:opacity-95 sm:flex-initial sm:px-4"
                      style={{
                        borderColor: BORDER_SUBTLE,
                        background: "linear-gradient(180deg, #c45c26 0%, #9a471d 100%)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
                      }}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      <span className="truncate">Central de atendimento</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void criarNegocio()}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 border-r px-2 text-xs font-medium text-gray-200 transition-colors hover:bg-white/[0.06] sm:flex-initial sm:px-3"
                      style={{
                        borderColor: BORDER_SUBTLE,
                        backgroundColor: "rgba(5, 8, 14, 0.65)",
                      }}
                    >
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={2} />
                      Negócio
                    </button>
                    <button
                      type="button"
                      onClick={() => moverEstagio("perdido")}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 border-r px-2 text-xs font-medium text-gray-200 transition-colors hover:bg-white/[0.06] sm:flex-initial sm:px-3"
                      style={{
                        borderColor: BORDER_SUBTLE,
                        backgroundColor: "rgba(5, 8, 14, 0.65)",
                      }}
                    >
                      <X className="h-3.5 w-3.5 shrink-0 text-red-400" strokeWidth={2} />
                      Perdido
                    </button>
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 px-2 text-xs font-medium text-gray-400 transition-colors hover:bg-white/[0.05] hover:text-gray-200 sm:flex-initial sm:px-3"
                      style={{ backgroundColor: "rgba(5, 8, 14, 0.65)" }}
                    >
                      <ArrowLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      Voltar
                    </button>
                  </div>
                </div>
              </footer>
            </div>
          )}
      </div>
    </div>
  );
}
