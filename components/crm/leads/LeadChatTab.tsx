"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Bot, Send, StickyNote, User, UserRound, Users } from "lucide-react";
import {
  CRM_SIDEOVER_INPUT,
  CRM_SIDEOVER_INPUT_STYLE,
  CRM_SIDEOVER_LABEL,
  CrmSideoverActionBtn,
  CrmSideoverActionGroup,
  CrmSideoverInlinePanel,
  CrmSideoverToolbarRow,
} from "@/components/crm/CrmSideoverActionGroup";
import { CrmBotRingAvatar } from "@/components/crm/CrmBotRingAvatar";
import type { CrmNota } from "@/components/crm/leads/LeadObservacoesTab";
import {
  effectiveHumanoResponsavel,
  formatHumanoDisplayName,
} from "@/lib/crm/resolve-crm-actor";
import { crmApiHeadersWithActor, getCrmSessionActor } from "@/lib/internal-api-headers-client";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { parseConversaTurnos } from "@/lib/crm/lead-timeline";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import type { AtendenteCrm } from "@/lib/crm/atendentes-crm";
import { supabase } from "@/lib/supabase/client";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type AutorTipo = "cliente" | "ia" | "humano" | "anotacao";

type ChatMsg = {
  id: string;
  conteudo: string;
  autor: AutorTipo;
  autorLabel: string;
  agentSlug?: string;
  criado_em: string;
};

type HubAgenteOption = {
  agente_slug: string;
  nome: string;
  ativo?: boolean;
  arquivado_em?: string | null;
};

type AtendimentoModo = "ia" | "humano" | "grupo";

type Props = {
  leadId: string;
  leadNome?: string;
  metadata?: unknown;
  humanoResponsavel?: string | null;
  agenteResponsavel?: string | null;
  onHumanoResponsavelChange?: (valor: string | null) => void;
  onAgenteResponsavelChange?: (valor: string | null) => void;
  onMetadataChange?: (metadata: unknown) => void;
  /** Notas já carregadas no sideover (atualização imediata ao adicionar). */
  notasExternas?: CrmNota[];
  /** false = só histórico (sem assumir/enviar). */
  interactive?: boolean;
};

function metaRecord(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

function parseAtendimentoState(
  metadata: unknown,
  humanoResponsavel?: string | null
): { modo: AtendimentoModo; badgeLabel: string } {
  const meta = metaRecord(metadata);
  const canalAtivo = String(meta.canal_ativo ?? "").toLowerCase();
  const groupJid = String(meta.whatsapp_group_jid ?? "").trim();
  if (canalAtivo === "group" && groupJid) {
    return { modo: "grupo", badgeLabel: "Grupo WhatsApp" };
  }
  const humano = humanoResponsavel?.trim();
  if (humano) {
    return { modo: "humano", badgeLabel: `Humano: ${formatHumanoDisplayName(humano)}` };
  }
  return { modo: "ia", badgeLabel: "IA" };
}

function badgeTone(modo: AtendimentoModo): { bg: string; border: string; color: string } {
  if (modo === "grupo") {
    return { bg: "rgba(56, 139, 253, 0.14)", border: "rgba(56, 139, 253, 0.45)", color: "#79c0ff" };
  }
  if (modo === "humano") {
    return { bg: "rgba(201, 162, 74, 0.14)", border: "rgba(201, 162, 74, 0.45)", color: "#c9a24a" };
  }
  return { bg: "rgba(34, 197, 94, 0.12)", border: "rgba(34, 197, 94, 0.4)", color: "#86efac" };
}

const AVATAR_SIZE = 36;

function tempo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function autorFromMensagem(row: Record<string, unknown>): {
  autor: AutorTipo;
  label: string;
  agentSlug?: string;
} {
  const direcao = String(row.direcao ?? "");
  if (direcao === "entrada") {
    return { autor: "cliente", label: "Lead" };
  }
  const agenteId = String(row.agente_id ?? row.agente_responsavel ?? "").trim();
  const agenteLower = agenteId.toLowerCase();
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const feitoPorTipo = String(row.feito_por_tipo ?? meta.feito_por_tipo ?? "").toLowerCase();
  const feitoPor = String(meta.feito_por ?? "").trim();
  if (feitoPorTipo === "humano" || agenteLower.includes("humano")) {
    return {
      autor: "humano",
      label: feitoPor ? formatHumanoDisplayName(feitoPor) : "Humano",
    };
  }
  return {
    autor: "ia",
    label: agenteId ? `Funcionário IA · ${agenteId}` : "Funcionário IA",
    agentSlug: agenteId || undefined,
  };
}

function notasParaMensagens(notas: CrmNota[]): ChatMsg[] {
  return notas.map((n) => ({
    id: `nota-${n.id}`,
    conteudo: n.conteudo,
    autor: "anotacao" as const,
    autorLabel: n.criado_por || "Equipe",
    criado_em: n.criado_em,
  }));
}

function mergeMensagens(
  fila: Record<string, unknown>[],
  metadata: unknown,
  notas: CrmNota[] = []
): ChatMsg[] {
  const map = new Map<string, ChatMsg>();

  for (const row of fila) {
    const conteudo = String(row.conteudo ?? "").trim();
    if (!conteudo) continue;
    const { autor, label, agentSlug } = autorFromMensagem(row);
    const criado = String(row.enviada_em ?? row.criado_em ?? new Date().toISOString());
    const id = String(row.id ?? `fila-${criado}-${conteudo.slice(0, 12)}`);
    map.set(id, { id, conteudo, autor, autorLabel: label, agentSlug, criado_em: criado });
  }

  for (const turno of parseConversaTurnos(metadata)) {
    const id = `turno-${turno.at ?? turno.content.slice(0, 16)}`;
    if (map.has(id)) continue;
    map.set(id, {
      id,
      conteudo: turno.content,
      autor: turno.role === "assistant" ? "ia" : "cliente",
      autorLabel: turno.role === "assistant" ? "Funcionário IA" : "Lead",
      criado_em: turno.at ?? new Date(0).toISOString(),
    });
  }

  for (const msg of notasParaMensagens(notas)) {
    map.set(msg.id, msg);
  }

  return [...map.values()].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()
  );
}

