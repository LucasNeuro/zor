"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Bot, Send, StickyNote, User, UserRound } from "lucide-react";
import { ChatMensagemMidia } from "@/components/crm/leads/ChatMensagemMidia";
import { CrmBotRingAvatar } from "@/components/crm/CrmBotRingAvatar";
import type { CrmNota } from "@/components/crm/leads/LeadObservacoesTab";
import {
  conteudoEhPlaceholderMidia,
  parseMidiaFromRow,
  type TipoMidiaChat,
} from "@/lib/crm/chat-mensagem-midia";
import { textoExibicaoMensagemHumano } from "@/lib/crm/mensagem-consultor-whatsapp";
import {
  effectiveHumanoResponsavel,
  formatHumanoDisplayName,
} from "@/lib/crm/resolve-crm-actor";
import { crmApiHeadersWithActor, getCrmSessionActor } from "@/lib/internal-api-headers-client";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { parseConversaTurnos } from "@/lib/crm/lead-timeline";
import { supabase } from "@/lib/supabase/client";
import {
  RF_ACCENT,
  RF_LIGHT_BG,
  RF_LIGHT_BORDER,
  RF_LIGHT_BORDER_STRONG,
} from "@/lib/crm/crm-retrofit-dark-theme";

type AutorTipo = "cliente" | "ia" | "humano" | "anotacao";

type ChatMsg = {
  id: string;
  conteudo: string;
  autor: AutorTipo;
  autorLabel: string;
  agentSlug?: string;
  criado_em: string;
  tipoMidia: TipoMidiaChat;
  urlMidia?: string | null;
  nomeArquivo?: string | null;
  whatsappMessageId?: string | null;
};

type AtendimentoModo = "ia" | "humano" | "grupo";

type Props = {
  leadId: string;
  leadNome?: string;
  metadata?: unknown;
  humanoResponsavel?: string | null;
  agenteResponsavel?: string | null;
  onHumanoResponsavelChange?: (valor: string | null) => void;
  onMetadataChange?: (metadata: unknown) => void;
  notasExternas?: CrmNota[];
  interactive?: boolean;
};

const CHAT = {
  bg: RF_LIGHT_BG,
  panel: "#ffffff",
  border: RF_LIGHT_BORDER,
  borderStrong: RF_LIGHT_BORDER_STRONG,
  text: "#111827",
  textStrong: "#030712",
  muted: "#6b7280",
  secondary: "#374151",
  accent: RF_ACCENT,
  humano: "#b45309",
  humanoBg: "#fffbeb",
  humanoBorder: "#fcd34d",
  ia: "#15803d",
  iaBg: "#f0fdf4",
  iaBorder: "#86efac",
  cliente: "#1d4ed8",
  clienteBg: "#eff6ff",
  clienteBorder: "#93c5fd",
  nota: "#7c3aed",
  notaBg: "#f5f3ff",
};

const AVATAR_SIZE = 36;

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
  if (modo === "grupo") return { bg: CHAT.clienteBg, border: CHAT.clienteBorder, color: CHAT.cliente };
  if (modo === "humano") return { bg: CHAT.humanoBg, border: CHAT.humanoBorder, color: CHAT.humano };
  return { bg: CHAT.iaBg, border: CHAT.iaBorder, color: CHAT.ia };
}

