"use client";

import { useEffect, useMemo, useState } from "react";
import { gerarAvatarAgenteDataUri, resolverAvatarAgenteUrl } from "@/lib/crm/agente-avatar-gen";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";

export type AgenteAvatarStatus = "ativo" | "inativo" | "arquivado";

export type AgenteAvatarProps = {
  seed: string;
  /** Nome de exibição — define gênero do avatar autogerado. */
  nome?: string | null;
  imageUrl?: string | null;
  size?: number;
  shape?: "rounded" | "circle";
  status?: AgenteAvatarStatus;
  showStatusDot?: boolean;
  /** 0–1 — anel de progresso opcional (saúde operacional). */
  progress?: number | null;
  dim?: boolean;
  alt?: string;
};

const STATUS_DOT: Record<AgenteAvatarStatus, string> = {
  ativo: BRAND_GREEN_BRIGHT,
  inativo: "#f87171",
  arquivado: "#a78bfa",
};

/**
 * Avatar de agente: URL gravada ou retrato Notionists (linha preta Waje, gênero pelo nome).
 */
export function AgenteAvatar({
  seed,
  nome,
  imageUrl,
  size = 56,
  shape = "rounded",
  status = "ativo",
  showStatusDot = true,
  progress,
  dim = false,
  alt,
}: AgenteAvatarProps) {
  const primarySrc = useMemo(
    () => resolverAvatarAgenteUrl(seed, imageUrl, nome),
    [seed, imageUrl, nome]
  );
  const [src, setSrc] = useState(primarySrc);

  useEffect(() => {
    setSrc(primarySrc);
  }, [primarySrc]);

  const radius = shape === "circle" ? "50%" : Math.max(10, Math.round(size * 0.22));
  const p =
    typeof progress === "number" && Number.isFinite(progress)
      ? Math.min(1, Math.max(0, progress))
      : null;
  const ringPad = p != null ? 3 : 0;
  const outer = size + ringPad * 2;

  return (
    <div
      style={{
        position: "relative",
        width: outer,
        height: outer,
        flexShrink: 0,
        opacity: dim ? 0.72 : 1,
        filter: dim ? "grayscale(0.25)" : undefined,
      }}
    >
      {p != null ? (
        <svg
          width={outer}
          height={outer}
          viewBox={`0 0 ${outer} ${outer}`}
          style={{ position: "absolute", inset: 0, display: "block" }}
          aria-hidden
        >
          <circle
            cx={outer / 2}
            cy={outer / 2}
            r={(size + ringPad) / 2}
            fill="none"
            stroke="rgba(18, 56, 43, 0.12)"
            strokeWidth={ringPad}
          />
          <circle
            cx={outer / 2}
            cy={outer / 2}
            r={(size + ringPad) / 2}
            fill="none"
            stroke={BRAND_GREEN_BRIGHT}
            strokeWidth={ringPad}
            strokeLinecap="round"
            strokeDasharray={`${Math.PI * (size + ringPad) * p} ${Math.PI * (size + ringPad)}`}
            transform={`rotate(-90 ${outer / 2} ${outer / 2})`}
            opacity={0.9}
          />
        </svg>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: ringPad,
          top: ringPad,
          width: size,
          height: size,
          borderRadius: radius,
          overflow: "hidden",
          border: `2px solid ${dim ? "rgba(18, 56, 43, 0.12)" : "rgba(18, 56, 43, 0.14)"}`,
          boxShadow: dim
            ? "0 4px 12px rgba(15, 56, 39, 0.08)"
            : "0 6px 20px rgba(15, 56, 39, 0.12)",
          background: "#f8fcf6",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? `Avatar ${nome || seed}`}
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          draggable={false}
          onError={() => setSrc(gerarAvatarAgenteDataUri(seed))}
        />
      </div>
      {showStatusDot ? (
        <span
          style={{
            position: "absolute",
            right: ringPad + 1,
            bottom: ringPad + 1,
            width: Math.max(9, Math.round(size * 0.2)),
            height: Math.max(9, Math.round(size * 0.2)),
            borderRadius: "50%",
            background: STATUS_DOT[status],
            border: "2px solid #ffffff",
            boxShadow: `0 0 8px ${STATUS_DOT[status]}88`,
          }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

export function agenteIdLabel(slug: string): string {
  const clean = slug.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return clean ? `ID: WAJE-${clean.slice(0, 12)}` : "ID: WAJE";
}
