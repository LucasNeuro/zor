/** Tipos e merge da linha do tempo / audit trail de leads. */

export type LeadTimelineCategory =
  | "estagio"
  | "transferencia"
  | "conversa_ia"
  | "conversa_humano"
  | "sistema"
  | "outro";

export type LeadTimelineEvent = {
  id: string;
  categoria: LeadTimelineCategory;
  tipo: string;
  titulo: string;
  descricao: string;
  autor: string;
  autorTipo: "ia" | "humano" | "sistema" | "cliente";
  criado_em: string;
  fonte: "hub_atividades" | "hub_fila_mensagens" | "hub_logs" | "hub_encaminhamentos" | "metadata_conversa";
};

export const LEAD_TIMELINE_CATEGORY_LABELS: Record<LeadTimelineCategory, string> = {
  estagio: "Mudanças de estágio",
  transferencia: "Transferências",
  conversa_ia: "Conversa IA",
  conversa_humano: "Conversa humana",
  sistema: "Sistema",
  outro: "Outros",
};

const ESTAGIO_TIPOS = new Set(["status_change", "estagio_alterado", "estagio"]);
const TRANSFER_TIPOS = new Set([
  "encaminhamento",
  "transferencia",
  "transfer",
  "agente_alterado",
  "handoff",
  "encaminhar",
]);
const IA_TIPOS = new Set(["ia_acao", "resposta_ia", "mensagem_saida"]);
const HUMANO_TIPOS = new Set(["mensagem", "ligacao", "email", "reuniao", "nota", "follow_up", "mensagem_entrada"]);
const SISTEMA_TIPOS = new Set(["proposta", "sistema", "criacao", "conversao"]);

export function categorizarEventoLead(
  tipo: string,
  autorTipo: LeadTimelineEvent["autorTipo"],
  fonte?: LeadTimelineEvent["fonte"]
): LeadTimelineCategory {
  const t = tipo.toLowerCase().replace(/\s+/g, "_");

  if (ESTAGIO_TIPOS.has(t) || t.includes("estagio") || t.includes("status")) return "estagio";
  if (TRANSFER_TIPOS.has(t) || t.includes("encaminh") || t.includes("transfer")) return "transferencia";
  if (fonte === "hub_logs" || fonte === "hub_encaminhamentos") {
    if (t.includes("estagio")) return "estagio";
    if (t.includes("encaminh") || t.includes("transfer") || t.includes("agente")) return "transferencia";
    return "sistema";
  }
  if (autorTipo === "ia" || IA_TIPOS.has(t)) return "conversa_ia";
  if (autorTipo === "cliente" || (autorTipo === "humano" && HUMANO_TIPOS.has(t))) return "conversa_humano";
  if (autorTipo === "sistema" || SISTEMA_TIPOS.has(t)) return "sistema";
  return "outro";
}

function tituloPorCategoria(cat: LeadTimelineCategory, tipo: string): string {
  if (cat === "estagio") return "Mudança de estágio";
  if (cat === "transferencia") return "Transferência";
  if (cat === "conversa_ia") return tipo === "ia_acao" ? "Ação da IA" : "Mensagem IA";
  if (cat === "conversa_humano") return "Interação humana";
  if (cat === "sistema") return "Evento do sistema";
  return tipo.replace(/_/g, " ");
}

export function atividadeParaEvento(row: Record<string, unknown>): LeadTimelineEvent {
  const tipo = String(row.tipo ?? "evento");
  const autorTipoRaw = String(row.feito_por_tipo ?? "humano");
  const autorTipo: LeadTimelineEvent["autorTipo"] =
    autorTipoRaw === "ia" ? "ia" : autorTipoRaw === "sistema" ? "sistema" : "humano";

  const categoria = categorizarEventoLead(tipo, autorTipo, "hub_atividades");

  return {
    id: String(row.id ?? `at-${Math.random()}`),
    categoria,
    tipo,
    titulo: tituloPorCategoria(categoria, tipo),
    descricao: String(row.descricao ?? ""),
    autor: String(row.feito_por ?? "—"),
    autorTipo,
    criado_em: String(row.criado_em ?? new Date().toISOString()),
    fonte: "hub_atividades",
  };
}