function tempo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function renderTextoMensagem(texto: string) {
  const parts = texto.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: CHAT.textStrong }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function autorFromMensagem(row: Record<string, unknown>): {
  autor: AutorTipo;
  label: string;
  agentSlug?: string;
} {
  const direcao = String(row.direcao ?? "");
  if (direcao === "entrada") return { autor: "cliente", label: "Lead" };

  const agenteId = String(row.agente_id ?? row.agente_responsavel ?? "").trim();
  const agenteLower = agenteId.toLowerCase();
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const remetente = String(row.remetente ?? "").toLowerCase();
  const feitoPorTipo = String(row.feito_por_tipo ?? meta.feito_por_tipo ?? "").toLowerCase();
  const feitoPor = String(meta.feito_por ?? "").trim();

  if (feitoPorTipo === "humano" || remetente === "humano" || agenteLower.includes("humano")) {
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

function rowParaChatMsg(row: Record<string, unknown>): ChatMsg | null {
  const meta =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : row.metadados && typeof row.metadados === "object" && !Array.isArray(row.metadados)
        ? (row.metadados as Record<string, unknown>)
        : {};
  const conteudoBruto = String(row.conteudo ?? "");
  const conteudo = textoExibicaoMensagemHumano(conteudoBruto, meta);
  const midiaApi = {
    tipo_conteudo: row.tipo_conteudo,
    url_midia: row.url_midia,
    nome_arquivo: row.nome_arquivo,
    whatsapp_message_id: row.whatsapp_message_id,
    tipo_midia: row.tipo_midia,
    metadata: row.metadata,
  };
  const midia = parseMidiaFromRow(midiaApi);
  if (!conteudo.trim() && midia.tipo === "texto") return null;

  const { autor, label, agentSlug } = autorFromMensagem(row);
  const criado = String(row.criado_em ?? row.enviada_em ?? new Date().toISOString());
  const id = String(row.id ?? `msg-${criado}-${conteudo.slice(0, 8)}`);

  return {
    id,
    conteudo,
    autor,
    autorLabel: label,
    agentSlug,
    criado_em: criado,
    tipoMidia: midia.tipo,
    urlMidia: midia.urlMidia,
    nomeArquivo: midia.nomeArquivo,
    whatsappMessageId: midia.whatsappMessageId,
  };
}

function notasParaMensagens(notas: CrmNota[]): ChatMsg[] {
  return notas.map((n) => ({
    id: `nota-${n.id}`,
    conteudo: n.conteudo,
    autor: "anotacao" as const,
    autorLabel: n.criado_por || "Equipe",
    criado_em: n.criado_em,
    tipoMidia: "texto" as const,
  }));
}

function mergeMensagens(
  fila: Record<string, unknown>[],
  metadata: unknown,
  notas: CrmNota[] = []
): ChatMsg[] {
  const map = new Map<string, ChatMsg>();

  for (const row of fila) {
    const msg = rowParaChatMsg(row);
    if (msg) map.set(msg.id, msg);
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
      tipoMidia: "texto",
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
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          background: CHAT.notaBg,
          border: `1px solid ${CHAT.nota}55`,
        }}
      >
        <StickyNote size={17} color={CHAT.nota} strokeWidth={2} aria-hidden />
      </div>
    );
  }
  if (autor === "cliente") {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          background: CHAT.clienteBg,
          border: `1px solid ${CHAT.clienteBorder}`,
        }}
      >
        <UserRound size={18} color={CHAT.cliente} strokeWidth={2} aria-hidden />
      </div>
    );
  }
  if (autor === "humano") {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          background: CHAT.humanoBg,
          border: `1px solid ${CHAT.humanoBorder}`,
        }}
      >
        <User size={18} color={CHAT.humano} strokeWidth={2} aria-hidden />
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
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        background: CHAT.iaBg,
        border: `1px solid ${CHAT.iaBorder}`,
      }}
    >
      <Bot size={20} color={CHAT.ia} strokeWidth={2} aria-hidden />
    </div>
  );
}

function LeadChatMessageLabel({ msg }: { msg: ChatMsg }) {
  if (msg.autor === "anotacao") {
    return (
      <span className="text-[11px] font-bold" style={{ color: CHAT.nota }}>
        Anotação interna · {msg.autorLabel}
      </span>
    );
  }
  if (msg.autor === "cliente") {
    return (
      <span className="text-[11px] font-bold" style={{ color: CHAT.cliente }}>
        {msg.autorLabel}
      </span>
    );
  }
  if (msg.autor === "humano") {
    return (
      <span className="text-[11px] font-bold" style={{ color: CHAT.humano }}>
        {msg.autorLabel}
      </span>
    );
  }
  const parts = msg.autorLabel.split(" · ");
  if (parts.length >= 2) {
    return (
      <span className="text-[11px] font-bold" style={{ color: CHAT.ia }}>
        {parts[0]}{" "}
        <span style={{ fontWeight: 600, color: CHAT.secondary }}>· {parts.slice(1).join(" · ")}</span>
      </span>
    );
  }
  return (
    <span className="text-[11px] font-bold" style={{ color: CHAT.ia }}>
      {msg.autorLabel}
    </span>
  );
}

