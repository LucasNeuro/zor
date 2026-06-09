"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Cadastro removido do Waje — identidade vive no lead (hub_pessoas implícito). */
export default function CadastroRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    const dest = q ? `/crm/leads?${q}` : "/crm/leads?novo=1";
    router.replace(dest);
  }, [router, searchParams]);

  return (
    <p className="p-6 text-sm text-[#6b8a76]">A redirecionar para Leads…</p>
  );
}
