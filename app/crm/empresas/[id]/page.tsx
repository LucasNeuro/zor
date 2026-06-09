"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";

/** Ficha legada — abre negócio ou lead vinculado, ou a lista de Leads. */
export default function EmpresaRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [msg, setMsg] = useState("A localizar registo vinculado…");

  useEffect(() => {
    if (!id) {
      router.replace("/crm/leads");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/crm/empresas/${encodeURIComponent(id)}/crm-resumo`, {
          headers: internalApiHeaders(),
        });
        const json = (await res.json().catch(() => ({}))) as {
          data?: { leads?: { id: string }[]; negocios?: { id: string }[] };
        };
        if (cancelled) return;
        const leadId = json.data?.leads?.[0]?.id;
        if (leadId) {
          router.replace(`/crm/leads/${leadId}`);
          return;
        }
        const negocioId = json.data?.negocios?.[0]?.id;
        if (negocioId) {
          router.replace(`/crm/negocios/${negocioId}`);
          return;
        }
        setMsg("Sem vínculo comercial — a redirecionar para Leads…");
        router.replace("/crm/leads");
      } catch {
        if (!cancelled) router.replace("/crm/leads");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return <p className="p-6 text-sm text-[#6b8a76]">{msg}</p>;
}
