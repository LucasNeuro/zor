import { ChevronRight } from "lucide-react";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

type FaqItem = { question: string; answer: string };

export function LandingFaq({ items }: { items: FaqItem[] }) {
  return (
    <section id="faq" className="px-4 py-16 md:py-20">
      <div className="mx-auto max-w-2xl">
        <ScrollReveal>
          <div className="mb-10 text-center">
            <p className="waje-section-label mb-2">Dúvidas</p>
            <h2 className="waje-heading text-3xl font-extrabold md:text-4xl">Perguntas frequentes</h2>
          </div>
        </ScrollReveal>
        <div className="space-y-3">
          {items.map((item, i) => (
            <ScrollReveal key={item.question} delay={i * 70}>
              <details className="group waje-faq-item rounded-2xl">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-[#0b1f10]">
                  {item.question}
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#3f9848] transition-transform duration-300 group-open:rotate-90" />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed text-[#506a54]">{item.answer}</p>
              </details>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
