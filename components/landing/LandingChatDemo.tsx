"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { landingChatIntro, landingChatSuggestions } from "@/lib/landing-brand-copy";

export function LandingChatDemo({ brandNome }: { brandNome: string }) {
  const [typed, setTyped] = useState("");
  const full = useMemo(() => landingChatIntro(brandNome), [brandNome]);
  const suggestions = useMemo(() => landingChatSuggestions(brandNome), [brandNome]);

  useEffect(() => {
    let i = 0;
    setTyped("");
    const id = window.setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) window.clearInterval(id);
    }, 28);
    return () => window.clearInterval(id);
  }, [full]);

  return (
    <section id="ia-tempo-real" className="relative px-4 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="waje-section-label mb-2">Demonstração</p>
          <h2 className="waje-heading text-3xl font-extrabold md:text-5xl">
            A IA operando em{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--platform-brand-primary, #3f9848), var(--platform-brand-accent, #92ff00))",
              }}
            >
              tempo real
            </span>
          </h2>
          <p className="waje-subheading mx-auto mt-3 max-w-xl text-base">
            Assistentes com roteiros prontos, triagem e repasse inteligente para sua equipe.
          </p>
        </div>

        <div className="relative mx-auto flex max-w-3xl items-center justify-center">
          <div className="waje-orbit-avatar absolute left-0 top-1/2 hidden -translate-y-1/2 flex-col items-center md:flex">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[color-mix(in_srgb,var(--platform-brand-primary,#3f9848)_35%,transparent)] bg-white shadow-[0_8px_24px_rgba(20,48,28,0.1)]">
              <User className="h-7 w-7 text-[var(--platform-brand-primary,#3f9848)]" />
            </div>
            <span className="mt-2 text-center text-xs font-semibold text-[#4f6853]">Equipe</span>
          </div>
          <div className="waje-orbit-avatar waje-orbit-avatar-delay absolute right-0 top-1/2 hidden -translate-y-1/2 flex-col items-center md:flex">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[color-mix(in_srgb,var(--platform-brand-accent,#92ff00)_50%,transparent)] bg-white shadow-[0_8px_24px_rgba(20,48,28,0.1)]">
              <Bot className="h-7 w-7 text-[var(--platform-brand-accent,var(--platform-brand-primary,#3f9848))]" />
            </div>
            <span className="mt-2 text-center text-xs font-semibold text-[#4f6853]">Agente IA</span>
          </div>

          <div className="waje-chat-window w-full max-w-md overflow-hidden rounded-3xl">
            <div className="waje-chat-demo-header flex items-center gap-3 border-b border-[#d7e5d3] bg-[#f4faf1] px-5 py-4">
              <div className="relative">
                <div className="waje-chat-demo-bot flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--platform-brand-accent,#92ff00)] to-[var(--platform-brand-primary,#3f9848)]">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white"
                  style={{ background: "var(--platform-brand-accent, #92ff00)" }}
                />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-[#0b1f10]">Assistente virtual</p>
                <p className="text-xs font-medium text-[var(--platform-brand-accent,var(--platform-brand-primary,#3f9848))]">
                  Assistente virtual · online
                </p>
              </div>
            </div>
            <div className="space-y-4 bg-white px-5 py-6 text-left">
              <div className="rounded-2xl rounded-tl-sm border border-[#e4f2de] bg-[#f8fcf6] px-4 py-3 text-sm leading-relaxed text-[#2a4030]">
                {typed}
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[var(--platform-brand-primary,#3f9848)]" />
              </div>
              <div className="flex flex-col gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-full border border-[#c8e6c0] bg-[#f4faf1] px-4 py-2.5 text-left text-xs text-[#3f5b44] transition hover:border-[color-mix(in_srgb,var(--platform-brand-accent,#92ff00)_50%,transparent)] hover:bg-[#eef7eb]"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-[#e8f2e4] pt-4">
                <input
                  type="text"
                  readOnly
                  placeholder="Digite sua mensagem..."
                  className="h-10 flex-1 rounded-full border border-[#d7e5d3] bg-[#f8fcf6] px-4 text-xs text-[#506a54]"
                />
                <button
                  type="button"
                  className="waje-btn-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  aria-label="Enviar"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
