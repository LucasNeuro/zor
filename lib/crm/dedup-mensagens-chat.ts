/** Deduplica mensagens do chat CRM (hub_mensagens + hub_fila_mensagens + turnos legados). */

export type MensagemChatRow = Record<string, unknown>;

export function normalizarConteudoMensagem(conteudo: unknown): string {
  return String(conteudo ?? "").trim();
}

export function timestampMensagem(row: MensagemChatRow): number {
  const em = new Date(String(row.criado_em ?? row.enviada_em ?? 0)).getTime();
  return Number.isFinite(em) ? em : 0;
}

export function scoreMensagemPreferida(row: MensagemChatRow): number {
  let score = 0;
  if (row.fonte === "hub_mensagens") score += 4;
  if (row.agente_id) score += 2;
  if (row.whatsapp_message_id) score += 2;
  if (String(row.feito_por_tipo ?? "") === "ia" && row.agente_id) score += 1;
  return score;
}

export function chaveDedupMensagem(row: MensagemChatRow): string | null {
  const waId = String(row.whatsapp_message_id ?? "").trim();
  if (waId) return `wa:${waId}`;

  const conteudo = normalizarConteudoMensagem(row.conteudo);
  if (!conteudo) return null;

  const dir = String(row.direcao ?? "");
  const em = timestampMensagem(row);
  if (!em) return `${dir}:${conteudo.slice(0, 200)}`;

  const bucket = Math.floor(em / 60_000);
  return `${dir}:${bucket}:${conteudo.slice(0, 200)}`;
}

export function mergeMensagensChatDeduped(rows: MensagemChatRow[]): MensagemChatRow[] {
  const byKey = new Map<string, MensagemChatRow>();
  const order: string[] = [];

  for (const row of rows) {
    const id = String(row.id ?? "");
    const key = chaveDedupMensagem(row) ?? (id ? `id:${id}` : `tmp:${order.length}`);

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      order.push(key);
      continue;
    }
    if (scoreMensagemPreferida(row) > scoreMensagemPreferida(existing)) {
      byKey.set(key, row);
    }
  }

  return order
    .map((k) => byKey.get(k)!)
    .sort((a, b) => {
      const diff = timestampMensagem(a) - timestampMensagem(b);
      if (diff !== 0) return diff;
      return String(a.id ?? "").localeCompare(String(b.id ?? ""));
    });
}
