"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCrmShell } from "@/components/crm/CrmShellContext";

type CrmSidebarToggleButtonProps = {
  className?: string;
  /** `floating`: verde, à direita do sidebar na altura do logo (desktop). */
  variant?: "sidebar" | "header" | "floating";
};

/** Botão circular de colapsar/expandir sidebar. */
export function CrmSidebarToggleButton({
  className = "",
  variant = "floating",
}: CrmSidebarToggleButtonProps) {
  const shell = useCrmShell();
  if (!shell) return null;

  const { sidebarExpanded, toggleSidebar } = shell;

  if (variant === "floating") {
    return (
      <button
        type="button"
        onClick={toggleSidebar}
        className={`hidden md:flex h-7 w-7 flex-shrink-0 touch-manipulation items-center justify-center rounded-full border-0 bg-[#92ff00] text-[#0b1f10] transition-all duration-200 hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3f9848]/60 focus-visible:ring-offset-2 ${className}`.trim()}
        style={{
          boxShadow: "0 2px 10px rgba(11, 31, 16, 0.28)",
        }}
        title={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
        aria-expanded={sidebarExpanded}
        aria-label={sidebarExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
      >
        {sidebarExpanded ? (
          <ChevronLeft size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
        ) : (
          <ChevronRight size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
        )}
      </button>
    );
  }

  const visibility = variant === "sidebar" ? "flex" : "hidden md:flex";

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={`${visibility} h-8 w-8 flex-shrink-0 touch-manipulation items-center justify-center rounded-full border border-[#d4e0d7] bg-[#ffffff] text-[#4f665b] shadow-none transition-all duration-200 hover:border-[#c9a24a]/70 hover:text-[#12382b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a24a]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${className}`.trim()}
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
