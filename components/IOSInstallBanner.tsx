"use client";
import { useState, useEffect } from "react";
import { PlatformBrandLogo } from "@/components/brand/PlatformBrandLogo";
import { useBrandNome } from "@/components/brand/PlatformBrandProvider";

export default function IOSInstallBanner() {
  const brandNome = useBrandNome();
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const jaViu = localStorage.getItem("ios_banner_visto");
    if (isIOS && !isStandalone && !jaViu) {
      setTimeout(() => setMostrar(true), 3000);
    }
  }, []);

  function fechar() {
    localStorage.setItem("ios_banner_visto", "true");
    setMostrar(false);
  }

  if (!mostrar) return null;

  return (
    <div
      className="fixed bottom-20 left-3 right-3 z-50 rounded-2xl p-4 shadow-2xl sm:left-auto sm:right-4 sm:max-w-sm"
      style={{ background: "#161b22", border: "1px solid #c9a24a44" }}
    >
      <button
        onClick={fechar}
        className="absolute right-3 top-3"
        style={{ color: "#484f58", background: "none", border: "none", cursor: "pointer" }}
        aria-label="Fechar"
      >
        ✕
      </button>
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{ background: "var(--platform-brand-bg, #0b1f10)" }}
        >
          <PlatformBrandLogo size={28} variant="favicon" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Instalar {brandNome}</p>
          <p className="text-xs" style={{ color: "#8b949e" }}>
            Adicione à tela inicial
          </p>
        </div>
      </div>
      <div className="space-y-2 text-sm" style={{ color: "#8b949e" }}>
        {[
          { n: 1, text: <>Toque em <span style={{ color: "#c9a24a" }}>Compartilhar</span> ⎙ no Safari</> },
          { n: 2, text: <>Toque em <span style={{ color: "#c9a24a" }}>&quot;Adicionar à Tela de Início&quot;</span></> },
          { n: 3, text: <>Toque em <span style={{ color: "#c9a24a" }}>Adicionar</span> ✓</> },
        ].map((s) => (
          <div key={s.n} className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "#003b26", color: "#c9a24a" }}
            >
              {s.n}
            </span>
            <p>{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
