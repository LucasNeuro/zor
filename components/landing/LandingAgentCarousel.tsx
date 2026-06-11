"use client";

import { useCallback, useState } from "react";
import { Bot, ChevronLeft, ChevronRight, Headphones, Mail, MessageCircle } from "lucide-react";

/** Slides genéricos — tipos de assistente, sem nomes de agentes reais do CRM. */
const slides = [
  {
    id: "whatsapp",
    titulo: "Atendimento no WhatsApp",
    subtitulo: "Primeiro contato e qualificação",
    desc: "Responde clientes, entende a necessidade e organiza o lead para sua equipe vender.",
    icon: MessageCircle,
    gradient: "from-[#92ff00] to-[#3f9848]",
  },
  {
    id: "email",
    titulo: "Atendimento por e-mail",
    subtitulo: "Caixa de entrada organizada",
    desc: "Lê mensagens recebidas, responde com contexto e mantém tudo registrado no CRM.",
    icon: Mail,
    gradient: "from-[#3f9848] to-[#2a6b38]",
  },
  {
    id: "comercial",
    titulo: "Apoio à operação comercial",
    subtitulo: "CRM e equipe alinhados",
    desc: "Acompanha funil, sugere próximos passos e repassa para vendedores quando fizer sentido.",
    icon: Headphones,
    gradient: "from-[#61c900] to-[#3f9848]",
  },
  {
    id: "personalizado",
    titulo: "Assistente sob medida",
    subtitulo: "Do jeito do seu negócio",
    desc: "Você define roteiros, tom de voz e regras — a IA segue o processo da sua empresa.",
    icon: Bot,
    gradient: "from-[#162c1c] to-[#3f9848]",
  },
];

export function LandingAgentCarousel() {
  const [index, setIndex] = useState(0);
  const slide = slides[index]!;
  const Icon = slide.icon;

  const prev = useCallback(() => setIndex((i) => (i - 1 + slides.length) % slides.length), []);
  const next = useCallback(() => setIndex((i) => (i + 1) % slides.length), []);

  return (
    <section id="ia-tempo-real" className="px-4 py-16 md:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <p className="waje-section-label mb-2">Com IA</p>
        <h2 className="waje-heading mb-10 text-3xl font-extrabold md:text-4xl">O que você pode automatizar</h2>

        <div className="relative flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={prev}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d7e5d3] bg-white text-[#3f9848] shadow-sm transition hover:border-[#92ff00]/50 hover:shadow-md"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div key={slide.id} className="waje-agent-slide flex flex-col items-center px-4">
            <div
              className={`mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br ${slide.gradient} shadow-[0_12px_40px_rgba(63,152,72,0.25)]`}
            >
              <Icon className="h-12 w-12 text-white" />
            </div>
            <span className="rounded-full border border-[#c8e6c0] bg-[#f4faf1] px-4 py-1 text-xs font-semibold text-[#2d5a32]">
              {slide.titulo} · {slide.subtitulo}
            </span>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#506a54]">{slide.desc}</p>
          </div>

          <button
            type="button"
            onClick={next}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d7e5d3] bg-white text-[#3f9848] shadow-sm transition hover:border-[#92ff00]/50 hover:shadow-md"
            aria-label="Próximo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-8 bg-[#92ff00]" : "w-2 bg-[#c8e6c0] hover:bg-[#92ff00]/60"
              }`}
              aria-label={s.titulo}
            />
          ))}
        </div>
        <p className="mt-4 text-xs text-[#8aa892]">Use as setas ou clique nos pontos para navegar</p>
      </div>
    </section>
  );
}