function LeadChatAvatar({ autor, agentSlug }: { autor: AutorTipo; agentSlug?: string }) {
  if (autor === "anotacao") {
    return (
      <div
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: "50%",
          background: "rgba(167, 139, 250, 0.14)",
          border: "1px solid rgba(167, 139, 250, 0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <StickyNote size={17} color="#c4b5fd" strokeWidth={2} aria-hidden />
      </div>
    );
  }

  if (autor === "cliente") {
    return (
      <div
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: "50%",
          background: "#1c2a3a",
          border: "1px solid #388bfd55",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <UserRound size={18} color="#79c0ff" strokeWidth={2} aria-hidden />
      </div>
    );
  }

  if (autor === "humano") {
    return (
      <div
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: "50%",
          background: "rgba(201, 162, 74, 0.14)",
          border: "1px solid rgba(201, 162, 74, 0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <User size={18} color="#c9a24a" strokeWidth={2} aria-hidden />
      </div>
    );
  }

  if (agentSlug) {
    return (
      <CrmBotRingAvatar
        pixelSize={AVATAR_SIZE}
        hideProgressRing
        fallbackProgress={0}
        avatarSeed={agentSlug}
        avatarNome={agentSlug}
      />
    );
  }

  return (
    <div
      style={{
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: "50%",
        background: "linear-gradient(145deg, #003b26, #14532d)",
        border: "1px solid #22c55e55",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Bot size={20} color="#86efac" strokeWidth={2} aria-hidden />
    </div>
  );
}

function LeadChatMessageLabel({ msg }: { msg: ChatMsg }) {
  if (msg.autor === "anotacao") {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: "#c4b5fd" }}>
        Anotação interna · {msg.autorLabel}
      </span>
    );
  }
  if (msg.autor === "cliente") {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: "#79c0ff" }}>{msg.autorLabel}</span>
    );
  }
  if (msg.autor === "humano") {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: "#c9a24a" }}>{msg.autorLabel}</span>
    );
  }
  const parts = msg.autorLabel.split(" · ");
  if (parts.length >= 2) {
    return (
      <span style={{ fontSize: 11, fontWeight: 700, color: "#86efac" }}>
        {parts[0]}{" "}
        <span style={{ fontWeight: 600, color: "#7f90a8" }}>· {parts.slice(1).join(" · ")}</span>
      </span>
    );
  }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: "#86efac" }}>{msg.autorLabel}</span>
  );
}

