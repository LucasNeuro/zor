"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { NegocioDetailSideover } from "@/components/crm/negocios/NegocioDetailSideover";

/** Deep link: abre o sideover Waje em vez da página legada Obra10. */
export default function NegocioDeepLinkPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const fechar = useCallback(() => {
    router.replace("/crm/negocios");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f8fcf6]">
      <NegocioDetailSideover open negocioId={id} onClose={fechar} />
    </div>
  );
}
