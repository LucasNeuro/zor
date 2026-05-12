"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";

const CATEGORIAS = [
  { icon: "✍️", label: "Copy", descricao: "Scripts, títulos e textos persuasivos", cor: "#c9a24a" },
  { icon: "📱", label: "Social", descricao: "Posts, stories e reels para redes sociais", cor: "#3B82F6" },
  { icon: "🎨", label: "Design", descricao: "Criativos, banners e artes gráficas", cor: "#A855F7" },
  { icon: "🎬", label: "Vídeo", descricao: "Roteiros e briefings de vídeo", cor: "#EF4444" },
  { icon: "📧", label: "Email", descricao: "Sequências e campanhas de e-mail", cor: "#06B6D4" },
  { icon: "📝", label: "Blog", descricao: "Artigos, SEO e conteúdo editorial", cor: "#22C55E" },
];

export default function ConteudoPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <span
          className="rounded-full border px-2 py-1 text-xs font-bold"
          style={{ background: "#c9a24a20", color: "#c9a24a", border: "1px solid #c9a24a40" }}
        >
          Em breve
        </span>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot]);

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "#0d1117" }}>
      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-4 mb-8">
          {CATEGORIAS.map(cat => (
            <div key={cat.label} className="rounded-xl p-5 cursor-default transition-all hover:scale-[1.02]"
              style={{ background: "#161b22", border: `1px solid ${cat.cor}30` }}>
              <div className="text-3xl mb-3">{cat.icon}</div>
              <h3 className="font-black text-sm mb-1" style={{ color: "#e6edf3" }}>{cat.label}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#8b949e" }}>{cat.descricao}</p>
              <div className="mt-3 text-xs font-bold" style={{ color: cat.cor + "80" }}>Em desenvolvimento</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl p-6 text-center" style={{ background: "#161b22", border: "1px solid #30363d" }}>
          <p className="text-4xl mb-3">✏️</p>
          <p className="font-black text-base mb-2" style={{ color: "#e6edf3" }}>Módulo de Conteúdo</p>
          <p className="text-sm max-w-md mx-auto" style={{ color: "#8b949e" }}>
            Este módulo permitirá criar, aprovar e distribuir conteúdo com auxílio de IA diretamente pelo escritório virtual.
          </p>
        </div>
      </div>
    </div>
  );
}
