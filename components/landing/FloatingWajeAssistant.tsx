"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { WajeLogoMark } from "@/components/brand/WajeLogoMark";
import {
  labelOpcao,
  WAJE_MINI_BOT_INTRO,
  WAJE_MINI_BOT_PERGUNTAS,
  type WajeMiniBotResposta,
} from "@/lib/landing/waje-mini-bot-flow";

const TEASER_DISMISS_KEY = "waje_mini_bot_teaser_dismissed";

type ChatMsg = { role: "bot" | "user"; text: string };

type Fase = "perguntas" | "formulario" | "sucesso";

export function FloatingWajeAssistant() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  const [fase, setFase] = useState<Fase>("perguntas");
  const [perguntaIdx, setPerguntaIdx] = useState(0);
  const [respostas, setRespostas] = useState<WajeMiniBotResposta[]>([]);
  const [mensagens, setMensagens] = useState<ChatMsg[]>([{ role: "bot", text: WAJE_MINI_BOT_INTRO }]);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const iniciadoRef = useRef(false);

  const perguntaAtual = WAJE_MINI_BOT_PERGUNTAS[perguntaIdx];

  const scrollFim = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || open) return;
    try {
      if (sessionStorage.getItem(TEASER_DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setShowTeaser(true), 1800);
    return () => window.clearTimeout(t);
  }, [mounted, open]);

  useEffect(() => {
    scrollFim();
  }, [mensagens, fase, scrollFim]);

  const dismissTeaser = useCallback((persist = true) => {
    setShowTeaser(false);
    if (persist) {
      try {
        sessionStorage.setItem(TEASER_DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    }
  }, []);

  const reiniciar = useCallback(() => {
    setFase("perguntas");
    setPerguntaIdx(0);
    setRespostas([]);
    setMensagens([{ role: "bot", text: WAJE_MINI_BOT_INTRO }]);
    setNome("");
    setEmail("");
    setTelefone("");
    setEmpresa("");
    setMensagem("");
    setErro(null);
    iniciadoRef.current = false;
  }, []);

  const abrir = useCallback(() => {
    dismissTeaser(false);
    setOpen(true);
    if (!iniciadoRef.current && WAJE_MINI_BOT_PERGUNTAS[0]) {
      iniciadoRef.current = true;
      const p = WAJE_MINI_BOT_PERGUNTAS[0];
      setTimeout(() => {
        setMensagens((m) => [...m, { role: "bot", text: p.pergunta }]);
      }, 400);
    }
  }, [dismissTeaser]);

  const fechar = useCallback(() => {
    setOpen(false);
  }, []);

  const escolherOpcao = useCallback(
    (opcaoId: string, label: string) => {
      const q = WAJE_MINI_BOT_PERGUNTAS[perguntaIdx];
      if (!q) return;

      const nova: WajeMiniBotResposta = {
        pergunta: q.pergunta,
        resposta: label,
        resposta_id: opcaoId,
      };
      const novasRespostas = [...respostas, nova];

      setMensagens((m) => [...m, { role: "user", text: label }]);
      setRespostas(novasRespostas);

      const proximo = perguntaIdx + 1;
      if (proximo < WAJE_MINI_BOT_PERGUNTAS.length) {
        setPerguntaIdx(proximo);
        setTimeout(() => {
          setMensagens((m) => [...m, { role: "bot", text: WAJE_MINI_BOT_PERGUNTAS[proximo]!.pergunta }]);
        }, 350);
      } else {
        setTimeout(() => {
          setMensagens((m) => [
            ...m,
            {
              role: "bot",
              text: "Perfeito! Deixe seus dados abaixo e nossa equipe entra em contato em breve.",
            },
          ]);
          setFase("formulario");
        }, 350);
      }
    },
    [perguntaIdx, respostas]
  );

  const enviarFormulario = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!nome.trim() || !email.trim()) {
      setErro("Preencha nome e e-mail.");
      return;
    }

    setEnviando(true);
    try {
      const interesse = respostas[0];
      const equipe = respostas[1];
      const prazo = respostas[2];

      const res = await fetch("/api/public/waje-interesse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim() || null,
          empresa: empresa.trim() || null,
          mensagem: mensagem.trim() || null,
          interesse_principal: interesse
            ? labelOpcao("interesse_principal", interesse.resposta_id)
            : null,
          tamanho_equipe: equipe ? labelOpcao("tamanho_equipe", equipe.resposta_id) : null,
          prazo_inicio: prazo ? labelOpcao("prazo_inicio", prazo.resposta_id) : null,
          respostas,
          pagina_url: typeof window !== "undefined" ? window.location.href : null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setErro(data.error || "Não foi possível enviar. Tente novamente.");
        return;
      }
      setFase("sucesso");
      setMensagens((m) => [
        ...m,
        { role: "bot", text: "Obrigado! ✅ Registramos seu interesse. Em breve alguém da Waje fala com você." },
      ]);
    } catch {
      setErro("Erro de conexão. Verifique a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  if (!mounted) return null;

  const ui = (
    <div className="waje-float-root flex flex-col items-end gap-3">
      {open ? (
        <div className="waje-mini-bot-panel flex max-h-[min(520px,78dvh)] w-[min(340px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[#92ff00]/25 bg-[#0b1f10] shadow-[0_24px_64px_rgba(0,0,0,0.35)]">
          <div className="flex shrink-0 items-center justify-between border-b border-[#92ff00]/15 bg-[#071209] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#92ff00]/30 bg-[#0b1f10]">
                <WajeLogoMark size={22} />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#071209] bg-[#92ff00]" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold leading-tight text-white">Assistente Waje</span>
                <span className="text-[11px] font-medium text-[#92ff00]">Online · resposta rápida</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {fase === "sucesso" ? (
                <button
                  type="button"
                  onClick={reiniciar}
                  className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
                  aria-label="Reiniciar conversa"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={fechar}
                className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {mensagens.map((msg, i) => (
              <div
                key={`${i}-${msg.text.slice(0, 24)}`}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-br-sm bg-[#92ff00] text-[#061008]"
                      : "rounded-bl-sm border border-white/10 bg-white/8 text-white/90"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {fase === "perguntas" && perguntaAtual && mensagens.some((m) => m.text === perguntaAtual.pergunta) ? (
              <div className="flex flex-col gap-1.5 pt-1">
                {perguntaAtual.opcoes.map((op) => (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => escolherOpcao(op.id, op.label)}
                    className="rounded-full border border-[#92ff00]/30 bg-[#92ff00]/10 px-3 py-2 text-left text-xs font-medium text-[#c8ffaa] transition hover:border-[#92ff00]/55 hover:bg-[#92ff00]/18"
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            ) : null}

            {fase === "formulario" ? (
              <form onSubmit={enviarFormulario} className="space-y-2 border-t border-white/10 pt-3">
                <input
                  type="text"
                  required
                  placeholder="Seu nome *"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="waje-mini-bot-input"
                />
                <input
                  type="email"
                  required
                  placeholder="E-mail *"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="waje-mini-bot-input"
                />
                <input
                  type="tel"
                  placeholder="WhatsApp / telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="waje-mini-bot-input"
                />
                <input
                  type="text"
                  placeholder="Empresa (opcional)"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  className="waje-mini-bot-input"
                />
                <textarea
                  placeholder="Mensagem (opcional)"
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  className="waje-mini-bot-input resize-none"
                />
                {erro ? <p className="text-xs text-red-400">{erro}</p> : null}
                <button
                  type="submit"
                  disabled={enviando}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#92ff00] py-2.5 text-xs font-bold text-[#061008] transition hover:brightness-110 disabled:opacity-60"
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Enviar interesse
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      {!open && showTeaser ? (
        <div className="waje-float-teaser relative mb-1 w-[min(260px,calc(100vw-5rem))] rounded-2xl p-3.5 pr-9">
          <button
            type="button"
            onClick={() => dismissTeaser()}
            className="waje-float-teaser-dismiss absolute right-2 top-2 rounded-md p-1 text-[#6b8570] hover:bg-[#eef7eb] hover:text-[#0b1f10]"
            aria-label="Fechar convite"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#92ff00]/35 bg-[#0b1f10]">
              <WajeLogoMark size={18} />
            </div>
            <p className="text-sm font-bold leading-tight text-[#0b1f10]">Olá! 👋 Precisa de ajuda?</p>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-[#506a54]">
            Responda 3 perguntas rápidas e deixe seu contato — a equipe Waje retorna em breve.
          </p>
          <button
            type="button"
            onClick={abrir}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#92ff00] py-2 text-xs font-bold text-[#061008] transition hover:brightness-110"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Iniciar conversa
          </button>
        </div>
      ) : null}

      <div className="relative">
        <span className="waje-float-btn-ring" aria-hidden />
        <button
          type="button"
          onClick={() => (open ? fechar() : abrir())}
          className="waje-float-btn relative flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full"
          aria-label={open ? "Fechar assistente" : "Abrir assistente Waje"}
          aria-expanded={open}
        >
          <WajeLogoMark size={30} />
        </button>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}
