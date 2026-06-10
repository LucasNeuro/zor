"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Atendimento unificado em Leads — redireciona links antigos. */
function RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (p.has("lead") && !p.has("tab")) {
      p.set("tab", "chat");
    }
    const q = p.toString();
    router.replace(q ? `/crm/leads?${q}` : "/crm/leads");
  }, [router, searchParams]);

  return (
    <p className="p-6 text-sm text-[#5d7a67]">A redirecionar para Leads…</p>
  );
}

export default function AtendimentoRedirectPage() {
  return (
    <Suspense>
      <RedirectContent />
    </Suspense>
  );
}
