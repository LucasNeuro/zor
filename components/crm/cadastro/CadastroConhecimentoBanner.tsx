"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_TEXT_MUTED,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type DocResumo = {
  titulo?: string | null;
  resumo_ia?: Record<string, unknown> | string | null;
  status?: string;
};

function resumoIaParaTexto(resumo: unknown): string {
  if (typeof resumo === "string") return resumo.trim();
  if (!resumo || typeof resumo !== "object") return "";
  const obj = resumo as Record<string, unknown>;
  const empresa = typeof obj.empresa === "string" ? obj.empresa.trim() : "";
  if (empresa) return empresa;
  const pontos = Array.isArray(obj.pontos_chave)
    ? obj.pontos_chave.map(String).filter(Boolean)
    : [];
  if (pontos[0]) return pontos[0];
  return "Resumo disponível";
}

/** Contexto do cadastro a partir da base de conhecimento do tenant. */
export function CadastroConhecimentoBanner() {
  const [docs, setDocs] = useState<DocResumo[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/hub/conhecimento", { headers: internalApiHeaders() });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (json.aviso) setAviso(String(json.aviso));
        const list = (json.documentos ?? []) as DocResumo[];
        setDocs(list.filter((d) => d.status === "pronto").slice(0, 3));
      } catch {
        if (!cancelled) setAviso(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resumo = docs.map((d) => resumoIaParaTexto(d.resumo_ia)).find((t) => t.length > 0);

  return (
    <div
      className="mb-4 rounded-xl border p-4"
      style={{ borderColor: RF_BORDER, background: "rgba(6, 13, 8, 0.55)" }}
    >
      <div className="mb-2 flex items-center gap-2">
        <BookOpen size={14} style={{ color: RF_ACCENT }} />
        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: RF_ACCENT }}>
          Contexto da empresa
        </span>
      </div>
      {resumo ? (
        <p className="m-0 text-xs leading-relaxed" style={{ color: RF_TEXT_SECONDARY }}>
          {resumo.length > 280 ? `${resumo.slice(0, 277)}…` : resumo}
        </p>
      ) : (
        <p className="m-0 text-xs leading-relaxed" style={{ color: RF_TEXT_MUTED }}>
          Cadastre clientes conforme o ramo e operação da sua empresa. Os campos abaixo seguem o
          padrão CRM genérico — personalize categorias e funis em Leads e Negócios.
        </p>
      )}
      {aviso ? (
        <p className="mt-2 mb-0 text-[11px]" style={{ color: RF_TEXT_MUTED }}>
          {aviso}
        </p>
      ) : null}
      <Link
        href="/crm/conhecimento"
        className="mt-3 inline-block text-[11px] font-semibold hover:underline"
        style={{ color: RF_ACCENT }}
      >
        Gerir documentos de conhecimento
      </Link>
    </div>
  );
}
