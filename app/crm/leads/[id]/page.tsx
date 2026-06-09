"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { estagioParaColunaKanban } from "@/lib/crm/estagio-map";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import { FUNIL_LEAD_ETAPAS } from "@/lib/crm/pipelines";
import { useCrmToast } from "@/lib/crm/crm-feedback";
import { CrmStickyTabs } from "@/components/crm/CrmStickyTabs";
import { LeadPropostasPanel } from "@/components/crm/LeadPropostasPanel";
import { LeadTimelineTab } from "@/components/crm/leads/LeadTimelineTab";
import { LeadObservacoesTab, type CrmNota } from "@/components/crm/leads/LeadObservacoesTab";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import { CRM_ACCENT, crmBtnPrimary, crmBtnSecondary } from "@/lib/crm/crm-button-styles";
import { CRM_SURFACE_MAIN } from "@/lib/crm-shell-theme";
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
  ClipboardList,
  FileText,
  IdCard,
  MessageSquare,
  StickyNote,
  X,
} from "lucide-react";

const ESTAGIO_COR: Record<string, string> = Object.fromEntries(
  FUNIL_LEAD_ETAPAS.map((e) => [e.slug, e.cor])
);

const CARD_SHELL = {
  background: "#ffffff",
  border: "1px solid rgba(18, 56, 43, 0.12)",
  borderRadius: 16,
  boxShadow: "0 8px 24px rgba(15, 56, 39, 0.05)",
} as const;

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
  const { error: toastError } = useCrmToast();

  const [lead, setLead] = useState<Record<string, unknown> | null>(null);
  const [pessoaHub, setPessoaHub] = useState<PessoaMini | null>(null);
  const [ultimaFila, setUltimaFila] = useState<UltimaFilaMini | null>(null);
  const [memorias, setMemorias] = useState<Record<string, unknown>[]>([]);
  const [notas, setNotas] = useState<CrmNota[]>([]);
  const [novaNota, setNovaNota] = useState("");
  const [aba, setAba] = useState<"timeline" | "observacoes" | "memorias" | "propostas" | "dados">("timeline");
  const [memoriasErro, setMemoriasErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setMemoriasErro(null);

    const [vwRes, memRes] = await Promise.all([
      supabase.from("vw_hub_leads_crm_enriquecido").select("*").eq("id", id).maybeSingle(),
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

    const { data: notasRows } = await supabase
      .from("hub_notas")
      .select("id, conteudo, criado_por, criado_em")
      .eq("lead_id", id)
      .order("criado_em", { ascending: false })
      .limit(30);
    setNotas((notasRows ?? []) as CrmNota[]);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const chipsMemoria = useMemo(() => memorias.flatMap(chipsFromMemoriaRow), [memorias]);

  async function adicionarNota() {
    if (!id || !novaNota.trim()) return;
    const { data } = await supabase
      .from("hub_notas")
      .insert({ lead_id: id, conteudo: novaNota.trim(), criado_por: "humano" })
      .select("id, conteudo, criado_por, criado_em")
      .single();
    if (data) {
      setNotas((prev) => [data as CrmNota, ...prev]);
      await supabase.from("hub_atividades").insert({
        lead_id: id,
        tipo: "nota",
        descricao: novaNota.trim().slice(0, 80),
        feito_por: "humano",
        feito_por_tipo: "humano",
      });
      setNovaNota("");
    }
  }

  async function criarNegocio() {
    const res = await fetch(`/api/crm/leads/${id}/converter-negocio`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({}),
    });
    const json = (await res.json()) as { data?: { id: string }; error?: string };
    if (!res.ok) {
      toastError(json.error || "Não foi possível criar o negócio.");
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
      toastError(res.error);
      return;
    }
    carregar();
  }

  if (!lead) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm"
        style={{ backgroundColor: CRM_SURFACE_MAIN, color: "#5d7a67" }}
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

  const metricTiles = [
    { label: "Score", value: `${lead.score ?? 0}/100`, color: BRAND_GREEN_BRIGHT },
    {
      label: "Valor estimado",
      value:
        (lead.valor_estimado as number) > 0
          ? `R$ ${((lead.valor_estimado as number) / 1000).toFixed(0)}k`
          : "—",
      color: CRM_ACCENT,
    },
    { label: "Memórias IA", value: String(chipsMemoria.length), color: "#3b82f6" },
    {
      label: "Último contato",
      value: lead.ultimo_contato
        ? formatarDataHora(lead.ultimo_contato as string).split(" ")[0]
        : ultimaFila?.criado_em
          ? formatarDataHora(ultimaFila.criado_em).split(" ")[0]
          : "—",
      color: "#6b8a76",
    },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: CRM_SURFACE_MAIN }}>
      <header
        className="flex-shrink-0 border-b bg-white px-4 py-3 md:px-6"
        style={{ borderColor: "rgba(18, 56, 43, 0.14)", boxShadow: "0 4px 24px rgba(15, 56, 39, 0.08)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Voltar"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border"
              style={{ borderColor: "#dcebd8", background: "#eef7eb", color: BRAND_TEXT_DARK }}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-extrabold tracking-tight md:text-xl" style={{ color: BRAND_TEXT_DARK }}>
                  {lead.nome as string}
                </h1>
                <span
                  className="rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
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
                <p className="mt-0.5 font-mono text-xs font-semibold" style={{ color: CRM_ACCENT }}>
                  {String(lead.codigo)}
                </p>
              )}
              <p className="mt-0.5 truncate text-xs font-semibold text-[#3d5c48]">
                {lead.telefone as string} · {lead.origem as string}
                {(lead.agente_responsavel as string) ? ` · ${lead.agente_responsavel as string}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-wrap gap-2">
            <button type="button" onClick={() => void criarNegocio()} style={crmBtnSecondary()}>
              <span className="inline-flex items-center gap-2">
                <Briefcase size={15} />
                Criar negócio
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push(`/crm/atendimento?lead=${id}`)}
              style={crmBtnPrimary()}
            >
              <span className="inline-flex items-center gap-2">
                <MessageSquare size={15} />
                Central de atendimento
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        className="flex flex-shrink-0 gap-1 overflow-x-auto border-b bg-white px-4 py-2 md:px-6"
        style={{ borderColor: "rgba(18, 56, 43, 0.12)" }}
      >
        <div className="mx-auto flex w-full max-w-6xl gap-1">
          {FUNIL_LEAD_ETAPAS.map((e) => (
            <button
              key={e.slug}
              type="button"
              onClick={() => void moverEstagio(e.slug)}
              className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors md:text-xs"
              style={
                estagio === e.slug
                  ? {
                      backgroundColor: e.cor,
                      color: "#fff",
                      border: `1px solid ${e.cor}`,
                    }
                  : {
                      backgroundColor: `${e.cor}18`,
                      color: e.cor,
                      border: `1px solid ${e.cor}55`,
                    }
              }
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex flex-shrink-0 border-b bg-white px-4 py-3 md:px-6"
        style={{ borderColor: "rgba(18, 56, 43, 0.12)" }}
      >
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-3 md:grid-cols-4">
          {metricTiles.map((tile) => (
            <div
              key={tile.label}
              style={{
                ...CARD_SHELL,
                padding: "12px 14px",
              }}
            >
              <p className="text-[9px] font-extrabold uppercase tracking-wide text-[#6b8a76]">{tile.label}</p>
              <p className="mt-1 text-xl font-extrabold leading-none" style={{ color: tile.color }}>
                {tile.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <CrmStickyTabs
            variant="light"
            activeId={aba}
            onChange={(tabId) => setAba(tabId as typeof aba)}
            equalColumns
            tabs={[
              { id: "timeline", label: "Timeline", icon: ClipboardList },
              { id: "observacoes", label: `Observações (${notas.length})`, icon: StickyNote },
              { id: "memorias", label: `Memórias IA (${chipsMemoria.length})`, icon: Brain },
              { id: "propostas", label: "Propostas", icon: FileText },
              { id: "dados", label: "Dados", icon: IdCard },
            ]}
            style={{ position: "relative", top: 0, zIndex: 10 }}
          />

          {aba === "timeline" && (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
              <div className="mx-auto max-w-3xl">
                <LeadTimelineTab
                  leadId={id}
                  leadNome={lead.nome as string}
                  metadata={lead.metadata}
                  theme="light"
                />
              </div>
            </div>
          )}

          {aba === "observacoes" && (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
              <div className="mx-auto max-w-2xl">
                <LeadObservacoesTab
                  variant="waje"
                  notas={notas}
                  novaNota={novaNota}
                  onNovaNotaChange={setNovaNota}
                  onAdicionar={adicionarNota}
                />
              </div>
            </div>
          )}

          {aba === "memorias" && (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
              {memoriasErro ? (
                <div className="mx-auto mb-4 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Erro ao ler memórias: {memoriasErro}
                </div>
              ) : null}

              {chipsMemoria.length === 0 && !memoriasErro ? (
                <p className="pt-4 text-center text-xs text-[#6b8a76]">
                  Nenhum conteúdo de memória para exibir.
                </p>
              ) : (
                <div className="mx-auto flex max-w-2xl flex-col gap-2">
                  {chipsMemoria.map((c) => (
                    <div key={c.key} className="rounded-xl border px-3 py-2.5" style={{ ...CARD_SHELL, padding: "12px 14px" }}>
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: CRM_ACCENT }}>
                          {c.titulo}
                        </span>
                        <span className="text-[10px] text-[#6b8a76]">{c.rodape}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#0b2210]">{c.corpo}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {aba === "propostas" && (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
              <div className="mx-auto max-w-lg">
                <LeadPropostasPanel leadId={id} />
              </div>
            </div>
          )}

          {aba === "dados" && (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
              <article className="mx-auto max-w-4xl rounded-2xl border p-4 md:p-6" style={CARD_SHELL}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-[#dcebd8] pb-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-[#0b2210]" title={`ID técnico: ${id}`}>
                      Registo CRM
                    </h2>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#5d7a67]">
                      {pessoaHub?.codigo ? (
                        <>
                          Participante <span className="font-mono font-bold text-[#1a5c32]">{pessoaHub.codigo}</span>
                          {pessoaHub.nome ? ` · ${pessoaHub.nome}` : ""}
                        </>
                      ) : (
                        "Sem código PES neste lead"
                      )}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: `${corEstagio}20`,
                      color: corEstagio,
                      border: `1px solid ${corEstagio}44`,
                    }}
                  >
                    {estagio}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {camposDados.map((f) => (
                    <div
                      key={f.label}
                      className="rounded-lg border border-[#e8f0e6] bg-[#f8fcf6] px-3 py-2.5"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#6b8a76]">{f.label}</p>
                      <p className="mt-1 break-words text-sm font-semibold leading-snug text-[#0b2210]">{f.value}</p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          )}
        </div>

        <aside
          className="hidden w-[260px] flex-shrink-0 flex-col border-l bg-white lg:flex"
          style={{ borderColor: "rgba(18, 56, 43, 0.12)" }}
        >
          <div className="border-b px-4 py-4" style={{ borderColor: "rgba(18, 56, 43, 0.12)" }}>
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#6b8a76]">Ações rápidas</p>
          </div>
          <div className="flex flex-col gap-2 p-4">
            <button
              type="button"
              onClick={() => router.push(`/crm/atendimento?lead=${id}`)}
              style={{ ...crmBtnPrimary(), width: "100%" }}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <MessageSquare size={14} />
                Atendimento
              </span>
            </button>
            <button type="button" onClick={() => void criarNegocio()} style={{ ...crmBtnSecondary(), width: "100%" }}>
              <span className="inline-flex items-center justify-center gap-2">
                <Briefcase size={14} />
                Criar negócio
              </span>
            </button>
            <button
              type="button"
              onClick={() => void moverEstagio("perdido")}
              className="w-full rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <X size={14} />
                Marcar perdido
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAba("dados")}
              className="w-full rounded-[10px] border border-[#d4ecd0] bg-white px-3 py-2.5 text-xs font-bold text-[#1e4a24]"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Check size={14} />
                Ver dados completos
              </span>
            </button>
          </div>
          <div className="mt-auto border-t p-4 text-[11px] leading-relaxed text-[#5d7a67]" style={{ borderColor: "rgba(18, 56, 43, 0.12)" }}>
            <p>
              <strong className="text-[#0b2210]">Responsável:</strong>{" "}
              {(lead.humano_responsavel as string) || "IA"}
            </p>
            <p className="mt-2">
              <strong className="text-[#0b2210]">Agente:</strong>{" "}
              {(lead.agente_responsavel as string) || "—"}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
