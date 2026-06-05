"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redireciona para a lista de parceiros com o wizard de convite aberto. */
export default function NovoParceiroRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/crm/parceiros?convidar=1");
  }, [router]);

  return (
    <div
      style={{
        minHeight: "40vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fcf6",
        color: "#5d7a67",
        fontSize: 14,
      }}
    >
      A abrir convite de parceiro…
    </div>
  );
}
