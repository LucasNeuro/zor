"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Listagem legada — redireciona para Leads. */
export default function EmpresasRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/crm/leads?${q}` : "/crm/leads");
  }, [router, searchParams]);

  return (
    <p className="p-6 text-sm text-[#6b8a76]">A redirecionar para Leads…</p>
  );
}