function LeadChatBubble({ msg, leadId }: { msg: ChatMsg; leadId: string }) {
  const temaMidia = {
    text: CHAT.text,
    muted: CHAT.muted,
    border: CHAT.border,
    surface: CHAT.bg,
    accent: CHAT.accent,
  };

  if (msg.autor === "anotacao") {
    return (
      <div className="flex justify-center py-0.5">
        <div className="w-full max-w-[560px]">
          <div className="mb-1.5 flex items-center justify-center gap-2">
            <LeadChatAvatar autor="anotacao" />
            <LeadChatMessageLabel msg={msg} />
            <span className="text-[10px]" style={{ color: CHAT.muted }}>
              {tempo(msg.criado_em)}
            </span>
          </div>
          <div
            className="rounded-xl px-3.5 py-3 text-center text-[14px] font-medium leading-relaxed"
            style={{
              background: CHAT.notaBg,
              border: `1px dashed ${CHAT.nota}66`,
              color: CHAT.textStrong,
            }}
          >
            {msg.conteudo}
          </div>
          <p className="mt-1.5 text-center text-[10px] font-semibold" style={{ color: CHAT.muted }}>
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
        background: CHAT.clienteBg,
        border: `1px solid ${CHAT.clienteBorder}`,
        borderRadius: "16px 16px 6px 16px",
      }
    : isHumano
      ? {
          background: CHAT.humanoBg,
          border: `1px solid ${CHAT.humanoBorder}`,
          borderRadius: "16px 16px 16px 6px",
        }
      : {
          background: CHAT.panel,
          border: `1px solid ${CHAT.border}`,
          borderRadius: "16px 16px 16px 6px",
        };

  const mostrarTextoPuro =
    msg.tipoMidia === "texto" ||
    (msg.conteudo.trim() && !conteudoEhPlaceholderMidia(msg.conteudo, msg.tipoMidia));

  return (
    <div
      className="flex items-start gap-2.5"
      style={{ flexDirection: "row", justifyContent: isCliente ? "flex-end" : "flex-start" }}
    >
      {!isCliente ? <LeadChatAvatar autor={msg.autor} agentSlug={msg.agentSlug} /> : null}
      <div className="max-w-[min(88%,680px)]" style={{ order: isCliente ? 1 : 0 }}>
        <div
          className="mb-1.5 flex items-center gap-2"
          style={{ flexDirection: isCliente ? "row-reverse" : "row" }}
        >
          <LeadChatMessageLabel msg={msg} />
          <span className="text-[10px]" style={{ color: CHAT.muted }}>
            {tempo(msg.criado_em)}
          </span>
        </div>
        <div
          className="px-3.5 py-3 text-[13px] leading-relaxed"
          style={{ ...bubbleStyle, color: CHAT.text }}
        >
          {msg.tipoMidia !== "texto" ? (
            <ChatMensagemMidia
              leadId={leadId}
              conteudo={msg.conteudo}
              tipoMidia={msg.tipoMidia}
              urlMidia={msg.urlMidia}
              nomeArquivo={msg.nomeArquivo}
              whatsappMessageId={msg.whatsappMessageId}
              tema={temaMidia}
            />
          ) : mostrarTextoPuro ? (
            <span
              style={{
                whiteSpace: "pre-wrap",
                color: CHAT.textStrong,
                fontWeight: 500,
                fontSize: 14,
                lineHeight: 1.55,
              }}
            >
              {renderTextoMensagem(msg.conteudo)}
            </span>
          ) : null}
        </div>
      </div>
      {isCliente ? <LeadChatAvatar autor="cliente" /> : null}
    </div>
  );
}

function ChatActionBtn({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        borderColor: active ? CHAT.accent : CHAT.borderStrong,
        background: active ? CHAT.accent : CHAT.panel,
        color: active ? "#0b2210" : CHAT.text,
      }}
    >
      {children}
    </button>
  );
}

