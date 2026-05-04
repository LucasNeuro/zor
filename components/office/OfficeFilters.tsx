"use client";

export type FiltroCanvas =
  | "todos"
  | "criticos"
  | "atendimento"
  | "trafego"
  | "conteudo"
  | "sites"
  | "ias"
  | "humanos";

interface Filtro {
  id: FiltroCanvas;
  label: string;
  color?: string;
}

const FILTROS: Filtro[] = [
  { id: "todos", label: "Todos" },
  { id: "criticos", label: "Críticos", color: "#ef4444" },
  { id: "atendimento", label: "Atendimento", color: "#22c55e" },
  { id: "trafego", label: "Tráfego", color: "#60a5fa" },
  { id: "conteudo", label: "Conteúdo", color: "#a78bfa" },
  { id: "sites", label: "Sites", color: "#34d399" },
  { id: "ias", label: "IAs", color: "#f59e0b" },
  { id: "humanos", label: "Humanos", color: "#f472b6" },
];

interface OfficeFiltersProps {
  filtro: FiltroCanvas;
  onFiltroChange: (f: FiltroCanvas) => void;
}

export function OfficeFilters({ filtro, onFiltroChange }: OfficeFiltersProps) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-950/80 border-b border-gray-800/50 flex-shrink-0 overflow-x-auto">
      {FILTROS.map(f => {
        const isActive = filtro === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onFiltroChange(f.id)}
            className={`flex-shrink-0 text-[11px] font-medium rounded-full px-3 py-1 transition-colors ${
              isActive
                ? "text-white"
                : "text-gray-500 hover:text-gray-300 bg-gray-900 hover:bg-gray-800"
            }`}
            style={isActive ? {
              background: f.color ? `${f.color}20` : "rgba(249,115,22,0.15)",
              border: `1px solid ${f.color ? `${f.color}40` : "rgba(249,115,22,0.3)"}`,
              color: f.color ?? "#f97316",
            } : { border: "1px solid transparent" }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
