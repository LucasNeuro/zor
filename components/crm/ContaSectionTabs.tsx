"use client";

export type ContaSectionTab = {
  id: string;
  label: string;
};

type Props = {
  tabs: ContaSectionTab[];
  activeId: string;
  onSelect: (id: string) => void;
};

/** Abas estilo pipeline (texto + underline verde). */
export function ContaSectionTabs({ tabs, activeId, onSelect }: Props) {
  return (
    <div className="flex gap-6 border-b border-[#dcebd8] px-4 sm:px-5">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className="relative -mb-px shrink-0 pb-3 pt-3 text-sm font-semibold transition-colors"
            style={{
              color: active ? "#0b2210" : "#5d7a67",
              borderBottom: active ? "2px solid #0f6b4f" : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