export function filaMensagemParaEvento(row: Record<string, unknown>): LeadTimelineEvent | null {
  const conteudo = String(row.conteudo ?? "").trim();
  if (!conteudo) return null;

  const direcao = String(row.direcao ?? "entrada");
  const isSaida = direcao === "saida";
  const autorTipo: LeadTimelineEvent["autorTipo"] = isSaida ? "ia" : "cliente";
  const tipo = isSaida ? "mensagem_saida" : "mensagem_entrada";
  const categoria = isSaida ? "conversa_ia" : "conversa_humano";

  return {
    id: String(row.id ?? `fila-${Math.random()}`),
    categoria,
    tipo,
    titulo: isSaida ? "Resposta no canal" : "Mensagem do cliente",
    descricao: conteudo.length > 280 ? `${conteudo.slice(0, 280)}…` : conteudo,
    autor: isSaida
      ? String(row.agente_responsavel ?? row.agente_id ?? "IA")
      : String(row.remetente_numero ?? "Cliente"),
    autorTipo,
    criado_em: String(row.criado_em ?? row.enviada_em ?? new Date().toISOString()),
    fonte: "hub_fila_mensagens",
  };
}

export function logCrmParaEvento(row: Record<string, unknown>): LeadTimelineEvent {
  const acao = String(row.acao ?? "evento");
  const categoria = categorizarEventoLead(acao, "sistema", "hub_logs");
  const anterior = row.valor_anterior != null ? String(row.valor_anterior) : null;
  const novo = row.valor_novo != null ? String(row.valor_novo) : null;
  const descricao =
    anterior || novo
      ? `${anterior || "—"} → ${novo || "—"}${row.motivo ? ` · ${String(row.motivo)}` : ""}`
      : acao.replace(/_/g, " ");

  return {
    id: String(row.id ?? `log-${Math.random()}`),
    categoria,
    tipo: acao,
    titulo: tituloPorCategoria(categoria, acao),
    descricao,
    autor: String(row.origem ?? "sistema"),
    autorTipo: "sistema",
    criado_em: String(row.criado_em ?? new Date().toISOString()),
    fonte: "hub_logs",
  };
}

export function encaminhamentoParaEvento(row: Record<string, unknown>): LeadTimelineEvent {
  const dest = String(
    row.criterio_selecao ?? row.encaminhado_para ?? row.destinatario ?? "destinatário"
  );
  const sugerido = row.sugerido_ia === true;
  const status = row.status != null ? String(row.status) : null;

  return {
    id: String(row.id ?? `enc-${Math.random()}`),
    categoria: "transferencia",
    tipo: "encaminhamento",
    titulo: sugerido ? "Encaminhamento sugerido pela IA" : "Encaminhamento",
    descricao: [dest, row.segmento ? `Segmento: ${String(row.segmento)}` : null, status ? `Status: ${status}` : null]
      .filter(Boolean)
      .join(" · "),
    autor: String(row.responsavel_envio ?? (sugerido ? "IA" : "humano")),
    autorTipo: sugerido ? "ia" : "humano",
    criado_em: String(row.enviado_em ?? row.encaminhado_em ?? row.criado_em ?? new Date().toISOString()),
    fonte: "hub_encaminhamentos",
  };
}

export function conversaTurnoParaEvento(
  turno: { role: string; content: string; at?: string },
  index: number
): LeadTimelineEvent | null {
  const content = turno.content?.trim();
  if (!content) return null;
  const isAssistant = turno.role === "assistant";

  return {
    id: `conv-${index}`,
    categoria: isAssistant ? "conversa_ia" : "conversa_humano",
    tipo: isAssistant ? "ia_acao" : "mensagem",
    titulo: isAssistant ? "Resposta IA (metadata)" : "Mensagem do cliente",
    descricao: content.length > 280 ? `${content.slice(0, 280)}…` : content,
    autor: isAssistant ? "IA" : "Cliente",
    autorTipo: isAssistant ? "ia" : "cliente",
    criado_em: turno.at ?? new Date().toISOString(),
    fonte: "metadata_conversa",
  };
}

