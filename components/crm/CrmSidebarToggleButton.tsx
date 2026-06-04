"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCrmShell } from "@/components/crm/CrmShellContext";

type CrmSidebarToggleButtonProps = {
  className?: string;
  /** `sidebar`: visível no pai (sidebar só desktop). `header`: barra do título (`hidden` em mobile). */
  variant?: "sidebar" | "header";
};

/** Botão circular de colapsar/expandir sidebar. */
export function CrmSidebarToggleButton({
  className = "",
  variant = "header",
}: CrmSidebarToggleButtonProps) {
  const shell = useCrmShell();
  if (!shell) return null;

  const { sidebarExpanded, toggleSidebar } = shell;

  const visibility = variant === "sidebar" ? "flex" : "hidden md:flex";

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={`${visibility} h-8 w-8 flex-shrink-0 touch-manipulation items-center justify-center rounded-full border border-[#2b3544] bg-[#1a2332] text-[#8b949e] shadow-none transition-all duration-200 hover:border-[#c9a24a]/60 hover:text-[#e6edf3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a24a]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${className}`.trim()}
      title={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
      aria-expanded={sidebarExpanded}
      aria-label={sidebarExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
    >
      {sidebarExpanded ? (
        <ChevronLeft size={14} strokeWidth={2} className="shrink-0" aria-hidden />
      ) : (
        <ChevronRight size={14} strokeWidth={2} className="shrink-0" aria-hidden />
      )}
    </button>
  );
}
