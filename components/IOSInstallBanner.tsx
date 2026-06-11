"use client";
import { useState, useEffect } from "react";

export default function IOSInstallBanner() {
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
    <div className="fixed bottom-20 left-3 right-3 z-50 rounded-2xl p-4 shadow-2xl"
      style={{ background: "#161b22", border: "1px solid #c9a24a44" }}>
      <button onClick={fechar} className="absolute top-3 right-3"
        style={{ color: "#484f58", background: "none", border: "none", cursor: "pointer" }}>✕</button>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm"
          style={{ background: "#0b1f10", color: "#92ff00" }}>W</div>
        <div>
          <p className="text-white font-bold text-sm">Instalar Waje</p>
          <p className="text-xs" style={{ color: "#8b949e" }}>Adicione à tela inicial</p>
        </div>
      </div>
      <div className="space-y-2 text-sm" style={{ color: "#8b949e" }}>
        {[
          { n: 1, text: <>Toque em <span style={{ color: "#c9a24a" }}>Compartilhar</span> ⎙ no Safari</> },
          { n: 2, text: <>Toque em <span style={{ color: "#c9a24a" }}>&quot;Adicionar à Tela de Início&quot;</span></> },
          { n: 3, text: <>Toque em <span style={{ color: "#c9a24a" }}>Adicionar</span> ✓</> },
        ].map(s => (
          <div key={s.n} className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: "#003b26", color: "#c9a24a" }}>{s.n}</span>
            <p>{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
