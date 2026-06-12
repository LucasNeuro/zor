"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";

/** Ponte OAuth: obtém authorize_url com sessão CRM e redirecciona para Google. */
export default function ConnectEmailGooglePage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const started = useRef(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || started.current) return;
    started.current = true;

    (async () => {
      const returnTo = `/crm/agentes/${encodeURIComponent(slug)}`;

      const qs = new URLSearchParams({
        agente_slug: slug,
        return_to: returnTo,
        json: "1",
      });

      try {
        const res = await fetch(`/api/hub/email/oauth/google/start?${qs}`, {
          headers: await crmApiHeaders(),
        });
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (!res.ok) {
          setErro(
            typeof data.error === "string" && data.error.trim()
              ? data.error.trim()
              : `Erro HTTP ${res.status}`
          );
          return;
        }
        const url =
          typeof data.authorize_url === "string" && data.authorize_url.trim()
            ? data.authorize_url.trim()
            : null;
        if (!url) {
          setErro("Resposta OAuth inválida.");
          return;
        }
        window.location.href = url;
      } catch {
        setErro("Falha de rede ao iniciar ligação Google.");
      }
    })();
  }, [slug, router]);

  if (erro) {
    return (
      <main
        style={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <p style={{ margin: 0, color: "#c62828", fontWeight: 700 }}>{erro}</p>
        <button
          type="button"
          onClick={() => router.push(`/crm/agentes/${encodeURIComponent(slug)}`)}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Voltar ao agente
        </button>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        color: "#5d7a67",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <Loader2 size={28} className="animate-spin" />
      <p style={{ margin: 0 }}>A redireccionar para Google…</p>
    </main>
  );
}
