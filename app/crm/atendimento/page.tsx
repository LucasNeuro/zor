"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Redireciona links antigos de /crm/atendimento para o módulo Atendimentos. */
function RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    const leadId = p.get("lead");
    p.delete("lead");
    p.delete("view");

    if (leadId) {
      const tab = p.get("tab");
      p.delete("tab");
      const rest = p.toString();
      const q = tab === "chat" || tab === "conversas_email" ? `?tab=${tab}` : rest ? `?${rest}` : "";
      router.replace(`/crm/atendimentos/${encodeURIComponent(leadId)}${q}`);
      return;
    }

    const q = p.toString();
    router.replace(q ? `/crm/atendimentos?${q}` : "/crm/atendimentos");
  }, [router, searchParams]);

  return (
    <p className="p-6 text-sm text-[#5d7a67]">A redirecionar para Atendimentos…</p>
  );
}

export default function AtendimentoRedirectPage() {
  return (
    <Suspense>
      <RedirectContent />
    </Suspense>
  );
}