function LeadChatBubble({ msg }: { msg: ChatMsg }) {
  if (msg.autor === "anotacao") {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
        <div style={{ maxWidth: "min(92%, 560px)", width: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <LeadChatAvatar autor="anotacao" />
            <LeadChatMessageLabel msg={msg} />
            <span style={{ fontSize: 10, color: "#6e7681" }}>{tempo(msg.criado_em)}</span>
          </div>
          <div
            style={{
              background: "rgba(167, 139, 250, 0.08)",
              border: "1px dashed rgba(167, 139, 250, 0.45)",
              borderRadius: 12,
              padding: "12px 14px",
              fontSize: 13,
              color: RF_TEXT_PRIMARY,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              textAlign: "center",
            }}
          >
            {msg.conteudo}
          </div>
          <p
            style={{
              margin: "6px 0 0",
              textAlign: "center",
              fontSize: 10,
              fontWeight: 600,
              color: "#7f90a8",
            }}
          >
            Só visível no CRM — não enviada ao cliente
          </p>
        </div>
      </div>
    );
  }

  const isCliente = msg.autor === "cliente";
  const isHumano = msg.autor === "humano";

  const bubbleStyle: CSSProperties = isCliente
    ? {
        background: "rgba(11, 31, 16, 0.95)",
        border: `1px solid ${RF_BORDER_STRONG}`,
        borderRadius: "16px 16px 6px 16px",
      }
    : isHumano
      ? {
          background: "rgba(201, 162, 74, 0.12)",
          border: "1px solid rgba(201, 162, 74, 0.35)",
          borderRadius: "16px 16px 16px 6px",
        }
      : {
          background: "rgba(6, 13, 8, 0.85)",
          border: `1px solid ${RF_BORDER}`,
          borderRadius: "16px 16px 16px 6px",
        };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 10,
        alignItems: "flex-start",
        justifyContent: isCliente ? "flex-end" : "flex-start",
      }}
    >
      {!isCliente ? <LeadChatAvatar autor={msg.autor} agentSlug={msg.agentSlug} /> : null}
      <div style={{ maxWidth: "min(88%, 680px)", order: isCliente ? 1 : 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
            flexDirection: isCliente ? "row-reverse" : "row",
          }}
        >
          <LeadChatMessageLabel msg={msg} />
          <span style={{ fontSize: 10, color: "#6e7681" }}>{tempo(msg.criado_em)}</span>
        </div>
        <div
          style={{
            ...bubbleStyle,
            padding: "12px 14px",
            fontSize: 13,
            color: RF_TEXT_PRIMARY,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg.conteudo}
        </div>
      </div>
      {isCliente ? <LeadChatAvatar autor="cliente" /> : null}
    </div>
  );
}

