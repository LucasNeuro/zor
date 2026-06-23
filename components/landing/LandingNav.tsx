import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PlatformBrandDisplay } from "@/components/brand/PlatformBrandDisplay";

const links = [
  { href: "#produto", label: "Produto" },
  { href: "#ia-tempo-real", label: "IA em tempo real" },
  { href: "#ecossistema", label: "Ecossistema" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 md:px-6">
      <div className="waje-glass-nav mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 md:px-6">
        <PlatformBrandDisplay layout="horizontal" tone="brand" wordmarkSize="sm" className="items-center" />
        <nav className="hidden items-center gap-6 text-[11px] font-semibold uppercase tracking-[0.14em] lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="waje-nav-link">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="waje-btn-ghost inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold">
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#92ff00] px-4 text-sm font-semibold text-[#061008] transition hover:brightness-110"
          >
            Começar
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