export function mergeLeadTimelineEvents(sources: {
  atividades?: Record<string, unknown>[];
  mensagens?: Record<string, unknown>[];
  logs?: Record<string, unknown>[];
  encaminhamentos?: Record<string, unknown>[];
  conversaTurnos?: { role: string; content: string; at?: string }[];
}): LeadTimelineEvent[] {
  const out: LeadTimelineEvent[] = [];

  for (const row of sources.atividades ?? []) out.push(atividadeParaEvento(row));
  for (const row of sources.mensagens ?? []) {
    const ev = filaMensagemParaEvento(row);
    if (ev) out.push(ev);
  }
  for (const row of sources.logs ?? []) out.push(logCrmParaEvento(row));
  for (const row of sources.encaminhamentos ?? []) out.push(encaminhamentoParaEvento(row));
  for (let i = 0; i < (sources.conversaTurnos ?? []).length; i++) {
    const ev = conversaTurnoParaEvento(sources.conversaTurnos![i], i);
    if (ev) out.push(ev);
  }

  out.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

  const seen = new Set<string>();
  return out.filter((ev) => {
    const key = `${ev.fonte}:${ev.id}:${ev.criado_em.slice(0, 16)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filtrarTimelinePorCategoria(
  events: LeadTimelineEvent[],
  categoria: LeadTimelineCategory | "todos"
): LeadTimelineEvent[] {
  if (categoria === "todos") return events;
  return events.filter((e) => e.categoria === categoria);
}

/** Mudanças de funil comercial e status de atendimento (estágio / status_change). */
export function filtrarTimelineMudancasStatus(events: LeadTimelineEvent[]): LeadTimelineEvent[] {
  return filtrarTimelinePorCategoria(events, "estagio");
}

export function exportarTimelineCsv(events: LeadTimelineEvent[], leadNome?: string): void {
  const header = ["data", "categoria", "tipo", "titulo", "descricao", "autor", "fonte"];
  const rows = events.map((e) =>
    [
      e.criado_em,
      LEAD_TIMELINE_CATEGORY_LABELS[e.categoria],
      e.tipo,
      e.titulo,
      e.descricao.replace(/"/g, '""'),
      e.autor,
      e.fonte,
    ]
      .map((v) => `"${v}"`)
      .join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timeline-lead-${(leadNome || "export").replace(/\s+/g, "-").slice(0, 40)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseConversaTurnos(metadata: unknown): {
  role: string;
  content: string;
  at?: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
}[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const raw = (metadata as Record<string, unknown>).conversa_turnos;
  if (!Array.isArray(raw)) return [];

  const parsed: {
    role: string;
    content: string;
    at?: string;
    messageId?: string;
    metadata?: Record<string, unknown>;
  }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const role = o.role === "assistant" ? "assistant" : o.role === "user" ? "user" : null;
    const content = typeof o.content === "string" ? o.content.trim() : "";
    if (!role || !content) continue;
    const turnoMeta =
      o.metadata && typeof o.metadata === "object" && !Array.isArray(o.metadata)
        ? (o.metadata as Record<string, unknown>)
        : undefined;
    const messageId =
      typeof o.message_id === "string"
        ? o.message_id
        : typeof o.whatsapp_message_id === "string"
          ? o.whatsapp_message_id
          : typeof turnoMeta?.message_id === "string"
            ? turnoMeta.message_id
            : undefined;
    parsed.push({
      role,
      content,
      at: typeof o.at === "string" ? o.at : undefined,
      messageId,
      metadata: turnoMeta,
    });
  }
  return parsed;
}