/** Painel de atendimento humano — tema claro, áudio/arquivos, sem transferências. */
export function LeadChatTab({
  leadId,
  leadNome = "Lead",
  metadata,
  humanoResponsavel,
  agenteResponsavel,
  onHumanoResponsavelChange,
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
  const [humanoAtivoLocal, setHumanoAtivoLocal] = useState<string | null>(null);
  const [sessionActor, setSessionActor] = useState<{ id?: string; email?: string; name?: string }>({});
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const humanoEfetivo =
    humanoAtivoLocal ?? effectiveHumanoResponsavel(humanoResponsavel);

  useEffect(() => {
    setHumanoAtivoLocal(effectiveHumanoResponsavel(humanoResponsavel));
  }, [humanoResponsavel, leadId]);

  useEffect(() => {
    let cancelled = false;
    void getCrmSessionActor().then((actor) => {
      if (!cancelled) setSessionActor(actor);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
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
    () => parseAtendimentoState(metadata, humanoEfetivo),
    [metadata, humanoEfetivo]
  );
  const assumido = atendimento.modo === "humano";
  const podeEnviar = assumido;
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
          `/api/crm/atendimento/mensagens?canal=whatsapp&leadId=${encodeURIComponent(leadId)}`,
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
    if (!leadId) return;
    const channel = supabase
      .channel(`lead-chat-${leadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hub_fila_mensagens", filter: `lead_id=eq.${leadId}` },
        () => void carregar({ quiet: true })
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hub_mensagens", filter: `lead_id=eq.${leadId}` },
        () => void carregar({ quiet: true })
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hub_notas", filter: `lead_id=eq.${leadId}` },
        () => void carregar({ quiet: true })
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
      };
      if (!res.ok) {
        setSendStrip({
          kind: "error",
          text: typeof json.error === "string" ? json.error : "Não foi possível assumir o atendimento.",
        });
        return;
      }
      const humano =
        typeof json.humano_responsavel === "string" ? json.humano_responsavel : "operador";
      setHumanoAtivoLocal(humano);
      onHumanoResponsavelChange?.(humano);
      onMetadataChange?.({
        ...metaRecord(metadata),
        fase_atendimento: "atendimento_humano",
        humano_assumiu_em: new Date().toISOString(),
        humano_assumiu_via: "crm_assumir",
      });
      setSendStrip({ kind: "success", text: "Atendimento assumido. Pode enviar mensagens ao lead." });
      window.setTimeout(() => inputRef.current?.focus(), 0);
      await carregar({ quiet: true });
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
          text: typeof json.error === "string" ? json.error : "Não foi possível devolver à IA.",
        });
        return;
      }
      onHumanoResponsavelChange?.(null);
      setHumanoAtivoLocal(null);
      if (json.metadata !== undefined) onMetadataChange?.(json.metadata);
      setSendStrip({ kind: "success", text: "Conversa devolvida à IA." });
    } catch {
      setSendStrip({ kind: "error", text: "Erro de rede ao devolver à IA." });
    } finally {
      setAssumindo(false);
    }
  }

  async function enviarMensagem() {
    const texto = input.trim();
    if (!texto || enviando) return;
    if (!podeEnviar) {
      setSendStrip({
        kind: "error",
        text: "Clique em «Assumir atendimento» para enviar mensagens como humano.",
      });
      return;
    }
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
          text: typeof json.error === "string" ? json.error : "Não foi possível enviar a mensagem.",
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
    <div
      className="flex h-full min-h-0 flex-col rounded-xl border p-4"
      style={{ background: CHAT.bg, borderColor: CHAT.border }}
    >
      <div className="shrink-0 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <span
              className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{ color: CHAT.muted }}
            >
              Atendimento
            </span>
            <span
              className="h-3 w-px shrink-0"
              style={{ background: CHAT.borderStrong }}
              aria-hidden
            />
            <p
              className="m-0 min-w-0 truncate text-sm font-bold"
              style={{ color: CHAT.text }}
              title={leadNome}
            >
              {leadNome}
            </p>
            <span
              className="inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
              style={{
                background: badgeStyle.bg,
                borderColor: badgeStyle.border,
                color: badgeStyle.color,
              }}
            >
              {atendimento.badgeLabel}
            </span>
            {agenteResponsavel ? (
              <span
                className="hidden shrink-0 truncate text-[10px] font-bold sm:inline"
                style={{ color: CHAT.muted }}
                title={`Agente · ${agenteResponsavel}`}
              >
                Agente · {agenteResponsavel}
              </span>
            ) : null}
            <span
              className="h-3 w-px shrink-0"
              style={{ background: CHAT.borderStrong }}
              aria-hidden
            />
            <span className="shrink-0 text-[10px] font-bold" style={{ color: CHAT.accent }}>
              {stats.total} mensagens
            </span>
            {stats.cliente > 0 ? (
              <span className="hidden shrink-0 text-[10px] font-bold md:inline" style={{ color: CHAT.muted }}>
                Lead {stats.cliente}
              </span>
            ) : null}
            {stats.ia > 0 ? (
              <span className="hidden shrink-0 text-[10px] font-bold md:inline" style={{ color: CHAT.muted }}>
                IA {stats.ia}
              </span>
            ) : null}
            {stats.humano > 0 ? (
              <span className="hidden shrink-0 text-[10px] font-bold md:inline" style={{ color: CHAT.muted }}>
                Humano {stats.humano}
              </span>
            ) : null}
          </div>

          {interactive ? (
            <div className="shrink-0">
              {assumido ? (
                <ChatActionBtn
                  onClick={() => void devolverIA()}
                  title="Devolver conversa para a IA"
                  disabled={assumindo}
                >
                  {assumindo ? "A devolver…" : "Devolver à IA"}
                </ChatActionBtn>
              ) : (
                <ChatActionBtn
                  active
                  onClick={() => void assumirAtendimento()}
                  title="Assumir atendimento humano para enviar mensagens via WhatsApp"
                  disabled={assumindo}
                >
                  {assumindo ? "A assumir…" : "Assumir atendimento"}
                </ChatActionBtn>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {erro ? (
        <p className="mb-2 shrink-0 text-xs text-[#b42318]" role="alert">
          {erro}
        </p>
      ) : null}

      {sendStrip ? (
        <p
          className="mb-2 shrink-0 text-xs"
          style={{
            color:
              sendStrip.kind === "error"
                ? "#b42318"
                : sendStrip.kind === "info"
                  ? CHAT.cliente
                  : CHAT.ia,
          }}
          role="alert"
        >
          {sendStrip.text}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-white p-3" style={{ borderColor: CHAT.border }}>
        {loading ? (
          <p className="py-6 text-center text-[13px]" style={{ color: CHAT.muted }}>
            A carregar conversas…
          </p>
        ) : mensagens.length === 0 ? (
          <p className="m-0 max-w-[640px] text-[13px] leading-relaxed" style={{ color: CHAT.secondary }}>
            Ainda não há mensagens registadas. O histórico de WhatsApp, IA e atendimento humano
            aparecerá aqui. Áudios e arquivos podem ser reproduzidos ou baixados neste painel.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {mensagens.map((msg) => (
              <LeadChatBubble key={msg.id} msg={msg} leadId={leadId} />
            ))}
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {interactive ? (
        <div className="shrink-0 pt-3" style={{ borderTop: `1px solid ${CHAT.border}`, marginTop: 12 }}>
          <div
            className="flex items-end gap-2.5 rounded-xl border px-3 py-2"
            style={{
              borderColor: assumido ? "#86efac" : CHAT.borderStrong,
              background: assumido ? "#ffffff" : "#f9fafb",
              boxShadow: assumido ? "0 0 0 1px rgba(34, 197, 94, 0.2)" : undefined,
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                assumido
                  ? "Escreva a mensagem — será enviada com tag Consultor + nome do negócio"
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
              className="min-h-11 max-h-[120px] flex-1 resize-none border-0 bg-transparent text-[14px] font-medium leading-snug outline-none disabled:cursor-not-allowed"
              style={{
                color: assumido ? CHAT.textStrong : CHAT.muted,
              }}
            />
            <button
              type="button"
              disabled={enviando || !input.trim() || !podeEnviar}
              onClick={() => void enviarMensagem()}
              aria-label="Enviar mensagem"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 disabled:cursor-not-allowed"
              style={{
                background: enviando || !input.trim() || !podeEnviar ? CHAT.border : CHAT.accent,
                color: "#0b2210",
              }}
            >
              <Send size={20} />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px]" style={{ color: CHAT.muted }}>
            {assumido
              ? "Enter envia · a tag *[Consultor seu nome — negócio]* é acrescentada automaticamente"
              : "Enter envia · Shift+Enter nova linha"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
