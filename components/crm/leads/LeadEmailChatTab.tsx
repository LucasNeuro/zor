"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { CrmSideoverActionBtn, CrmSideoverActionGroup, CrmSideoverToolbarRow } from "@/components/crm/CrmSideoverActionGroup";
import { effectiveHumanoResponsavel, formatHumanoDisplayName } from "@/lib/crm/resolve-crm-actor";
import { crmApiHeadersWithActor, getCrmSessionActor } from "@/lib/internal-api-headers-client";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { supabase } from "@/lib/supabase/client";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type EmailMsg = {
  id: string;
  conteudo: string;
  direcao: string;
  remetente: string;
  autorLabel: string;
  criado_em: string;
  email_subject?: string | null;
};

type Props = {
  leadId: string;
  leadNome?: string;
  leadEmail?: string | null;
  humanoResponsavel?: string | null;
  agenteResponsavel?: string | null;
  onHumanoResponsavelChange?: (valor: string | null) => void;
  interactive?: boolean;
};

function labelRemetente(remetente: string, agente?: string | null) {
  if (remetente === "lead") return "Lead";
  if (remetente === "humano") return "Humano";
  if (remetente === "ia") return agente ? `IA · ${agente}` : "IA";
  return remetente;
}

export function LeadEmailChatTab({
  leadId,
  leadNome = "Lead",
  leadEmail,
  humanoResponsavel,
  agenteResponsavel,
  onHumanoResponsavelChange,
  interactive = true,
}: Props) {
  const [mensagens, setMensagens] = useState<EmailMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [assumindo, setAssumindo] = useState(false);
  const [strip, setStrip] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [sessionActor, setSessionActor] = useState<{ id?: string; email?: string; name?: string }>({});
  const fimRef = useRef<HTMLDivElement>(null);

  const humano = effectiveHumanoResponsavel(humanoResponsavel);
  const assumido = Boolean(humano?.trim());
  const emailOk = Boolean(leadEmail?.trim());

  useEffect(() => {
    let cancelled = false;
    void getCrmSessionActor().then((a) => { if (!cancelled) setSessionActor(a); });
    return () => { cancelled = true; };
  }, []);

  const headers = useCallback(() => crmApiHeadersWithActor(sessionActor), [sessionActor]);

  const carregar = useCallback(async (quiet?: boolean) => {
    if (!leadId) return;
    if (!quiet) { setLoading(true); setErro(""); }
    try {
      const res = await fetch(
        `/api/crm/atendimento/mensagens?canal=email&leadId=${encodeURIComponent(leadId)}`,
        { headers: internalApiHeaders() }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!quiet) setErro(typeof json.error === "string" ? json.error : "Erro ao carregar e-mails.");
        setMensagens([]);
        return;
      }
      const rows = (json.mensagens ?? []) as Record<string, unknown>[];
      setMensagens(
        rows.map((r) => ({
          id: String(r.id ?? Math.random()),
          conteudo: String(r.conteudo ?? "").trim(),
          direcao: String(r.direcao ?? ""),
          remetente: String(r.remetente ?? (r.direcao === "entrada" ? "lead" : "ia")),
          autorLabel: labelRemetente(
            String(r.remetente ?? (r.direcao === "entrada" ? "lead" : "ia")),
            typeof r.agente_id === "string" ? r.agente_id : agenteResponsavel
          ),
          criado_em: String(r.criado_em ?? r.enviada_em ?? new Date().toISOString()),
          email_subject: (r.email_subject as string | null) ?? null,
        })).filter((m) => m.conteudo)
      );
    } catch {
      if (!quiet) setErro("Erro de rede.");
      setMensagens([]);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [leadId, agenteResponsavel]);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    if (!leadId) return;
    const ch = supabase
      .channel(`lead-email-${leadId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hub_mensagens", filter: `lead_id=eq.${leadId}` }, () => {
        void carregar(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [leadId, carregar]);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensagens]);

  async function assumir() {
    setAssumindo(true);
    setStrip(null);
    try {
      const res = await fetch("/api/crm/atendimento/assumir", {
        method: "POST",
        credentials: "include",
        headers: { ...(await headers()), "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStrip({ kind: "error", text: typeof json.error === "string" ? json.error : "Não foi possível assumir." });
        return;
      }
      const h = typeof json.humano_responsavel === "string" ? json.humano_responsavel : "operador";
      onHumanoResponsavelChange?.(h);
      setStrip({ kind: "success", text: "Atendimento e-mail assumido." });
    } catch {
      setStrip({ kind: "error", text: "Erro de rede." });
    } finally {
      setAssumindo(false);
    }
  }

  async function enviar() {
    const texto = input.trim();
    if (!texto || enviando) return;
    setEnviando(true);
    setStrip(null);
    setInput("");
    try {
      const res = await fetch("/api/crm/atendimento/send-email", {
        method: "POST",
        credentials: "include",
        headers: { ...(await headers()), "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, texto, subject: subject.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInput(texto);
        setStrip({ kind: "error", text: typeof json.error === "string" ? json.error : "Falha ao enviar e-mail." });
        return;
      }
      setStrip({ kind: "success", text: "E-mail enviado ao lead." });
      setSubject("");
      await carregar(true);
    } catch {
      setInput(texto);
      setStrip({ kind: "error", text: "Erro de rede." });
    } finally {
      setEnviando(false);
    }
  }

  const stats = useMemo(() => {
    let ia = 0, humano = 0, lead = 0;
    for (const m of mensagens) {
      if (m.remetente === "lead") lead++;
      else if (m.remetente === "humano") humano++;
      else ia++;
    }
    return { total: mensagens.length, lead, ia, humano };
  }, [mensagens]);

  if (!emailOk) {
    return (
      <p className="text-sm" style={{ color: RF_TEXT_MUTED }}>
        Este lead não tem e-mail cadastrado. Adicione um e-mail em Dados para usar o canal.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 pb-3">
        <p className="m-0 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: RF_TEXT_MUTED }}>
          Atendimento · E-mail
        </p>
        <p className="m-0 mt-0.5 truncate text-sm font-bold" style={{ color: RF_TEXT_PRIMARY }}>{leadNome}</p>
        <p className="m-0 mt-1 flex items-center gap-1.5 text-xs" style={{ color: RF_TEXT_SECONDARY }}>
          <Mail size={13} /> {leadEmail}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold" style={{ color: RF_TEXT_MUTED }}>
          <span style={{ color: assumido ? "#86efac" : RF_TEXT_MUTED }}>{assumido ? `Humano: ${formatHumanoDisplayName(humano!)}` : "IA"}</span>
          {agenteResponsavel ? <span>Agente · {agenteResponsavel}</span> : null}
          <span>{stats.total} msgs ({stats.lead} lead · {stats.ia} IA · {stats.humano} humano)</span>
        </div>
        {interactive ? (
          <div className="mt-3">
            <CrmSideoverToolbarRow>
              <CrmSideoverActionGroup>
                {!assumido ? (
                  <CrmSideoverActionBtn active disabled={assumindo} onClick={() => void assumir()}>
                    {assumindo ? <Loader2 className="animate-spin" size={14} /> : null}
                    Assumir
                  </CrmSideoverActionBtn>
                ) : null}
              </CrmSideoverActionGroup>
            </CrmSideoverToolbarRow>
          </div>
        ) : null}
      </div>

      {strip ? (
        <p className="mb-2 text-xs" style={{ color: strip.kind === "error" ? "#f85149" : "#86efac" }}>{strip.text}</p>
      ) : null}
      {erro ? <p className="mb-2 text-xs text-[#f85149]">{erro}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border p-3" style={{ borderColor: RF_BORDER, background: "rgba(6,13,8,0.45)" }}>
        {loading ? (
          <p className="text-xs" style={{ color: RF_TEXT_MUTED }}>A carregar conversa de e-mail…</p>
        ) : mensagens.length === 0 ? (
          <p className="text-xs leading-relaxed" style={{ color: RF_TEXT_MUTED }}>
            Nenhuma mensagem de e-mail ainda. Quando o cliente enviar para o endereço inbound do agente, a conversa aparece aqui.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {mensagens.map((m) => {
              const saida = m.direcao === "saida" || m.remetente !== "lead";
              return (
                <div key={m.id} className={`flex ${saida ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[92%] rounded-xl px-3 py-2 text-sm"
                    style={{
                      background: saida ? "rgba(63,185,80,0.12)" : "rgba(56,139,253,0.1)",
                      border: `1px solid ${saida ? "rgba(63,185,80,0.35)" : "rgba(56,139,253,0.35)"}`,
                      color: RF_TEXT_PRIMARY,
                    }}
                  >
                    <p className="m-0 mb-1 text-[10px] font-bold uppercase" style={{ color: RF_TEXT_MUTED }}>
                      {m.autorLabel}
                      {m.email_subject ? ` · ${m.email_subject}` : ""}
                    </p>
                    <p className="m-0 whitespace-pre-wrap">{m.conteudo}</p>
                    <p className="m-0 mt-1 text-[10px]" style={{ color: RF_TEXT_MUTED }}>
                      {new Date(m.criado_em).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={fimRef} />
          </div>
        )}
      </div>

      {interactive && assumido ? (
        <div className="mt-3 shrink-0 space-y-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Assunto (opcional — usa Re: do thread)"
            className="w-full rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: RF_BORDER_STRONG, background: "rgba(6,13,8,0.6)", color: RF_TEXT_PRIMARY }}
          />
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); }
              }}
              rows={3}
              placeholder="Mensagem para o lead (e-mail)…"
              className="min-h-[72px] flex-1 resize-none rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: RF_BORDER_STRONG, background: "rgba(6,13,8,0.6)", color: RF_TEXT_PRIMARY }}
            />
            <button
              type="button"
              disabled={enviando || !input.trim()}
              onClick={() => void enviar()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: RF_ACCENT, color: "#0b2210", opacity: enviando || !input.trim() ? 0.5 : 1 }}
            >
              {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="m-0 text-[10px]" style={{ color: RF_TEXT_MUTED }}>
            Enter envia · Shift+Enter nova linha · mensagens vão para o e-mail do lead via Resend
          </p>
        </div>
      ) : interactive ? (
        <p className="mt-3 text-xs" style={{ color: RF_TEXT_MUTED }}>
          Assuma o atendimento para responder por e-mail pelo CRM.
        </p>
      ) : null}
    </div>
  );
}
