import type { SupabaseClient } from "@supabase/supabase-js";
import { parseConversaTurnos } from "@/lib/crm/lead-timeline";
import { textoExibicaoMensagemHumano } from "@/lib/crm/mensagem-consultor-whatsapp";
import { cutoffSessaoConversaMs } from "@/lib/ia/sessao-conversa-ttl";

export type TurnoConversa = { role: "user" | "assistant"; content: string };

export type OrcamentoNaConversa = {
  valor: number;
  trecho: string;
  servicoMencionado?: string | null;
};

export type HistoricoConversaLead = {
  linhas: string[];
  turnos: TurnoConversa[];
  textoCompleto: string;
};

const PALAVRAS_SERVICO = [
  "conserto",
  "reparo",
  "troca",
  "tela",
  "bateria",
  "diagnóstico",
  "diagnostico",
  "manutenção",
  "manutencao",
  "formatação",
  "formatacao",
  "celular",
  "smartphone",
  "iphone",
  "samsung",
  "vidro",
  "display",
  "orçamento",
  "orcamento",
];

function parseBrlValor(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.includes(",")) {
    const n = Number.parseFloat(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = Number.parseFloat(s.replace(/\./g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extrairServicoDoTrecho(trecho: string): string | null {
  const lower = trecho.toLowerCase();
  const hits = PALAVRAS_SERVICO.filter((p) => lower.includes(p));
  if (!hits.length) return null;

  const frases = trecho.split(/[.!?\n]/).map((f) => f.trim()).filter(Boolean);
  for (const frase of frases) {
    const fl = frase.toLowerCase();
    if (hits.some((h) => fl.includes(h)) && frase.length >= 8 && frase.length <= 120) {
      return frase.replace(/\s+/g, " ").trim();
    }
  }
  return hits.slice(0, 3).join(" ");
}

/** Valores R$ mencionados na conversa — prioriza linhas com «orçamento». */
export function extrairOrcamentosDosTextos(textos: string[]): OrcamentoNaConversa[] {
  const out: OrcamentoNaConversa[] = [];
  const valoresVistos = new Set<number>();

  for (const texto of textos) {
    const blocos = texto.split(/\n/).map((b) => b.trim()).filter(Boolean);
    for (const bloco of blocos) {
      const lower = bloco.toLowerCase();
      const temOrcamento =
        lower.includes("orçamento") ||
        lower.includes("orcamento") ||
        lower.includes("r$") ||
        lower.includes("valor") ||
        lower.includes("total") ||
        lower.includes("fica") ||
        lower.includes("custa");

      if (!temOrcamento) continue;

      const matches = [...bloco.matchAll(/r\$\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/gi)];
      for (const m of matches) {
        const valor = parseBrlValor(m[1] ?? "");
        if (!valor || valor < 5 || valoresVistos.has(valor)) continue;
        valoresVistos.add(valor);
        const trecho = bloco.slice(0, 220).trim();
        out.push({
          valor,
          trecho,
          servicoMencionado: extrairServicoDoTrecho(bloco),
        });
      }
    }
  }

  return out.sort((a, b) => {
    const aOrc = /orçamento|orcamento/i.test(a.trecho) ? 1 : 0;
    const bOrc = /orçamento|orcamento/i.test(b.trecho) ? 1 : 0;
    return bOrc - aOrc || b.valor - a.valor;
  });
}

/** Demanda explícita do cliente (conserto, troca de tela, etc.). */
export function extrairDemandaServicoCliente(
  turnos: TurnoConversa[],
  linhas: string[]
): string | null {
  const mensagensCliente = [
    ...turnos.filter((t) => t.role === "user").map((t) => t.content),
    ...linhas
      .filter((l) => l.startsWith("Cliente:"))
      .map((l) => l.replace(/^Cliente:\s*/i, "")),
  ];

  for (const msg of mensagensCliente.reverse()) {
    const servico = extrairServicoDoTrecho(msg);
    if (servico) return servico.slice(0, 100);
  }

  for (const msg of mensagensCliente) {
    const m = msg.match(
      /(?:preciso|quero|gostaria|interesse|problema|defeito)[^.!?\n]{0,80}/i
    );
    if (m?.[0] && m[0].length >= 12) return m[0].trim().slice(0, 100);
  }

  return null;
}

function linhaUnica(chave: string, visto: Set<string>): boolean {
  if (visto.has(chave)) return false;
  visto.add(chave);
  return true;
}

export async function carregarHistoricoConversaLead(
  supabase: SupabaseClient,
  leadId: string
): Promise<HistoricoConversaLead> {
  const linhas: string[] = [];
  const turnos: TurnoConversa[] = [];
  const visto = new Set<string>();

  const { data: lead } = await supabase
    .from("hub_leads_crm")
    .select("metadata, ultima_mensagem")
    .eq("id", leadId)
    .maybeSingle();

  for (const t of parseConversaTurnos(lead?.metadata)) {
    const role = t.role === "assistant" ? "assistant" : "user";
    turnos.push({ role, content: t.content });
    const linha = `${role === "user" ? "Cliente" : "Atendente"}: ${t.content.slice(0, 500)}`;
    if (linhaUnica(linha.slice(0, 120), visto)) linhas.push(linha);
  }

  const { data: fila } = await supabase
    .from("hub_fila_mensagens")
    .select("direcao, conteudo, metadata, criado_em")
    .eq("lead_id", leadId)
    .order("criado_em", { ascending: false })
    .limit(32);

  for (const m of (fila ?? []).reverse()) {
    const meta =
      m.metadata && typeof m.metadata === "object" && !Array.isArray(m.metadata)
        ? (m.metadata as Record<string, unknown>)
        : {};
    const bruto = String(m.conteudo ?? "").trim();
    const txt = textoExibicaoMensagemHumano(bruto, meta).slice(0, 500);
    if (!txt) continue;
    const dir = String(m.direcao ?? "").toLowerCase() === "entrada" ? "Cliente" : "Atendente";
    const linha = `${dir}: ${txt}`;
    if (linhaUnica(linha.slice(0, 120), visto)) {
      linhas.push(linha);
      turnos.push({
        role: dir === "Cliente" ? "user" : "assistant",
        content: txt,
      });
    }
  }

  try {
    const { data: conv } = await supabase
      .from("hub_conversas")
      .select("id")
      .eq("lead_id", leadId)
      .is("encerrada_em", null)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (conv?.id) {
      const { data: msgs } = await supabase
        .from("hub_mensagens")
        .select("remetente, conteudo, metadados, enviada_em")
        .eq("conversa_id", conv.id)
        .order("enviada_em", { ascending: false })
        .limit(24);

      for (const msg of (msgs ?? []).reverse()) {
        const meta =
          msg.metadados && typeof msg.metadados === "object" && !Array.isArray(msg.metadados)
            ? (msg.metadados as Record<string, unknown>)
            : {};
        const bruto = String(msg.conteudo ?? "").trim();
        const txt = textoExibicaoMensagemHumano(bruto, meta).slice(0, 500);
        if (!txt) continue;
        const rem = String(msg.remetente ?? "").toLowerCase();
        const dir =
          rem === "lead" || rem === "cliente" || rem === "entrada" ? "Cliente" : "Atendente";
        const linha = `${dir}: ${txt}`;
        if (linhaUnica(linha.slice(0, 120), visto)) {
          linhas.push(linha);
          turnos.push({
            role: dir === "Cliente" ? "user" : "assistant",
            content: txt,
          });
        }
      }
    }
  } catch {
    /* hub_mensagens opcional */
  }

  const ultima =
    typeof lead?.ultima_mensagem === "string" ? lead.ultima_mensagem.trim() : "";
  if (ultima) {
    const linha = `Última mensagem (CRM): ${ultima.slice(0, 300)}`;
    if (linhaUnica(linha.slice(0, 120), visto)) linhas.push(linha);
  }

  return {
    linhas,
    turnos,
    textoCompleto: linhas.join("\n"),
  };
}

export async function carregarMemoriasLeadNegocio(
  supabase: SupabaseClient,
  leadId: string
): Promise<string[]> {
  const cutoffIso = new Date(cutoffSessaoConversaMs()).toISOString();
  const { data } = await supabase
    .from("hub_memorias_lead")
    .select("chave, valor, confianca")
    .eq("lead_id", leadId)
    .gte("criado_em", cutoffIso)
    .order("confianca", { ascending: false })
    .limit(12);

  return (data ?? []).map((m) => `[${m.chave}] ${m.valor}`);
}

export function formatarOrcamentosParaPrompt(orcamentos: OrcamentoNaConversa[]): string {
  if (!orcamentos.length) return "Nenhum valor/orçamento explícito detectado na conversa.";
  return orcamentos
    .slice(0, 4)
    .map(
      (o, i) =>
        `${i + 1}. R$ ${o.valor.toFixed(2)} — «${o.trecho}»${o.servicoMencionado ? ` (serviço: ${o.servicoMencionado})` : ""}`
    )
    .join("\n");
}