/** Painel de atendimento completo — estilo Copiloto, com envio de mensagens. */
export function LeadChatTab({
  leadId,
  leadNome = "Lead",
  metadata,
  humanoResponsavel,
  agenteResponsavel,
  onHumanoResponsavelChange,
  onAgenteResponsavelChange,
  onMetadataChange,
  notasExternas = [],
  interactive = true,
}: Props) {
  const [filaRaw, setFilaRaw] = useState<Record<string, unknown>[]>([]);
  const [notasApi, setNotasApi] = useState<CrmNota[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sendStrip, setSendStrip] = useState<{ kind: "error" | "info" | "success"; text: string } | null>(
    null
  );
  const [assumindo, setAssumindo] = useState(false);
  const [painelTransferir, setPainelTransferir] = useState<"vendedor" | "agente" | null>(null);
  const [atendenteSelId, setAtendenteSelId] = useState("");
  const [vendedorManual, setVendedorManual] = useState(false);
  const [vendedorTelefone, setVendedorTelefone] = useState("");
  const [vendedorNome, setVendedorNome] = useState("");
  const [atendentes, setAtendentes] = useState<AtendenteCrm[]>([]);
  const [transferindo, setTransferindo] = useState(false);
  const [agentes, setAgentes] = useState<HubAgenteOption[]>([]);
  const [agenteSel, setAgenteSel] = useState(agenteResponsavel ?? "");
  const [sessionActor, setSessionActor] = useState<{ id?: string; email?: string; name?: string }>({});
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void getCrmSessionActor().then((actor) => {
      if (!cancelled) setSessionActor(actor);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void getCrmSessionActor().then((actor) => {
        if (!cancelled) setSessionActor(actor);
      });
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const atendimentoHeaders = useCallback(
    () => crmApiHeadersWithActor(sessionActor),
    [sessionActor]
  );

  const atendimento = useMemo(
    () => parseAtendimentoState(metadata, effectiveHumanoResponsavel(humanoResponsavel)),
    [metadata, humanoResponsavel]
  );
  const assumido = atendimento.modo === "humano";
  const emGrupo = atendimento.modo === "grupo";
  const podeEnviar = assumido && !emGrupo;
  const badgeStyle = badgeTone(atendimento.modo);

  const notasMerged = useMemo(() => {
    const map = new Map<string, CrmNota>();
    for (const n of notasApi) map.set(n.id, n);
    for (const n of notasExternas) map.set(n.id, n);
    return [...map.values()];
  }, [notasApi, notasExternas]);

  const mensagens = useMemo(
    () => mergeMensagens(filaRaw, metadata, notasMerged),
    [filaRaw, metadata, notasMerged]
  );

  const carregar = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!leadId) return;
      if (!opts?.quiet) {
        setLoading(true);
        setErro("");
      }
      try {
        const res = await fetch(
          `/api/crm/atendimento/mensagens?leadId=${encodeURIComponent(leadId)}`,
          { headers: internalApiHeaders() }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!opts?.quiet) {
            setErro(typeof json.error === "string" ? json.error : "Erro ao carregar conversas.");
          }
          setFilaRaw([]);
          setNotasApi([]);
          return;
        }
        setFilaRaw((json.mensagens ?? []) as Record<string, unknown>[]);
        setNotasApi((json.notas ?? []) as CrmNota[]);
      } catch {
        if (!opts?.quiet) setErro("Erro de rede ao carregar conversas.");
        setFilaRaw([]);
        setNotasApi([]);
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [leadId]
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setAgenteSel(agenteResponsavel ?? "");
  }, [agenteResponsavel]);

  useEffect(() => {
    if (!interactive) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/hub/agentes?ativo=true", { headers: internalApiHeaders() });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const list = (Array.isArray(json) ? json : json?.agentes ?? []) as HubAgenteOption[];
        setAgentes(list.filter((a) => a.ativo !== false && !a.arquivado_em));
      } catch {
        /* lista opcional — dropdown fica vazio */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [interactive]);

  useEffect(() => {
    if (!interactive || painelTransferir !== "vendedor") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/crm/atendentes", { headers: internalApiHeaders() });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        setAtendentes((json.atendentes ?? []) as AtendenteCrm[]);
      } catch {
        /* lista opcional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [interactive, painelTransferir]);

  useEffect(() => {
    if (!leadId) return;
    const channel = supabase
      .channel(`lead-chat-${leadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hub_fila_mensagens",
          filter: `lead_id=eq.${leadId}`,
        },
        () => {
          void carregar({ quiet: true });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hub_notas",
          filter: `lead_id=eq.${leadId}`,
        },
        () => {
          void carregar({ quiet: true });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, carregar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando]);

  useEffect(() => {
    if (!sendStrip || sendStrip.kind === "error") return;
    const ms = sendStrip.kind === "info" ? 8000 : 4500;
    const t = window.setTimeout(() => setSendStrip(null), ms);
    return () => window.clearTimeout(t);
  }, [sendStrip]);

  const stats = useMemo(() => {
    let ia = 0;
    let humano = 0;
    let cliente = 0;
    let anotacao = 0;
    for (const m of mensagens) {
      if (m.autor === "ia") ia++;
      else if (m.autor === "humano") humano++;
      else if (m.autor === "anotacao") anotacao++;
      else cliente++;
    }
    return { ia, humano, cliente, anotacao, total: mensagens.length };
  }, [mensagens]);

  async function assumirAtendimento() {
    setAssumindo(true);
    setSendStrip(null);
    try {
      const res = await fetch("/api/crm/atendimento/assumir", {
        method: "POST",
        credentials: "include",
        headers: { ...(await atendimentoHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        humano_responsavel?: string;
        humanoResponsavel?: string;
      };
      if (!res.ok) {
        setSendStrip({
          kind: "error",
          text:
            typeof json.error === "string"
              ? json.error
              : res.status === 404
                ? "API de assumir ainda não disponível."
                : "Não foi possível assumir o atendimento.",
        });
        return;
      }
      const humano =
        typeof json.humano_responsavel === "string"
          ? json.humano_responsavel
          : typeof json.humanoResponsavel === "string"
            ? json.humanoResponsavel
            : "operador";
      onHumanoResponsavelChange?.(humano);
      setSendStrip({ kind: "success", text: "Atendimento assumido." });
    } catch {
      setSendStrip({ kind: "error", text: "Erro de rede ao assumir." });
    } finally {
      setAssumindo(false);
    }
  }

  async function devolverIA() {
    setAssumindo(true);
    setSendStrip(null);
    try {
      const res = await fetch("/api/crm/atendimento/devolver-ia", {
        method: "POST",
        credentials: "include",
        headers: { ...(await atendimentoHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; metadata?: unknown };
      if (!res.ok) {
        setSendStrip({
          kind: "error",
          text:
            typeof json.error === "string"
              ? json.error
              : res.status === 404
                ? "API de devolver à IA ainda não disponível."
                : "Não foi possível devolver à IA.",
        });
        return;
      }
      onHumanoResponsavelChange?.(null);
      if (json.metadata !== undefined) {
        onMetadataChange?.(json.metadata);
      } else if (emGrupo) {
        onMetadataChange?.({ ...metaRecord(metadata), canal_ativo: "direct" });
      }
      setSendStrip({ kind: "success", text: "Conversa devolvida à IA." });
    } catch {
      setSendStrip({ kind: "error", text: "Erro de rede ao devolver à IA." });
    } finally {
      setAssumindo(false);
    }
  }

  async function transferirParaVendedor() {
    const atendente = atendentes.find((a) => a.id === atendenteSelId);
    const tel = vendedorManual ? vendedorTelefone.trim() : "";
    if (!atendenteSelId && !tel) {
      setSendStrip({ kind: "error", text: "Selecione um atendente ou informe o telefone." });
      return;
    }
    setTransferindo(true);
    setSendStrip(null);
    try {
      const body: Record<string, string | undefined> = { leadId };
      if (atendenteSelId && !vendedorManual) {
        body.atendenteId = atendenteSelId;
      } else {
        body.vendedorTelefone = tel;
        body.vendedorNome = vendedorNome.trim() || undefined;
      }
      const res = await fetch("/api/crm/atendimento/transferir-grupo", {
        method: "POST",
        credentials: "include",
        headers: { ...(await atendimentoHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        groupJid?: string;
        groupName?: string;
        humano_responsavel?: string;
        metadata?: unknown;
      };
      if (!res.ok) {
        setSendStrip({
          kind: "error",
          text:
            typeof json.error === "string"
              ? json.error
              : res.status === 404
                ? "API de transferência para grupo ainda não disponível."
                : "Não foi possível transferir para o vendedor.",
        });
        return;
      }
      if (json.metadata !== undefined) {
        onMetadataChange?.(json.metadata);
      } else if (json.groupJid) {
        onMetadataChange?.({
          ...metaRecord(metadata),
          canal_ativo: "group",
          whatsapp_group_jid: json.groupJid,
          transferido_em: new Date().toISOString(),
          vendedor_telefone: atendente?.telefone || vendedorTelefone.trim(),
          vendedor_nome: atendente?.nome || vendedorNome.trim() || undefined,
          ...(atendenteSelId ? { atendente_id: atendenteSelId } : {}),
        });
      }
      if (typeof json.humano_responsavel === "string") {
        onHumanoResponsavelChange?.(json.humano_responsavel);
      } else if (atendente?.slug) {
        onHumanoResponsavelChange?.(atendente.slug);
      }
      setPainelTransferir(null);
      setAtendenteSelId("");
      setVendedorManual(false);
      setVendedorTelefone("");
      setVendedorNome("");
      setSendStrip({
        kind: "success",
        text: json.groupName
          ? `Grupo WhatsApp criado: ${json.groupName}`
          : "Lead transferido para grupo WhatsApp com o vendedor.",
      });
      await carregar({ quiet: true });
    } catch {
      setSendStrip({ kind: "error", text: "Erro de rede ao transferir." });
    } finally {
      setTransferindo(false);
    }
  }

  async function transferirAgente() {
    const slug = agenteSel.trim();
    if (!slug) {
      setSendStrip({ kind: "error", text: "Selecione um agente IA." });
      return;
    }
    setTransferindo(true);
    setSendStrip(null);
    try {
      const res = await patchLeadCrm(leadId, { agente_responsavel: slug });
      if (!res.ok) {
        setSendStrip({ kind: "error", text: res.error });
        return;
      }
      onAgenteResponsavelChange?.(slug);
      setPainelTransferir(null);
      setSendStrip({ kind: "success", text: "Agente IA atualizado." });
    } catch {
      setSendStrip({ kind: "error", text: "Erro de rede ao transferir agente." });
    } finally {
      setTransferindo(false);
    }
  }

  async function enviarMensagem() {
    const texto = input.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    setSendStrip(null);
    setInput("");
    try {
      const res = await fetch("/api/crm/atendimento/send", {
        method: "POST",
        credentials: "include",
        headers: { ...(await atendimentoHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, texto }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        whatsappSkipped?: boolean;
      };
      if (!res.ok) {
        setInput(texto);
        setSendStrip({
          kind: "error",
          text:
            typeof json.error === "string"
              ? json.error
              : "Não foi possível enviar a mensagem.",
        });
        return;
      }
      if (json.whatsappSkipped) {
        setSendStrip({
          kind: "info",
          text: "Mensagem registada no CRM. WhatsApp em dry-run ou provedor não configurado.",
        });
      } else {
        setSendStrip({ kind: "success", text: "Mensagem enviada." });
      }
      await carregar({ quiet: true });
    } catch {
      setInput(texto);
      setSendStrip({ kind: "error", text: "Erro de rede ao enviar." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 pb-3">
        <p
          className="m-0 text-[10px] font-bold uppercase tracking-[0.08em]"
          style={{ color: RF_TEXT_MUTED }}
        >
          Atendimento
        </p>
        <p className="m-0 mt-0.5 truncate text-sm font-bold" style={{ color: RF_TEXT_PRIMARY }}>
          {leadNome}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
            style={{
              background: badgeStyle.bg,
              borderColor: badgeStyle.border,
              color: badgeStyle.color,
            }}
          >
            {atendimento.badgeLabel}
          </span>
          {agenteResponsavel ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: RF_TEXT_MUTED }}>
              Agente · {agenteResponsavel}
            </span>
          ) : null}
        </div>

        {interactive ? (
          <div className="mt-3">
            <CrmSideoverToolbarRow>
              <CrmSideoverActionGroup>
                {assumido || emGrupo ? (
                  <CrmSideoverActionBtn
                    onClick={() => void devolverIA()}
                    title="Devolver conversa para a IA"
                    disabled={assumindo || transferindo}
                  >
                    {assumindo ? "A devolver…" : "Devolver à IA"}
                  </CrmSideoverActionBtn>
                ) : (
                  <CrmSideoverActionBtn
                    active
                    onClick={() => void assumirAtendimento()}
                    title="Assumir atendimento humano (chat direto)"
                    disabled={assumindo || transferindo}
                  >
                    {assumindo ? "A assumir…" : "Assumir"}
                  </CrmSideoverActionBtn>
                )}
                <CrmSideoverActionBtn
                  active={painelTransferir === "vendedor"}
                  onClick={() =>
                    setPainelTransferir((p) => (p === "vendedor" ? null : "vendedor"))
                  }
                  title="Criar grupo WhatsApp com lead e vendedor"
                  disabled={emGrupo || assumindo || transferindo}
                >
                  <Users size={14} />
                  Transferir para vendedor
                </CrmSideoverActionBtn>
                <CrmSideoverActionBtn
                  active={painelTransferir === "agente"}
                  onClick={() => setPainelTransferir((p) => (p === "agente" ? null : "agente"))}
                  title="Alterar agente IA responsável pelo lead"
                  disabled={assumindo || transferindo}
                >
                  <Bot size={14} />
                  Transferir agente IA
                </CrmSideoverActionBtn>
              </CrmSideoverActionGroup>
            </CrmSideoverToolbarRow>
          </div>
        ) : null}

        {interactive && painelTransferir === "vendedor" ? (
          <CrmSideoverInlinePanel title="Transferir para vendedor (grupo WhatsApp)">
            <p className="mb-3 text-xs leading-relaxed" style={{ color: RF_TEXT_MUTED }}>
              Cria um grupo no WhatsApp com o lead e o atendente cadastrado. Cadastre a equipe em CRM →
              Atendimento → Equipe.
            </p>
            <div className="space-y-3">
              <div>
                <label className={CRM_SIDEOVER_LABEL}>Atendente / vendedor *</label>
                <select
                  className={CRM_SIDEOVER_INPUT}
                  style={CRM_SIDEOVER_INPUT_STYLE}
                  value={vendedorManual ? "__manual__" : atendenteSelId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__manual__") {
                      setVendedorManual(true);
                      setAtendenteSelId("");
                      return;
                    }
                    setVendedorManual(false);
                    setAtendenteSelId(v);
                    const a = atendentes.find((x) => x.id === v);
                    if (a) {
                      setVendedorTelefone(a.telefone);
                      setVendedorNome(a.nome);
                    }
                  }}
                >
                  <option value="">— Selecione —</option>
                  {atendentes
                    .filter((a) => a.ativo)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome} · {a.telefone}
                        {a.cargo ? ` (${a.cargo})` : ""}
                      </option>
                    ))}
                  <option value="__manual__">Outro número (manual)…</option>
                </select>
                {atendentes.length === 0 ? (
                  <p className="mt-1 text-[10px]" style={{ color: RF_TEXT_MUTED }}>
                    Nenhum atendente cadastrado — use manual ou cadastre em Equipe (menu Atendimento).
                  </p>
                ) : null}
              </div>
              {vendedorManual ? (
                <>
                  <div>
                    <label className={CRM_SIDEOVER_LABEL}>Telefone *</label>
                    <input
                      className={CRM_SIDEOVER_INPUT}
                      style={CRM_SIDEOVER_INPUT_STYLE}
                      value={vendedorTelefone}
                      onChange={(e) => setVendedorTelefone(e.target.value)}
                      placeholder="5511999999999"
                    />
                  </div>
                  <div>
                    <label className={CRM_SIDEOVER_LABEL}>Nome</label>
                    <input
                      className={CRM_SIDEOVER_INPUT}
                      style={CRM_SIDEOVER_INPUT_STYLE}
                      value={vendedorNome}
                      onChange={(e) => setVendedorNome(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </>
              ) : null}
              <CrmSideoverActionGroup>
                <CrmSideoverActionBtn
                  onClick={() => {
                    setPainelTransferir(null);
                    setAtendenteSelId("");
                    setVendedorManual(false);
                    setVendedorTelefone("");
                    setVendedorNome("");
                  }}
                  disabled={transferindo}
                >
                  Cancelar
                </CrmSideoverActionBtn>
                <CrmSideoverActionBtn
                  active
                  onClick={() => void transferirParaVendedor()}
                  disabled={
                    transferindo ||
                    (!atendenteSelId && !(vendedorManual && vendedorTelefone.trim()))
                  }
                >
                  {transferindo ? "A transferir…" : "Criar grupo"}
                </CrmSideoverActionBtn>
              </CrmSideoverActionGroup>
            </div>
          </CrmSideoverInlinePanel>
        ) : null}

        {interactive && painelTransferir === "agente" ? (
          <CrmSideoverInlinePanel title="Transferir agente IA">
            <p className="mb-3 text-xs leading-relaxed" style={{ color: RF_TEXT_MUTED }}>
              Próximas mensagens do lead serão tratadas pelo agente selecionado (quando a IA estiver
              ativa).
            </p>
            <div className="space-y-3">
              <div>
                <label className={CRM_SIDEOVER_LABEL}>Agente IA</label>
                <select
                  className={CRM_SIDEOVER_INPUT}
                  style={CRM_SIDEOVER_INPUT_STYLE}
                  value={agenteSel}
                  onChange={(e) => setAgenteSel(e.target.value)}
                >
                  <option value="">— Selecione —</option>
                  {agentes.map((a) => (
                    <option key={a.agente_slug} value={a.agente_slug}>
                      {a.nome} ({a.agente_slug})
                    </option>
                  ))}
                </select>
                {agentes.length === 0 ? (
                  <p className="mt-1 text-[10px]" style={{ color: RF_TEXT_MUTED }}>
                    Nenhum agente ativo carregado.
                  </p>
                ) : null}
              </div>
              <CrmSideoverActionGroup>
                <CrmSideoverActionBtn
                  onClick={() => setPainelTransferir(null)}
                  disabled={transferindo}
                >
                  Cancelar
                </CrmSideoverActionBtn>
                <CrmSideoverActionBtn
                  active
                  onClick={() => void transferirAgente()}
                  disabled={transferindo || !agenteSel.trim()}
                >
                  {transferindo ? "A guardar…" : "Confirmar"}
                </CrmSideoverActionBtn>
              </CrmSideoverActionGroup>
            </div>
          </CrmSideoverInlinePanel>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span style={{ fontSize: 10, fontWeight: 700, color: RF_ACCENT }}>
            {stats.total} mensagens
          </span>
          {stats.cliente > 0 ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: RF_TEXT_MUTED }}>Lead {stats.cliente}</span>
          ) : null}
          {stats.ia > 0 ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: RF_TEXT_MUTED }}>IA {stats.ia}</span>
          ) : null}
          {stats.humano > 0 ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: RF_TEXT_MUTED }}>
              Humano {stats.humano}
            </span>
          ) : null}
          {stats.anotacao > 0 ? (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#c4b5fd" }}>
              Anotações {stats.anotacao}
            </span>
          ) : null}
        </div>

        {interactive && emGrupo ? (
          <p className="m-0 mt-2 text-[11px] leading-relaxed" style={{ color: RF_TEXT_MUTED }}>
            Atendimento no grupo WhatsApp. Responda pelo app WhatsApp — mensagens do grupo aparecem
            aqui no histórico.
          </p>
        ) : interactive && !assumido ? (
          <p className="m-0 mt-2 text-[11px] leading-relaxed" style={{ color: RF_TEXT_MUTED }}>
            Assuma o atendimento para enviar mensagens ao lead via WhatsApp (chat direto).
          </p>
        ) : null}
      </div>

      {erro ? (
        <p className="mb-2 shrink-0 text-xs text-[#f85149]" role="alert">
          {erro}
        </p>
      ) : null}

      {sendStrip ? (
        <p
          className="mb-2 shrink-0 text-xs"
          style={{
            color:
              sendStrip.kind === "error"
                ? "#f85149"
                : sendStrip.kind === "info"
                  ? "#79c0ff"
                  : RF_ACCENT,
          }}
          role="alert"
        >
          {sendStrip.text}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <p style={{ color: RF_TEXT_MUTED, fontSize: 13, textAlign: "center", padding: "24px 0" }}>
            A carregar conversas…
          </p>
        ) : mensagens.length === 0 ? (
          <p style={{ color: RF_TEXT_SECONDARY, fontSize: 13, lineHeight: 1.55, margin: 0, maxWidth: 640 }}>
            Ainda não há mensagens registadas para este lead. O histórico de{" "}
            <strong style={{ color: "#aebccf" }}>WhatsApp, IA e atendimento humano</strong> aparecerá
            aqui quando existir conversa. Assuma o atendimento para responder pelo sistema.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {mensagens.map((msg) => (
              <LeadChatBubble key={msg.id} msg={msg} />
            ))}
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {interactive ? (
        <div
          className="shrink-0 pt-3"
          style={{ borderTop: `1px solid ${RF_BORDER}`, marginTop: 12 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 10,
              background: "rgba(6, 13, 8, 0.85)",
              border: `1px solid ${RF_BORDER_STRONG}`,
              borderRadius: 14,
              padding: "8px 10px 8px 14px",
              opacity: podeEnviar ? 1 : 0.55,
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                emGrupo
                  ? "Conversa no grupo WhatsApp — use o app para responder…"
                  : assumido
                    ? "Mensagem para o lead (WhatsApp)…"
                    : "Assuma o atendimento para enviar mensagens…"
              }
              rows={2}
              disabled={enviando || !podeEnviar}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviarMensagem();
                }
              }}
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 120,
                resize: "none",
                border: "none",
                background: "transparent",
                color: RF_TEXT_PRIMARY,
                fontSize: 13,
                lineHeight: 1.45,
                outline: "none",
              }}
            />
            <button
              type="button"
              disabled={enviando || !input.trim() || !podeEnviar}
              onClick={() => void enviarMensagem()}
              aria-label="Enviar mensagem"
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "none",
                background:
                  enviando || !input.trim() || !podeEnviar
                    ? "#dcebd8"
                    : "linear-gradient(145deg, #003b26, #14532d)",
                color: "#c9a24a",
                cursor: enviando || !input.trim() || !podeEnviar ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Send size={20} />
            </button>
          </div>
          <p style={{ fontSize: 10, color: "#484f58", margin: "8px 0 0", textAlign: "center" }}>
            Enter envia · Shift+Enter nova linha · mensagens vão para WhatsApp quando configurado
          </p>
        </div>
      ) : null}
    </div>
  );
}
