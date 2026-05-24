"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Redireciona listagem legada para o hub unificado de cadastro. */
export default function PessoasRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    const dest = q ? `/crm/cadastro?${q}` : "/crm/cadastro";
    router.replace(dest);
  }, [router, searchParams]);

  return (
    <p style={{ padding: 24, color: "#8b949e", fontSize: 13 }}>A redireccionar para Cadastro…</p>
  );
}
