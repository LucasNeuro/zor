"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AtendentesEquipePanel } from "@/components/crm/atendimento/AtendentesEquipePanel";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";

export default function EquipeAtendimentoPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({
      path: pathname,
      subtitle: "Equipe de atendimento",
    });
    return () => setSlot(null);
  }, [pathname, setSlot, isMobile]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fcf6]">
      {isMobile ? (
        <CrmStickyPageHeader
          title="Equipe"
          description="Atendentes e vendedores para transferência de conversas."
        />
      ) : null}

      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mx-auto max-w-5xl rounded-xl border border-[#dcebd8] bg-[#0a0e14] p-4 shadow-sm sm:p-5">
          <AtendentesEquipePanel variant="atendimento" />
        </div>
      </div>
    </div>
  );
}
