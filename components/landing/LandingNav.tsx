"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { PlatformBrandDisplay } from "@/components/brand/PlatformBrandDisplay";

const links = [
  { href: "#produto", label: "Produto" },
  { href: "#ia-tempo-real", label: "IA em tempo real" },
  { href: "#ecossistema", label: "Ecossistema" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4 md:px-6">
      <div className="waje-glass-nav mx-auto max-w-6xl overflow-hidden rounded-2xl shadow-[0_8px_32px_rgba(11,31,16,0.06)]">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:px-6">
          <PlatformBrandDisplay
            layout="horizontal"
            tone="brand"
            wordmarkSize="sm"
            variant="nav"
            className="min-w-0 max-w-[58%] items-center sm:max-w-none"
          />

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              href="/login"
              className="waje-btn-ghost inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold sm:px-4 sm:text-sm"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="waje-btn-glow hidden min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold sm:inline-flex sm:px-4 sm:text-sm"
            >
              Começar
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d4e8d0] bg-white/90 text-[#1e3a23] lg:hidden"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav
            className="border-t border-[#dce7d8] px-3 py-3 lg:hidden"
            aria-label="Navegação principal"
          >
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="waje-nav-link rounded-xl px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </a>
              ))}
            </div>
            <Link
              href="/cadastro"
              className="waje-btn-glow mt-3 inline-flex w-full min-h-10 items-center justify-center gap-1.5 rounded-full text-sm font-semibold sm:hidden"
              onClick={() => setMenuOpen(false)}
            >
              Começar
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        ) : null}
      </div>

      <nav
        className="waje-glass-nav mx-auto mt-2 hidden max-w-6xl items-center justify-center gap-6 rounded-2xl px-6 py-2.5 lg:flex"
        aria-label="Secções"
      >
        {links.map((l) => (
          <a key={l.href} href={l.href} className="waje-nav-link text-[11px] font-semibold uppercase tracking-[0.14em]">
            {l.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
