"use client";

import { useEffect, useState } from "react";
import { Bot, Send, User } from "lucide-react";

const suggestions = [
  "Como a Waje transforma meu atendimento no WhatsApp?",
  "A equipe pode assumir quando quiser?",
  "Funciona para várias empresas?",
];

export function LandingChatDemo() {
  const [typed, setTyped] = useState("");
  const full =
    "Olá! Sou um assistente virtual da Waje. Posso qualificar leads, responder no WhatsApp e encaminhar para sua equipe quando precisar.";

  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) window.clearInterval(id);
    }, 28);
    return () => window.clearInterval(id);
  }, [full]);

  return (
    <section className="relative px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="waje-section-label mb-2">Demonstração</p>
          <h2 className="waje-heading text-3xl font-extrabold md:text-5xl">
            A IA operando em{" "}
            <span className="bg-gradient-to-r from-[#3f9848] to-[#92ff00] bg-clip-text text-transparent">
              tempo real
            </span>
          </h2>
          <p className="waje-subheading mx-auto mt-3 max-w-xl text-base">
            Assistentes com roteiros prontos, triagem e repasse inteligente para sua equipe.
          </p>
        </div>

        <div className="relative mx-auto flex max-w-3xl items-center justify-center">
          <div className="waje-orbit-avatar absolute left-0 top-1/2 hidden -translate-y-1/2 flex-col items-center md:flex">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#3f9848]/35 bg-white shadow-[0_8px_24px_rgba(20,48,28,0.1)]">
              <User className="h-7 w-7 text-[#3f9848]" />
            </div>
            <span className="mt-2 text-center text-xs font-semibold text-[#4f6853]">Equipe</span>
          </div>
          <div className="waje-orbit-avatar waje-orbit-avatar-delay absolute right-0 top-1/2 hidden -translate-y-1/2 flex-col items-center md:flex">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#92ff00]/50 bg-white shadow-[0_8px_24px_rgba(20,48,28,0.1)]">
              <Bot className="h-7 w-7 text-[#3f9848]" />
            </div>
            <span className="mt-2 text-center text-xs font-semibold text-[#4f6853]">Agente IA</span>
          </div>

          <div className="waje-chat-window w-full max-w-md overflow-hidden rounded-3xl">
            <div className="flex items-center gap-3 border-b border-[#d7e5d3] bg-[#f4faf1] px-5 py-4">
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#92ff00] to-[#3f9848]">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#92ff00]" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-[#0b1f10]">Assistente virtual</p>
                <p className="text-xs font-medium text-[#3f9848]">Assistente virtual · online</p>
              </div>
            </div>
            <div className="space-y-4 bg-white px-5 py-6 text-left">
              <div className="rounded-2xl rounded-tl-sm border border-[#e4f2de] bg-[#f8fcf6] px-4 py-3 text-sm leading-relaxed text-[#2a4030]">
                {typed}
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[#3f9848]" />
              </div>
              <div className="flex flex-col gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-full border border-[#c8e6c0] bg-[#f4faf1] px-4 py-2.5 text-left text-xs text-[#3f5b44] transition hover:border-[#92ff00]/50 hover:bg-[#eef7eb]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-[#e4f2de] bg-[#fafdf8] px-4 py-3">
              <div className="flex-1 rounded-full border border-[#dce7d8] bg-white px-4 py-2.5 text-sm text-[#8aa892]">
                Digite sua mensagem…
              </div>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#92ff00] text-[#061008] shadow-[0_4px_16px_rgba(146,255,0,0.35)]"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
