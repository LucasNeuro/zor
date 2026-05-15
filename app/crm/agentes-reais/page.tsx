"use client";

import { GitBranch } from "lucide-react";

/** Placeholder: workflows — orquestração de fluxos (modelos IA, ciclos, integrações). */
export default function WorkflowsPlaceholderPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div
        className="rounded-xl border p-8 text-center"
        style={{
          background: "#161b22",
          borderColor: "#30363d",
        }}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "#21262d" }}>
          <GitBranch size={28} strokeWidth={1.5} style={{ color: "#c9a24a" }} aria-hidden />
        </div>
        <h1 className="text-lg font-bold text-white m-0">Workflows</h1>
        <p className="text-sm m-0 mt-2" style={{ color: "#8b949e", lineHeight: 1.55 }}>
          Área para desenhar e acompanhar fluxos operacionais ligados aos <strong style={{ color: "#c9a24a", fontWeight: 600 }}>modelos IA</strong>,{" "}
          <strong style={{ color: "#c9a24a", fontWeight: 600 }}>ciclos</strong> e integrações. Ainda em preparação — use{" "}
          <strong style={{ color: "#c9a24a", fontWeight: 600 }}>Modelos</strong> e <strong style={{ color: "#c9a24a", fontWeight: 600 }}>Ciclos IA</strong> no menu.
        </p>
      </div>
    </div>
  );
}
