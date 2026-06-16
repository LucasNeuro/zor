"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Parceiros removido do Waje — redireciona para Leads. */
export default function NovoParceiroRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/crm/leads");
  }, [router]);

  return (
    <p className="p-6 text-sm text-[#6b8a76]">A redirecionar para Leads…</p>
  );
}
