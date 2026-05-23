"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Rota legada — redireciona para o CRM novo (drawer em /crm/leads). */
export default function LeadLegadoRedirectPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (id) router.replace(`/crm/leads?lead=${encodeURIComponent(id)}`);
    else router.replace("/crm/leads");
  }, [id, router]);

  return (
    <div className="flex min-h-full items-center justify-center bg-[#0d1117] text-sm text-[#8b949e]">
      A redirecionar para Leads…
    </div>
  );
}
