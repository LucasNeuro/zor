"use client";

import { Bot, type LucideIcon } from "lucide-react";

export type CrmBotRingAvatarProps = {
  /** Fraction of the outer ring filled (0–1). Omit for `fallbackProgress`. */
  progress?: number | null;
  /** When `progress` is null/undefined, use this arc (demo / placeholder). Default 0.35. */
  fallbackProgress?: number;
  /** Outer diameter of the avatar in CSS pixels */
  pixelSize?: number;
  /** Alias of `pixelSize` (preferred in new code). */
  size?: number;
  accent?: string;
  imageUrl?: string | null;
  /** Shown inside the dial when no image. Defaults to lucide Bot. */
  Icon?: LucideIcon;
  /** De-emphasize colors (e.g. inactive). */
  dim?: boolean;
  /** Extra halo ring used e.g. while waiting for first run. */
  pulse?: boolean;
  /** Visually hides progress (only inner + rings). */
  hideProgressRing?: boolean;
};

/**
 * Circular CRM avatar: dark core, faint inner ring, optional progress arc, soft accent glow.
 * Matches escritório glass-card tone (`#f8fcf6`-family centres).
 */
export function CrmBotRingAvatar({
  progress,
  fallbackProgress = 0.35,
  pixelSize: pixelProp,
  size: sizeProp,
  accent = "#22c55e",
  imageUrl,
  Icon = Bot,
  dim = false,
  pulse = false,
  hideProgressRing = false,
}: CrmBotRingAvatarProps) {
  const pixelSize = sizeProp ?? pixelProp ?? 52;
  const pad = pixelSize <= 44 ? 1.75 : pixelSize <= 52 ? 2 : 2.5;
  const rOuter = 24;
  const cx = 29;
  const cy = 29;
  const circ = 2 * Math.PI * rOuter;
  const pRaw = typeof progress === "number" && Number.isFinite(progress) ? progress : fallbackProgress;
  const p = Math.min(1, Math.max(0, hideProgressRing ? 0 : pRaw));
  const strokeShown = Math.max(circ * 0.06, circ * p);
  const strokeHide = circ - strokeShown;
  const showArc = !hideProgressRing && p > 0.002;
  const rInnerDecor = rOuter - 5;

  const trim = typeof imageUrl === "string" ? imageUrl.trim() : "";
  const hasImg = trim.length > 0;
  const core = Math.max(30, pixelSize - pad * 2 - 14);

  return (
    <div
      style={{
        position: "relative",
        width: pixelSize,
        height: pixelSize,
        flexShrink: 0,
        filter:
          dim
            ? undefined
            : `drop-shadow(0 0 10px ${accent}66) drop-shadow(0 0 24px rgba(34, 197, 94, 0.12))`,
      }}
    >
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 58 58"
        style={{ display: "block" }}
        aria-hidden
      >
        {/* faint inner guide ring */}
        <circle
          cx={cx}
          cy={cy}
          r={rInnerDecor}
          fill="none"
          stroke={accent}
          strokeWidth="1"
          opacity={dim ? 0.12 : 0.22}
        />
        {/* outer track */}
        <circle
          cx={cx}
          cy={cy}
          r={rOuter}
          fill="none"
          stroke="#0f172a"
          strokeWidth={pad}
          opacity={dim ? 0.5 : 0.95}
        />
        {/* progress */}
        {showArc ? (
          <circle
            cx={cx}
            cy={cy}
            r={rOuter}
            fill="none"
            stroke={accent}
            strokeWidth={pad}
            strokeLinecap="round"
            strokeDasharray={`${strokeShown} ${strokeHide}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            opacity={dim ? 0.35 : 0.92}
            style={{ transition: "stroke-dasharray 0.65s ease, opacity 0.3s ease" }}
          />
        ) : null}
        {pulse && !dim ? (
          <circle
            cx={cx}
            cy={cy}
            r={rOuter + 2}
            fill="none"
            stroke={accent}
            strokeWidth={1}
            opacity={0.35}
          />
        ) : null}
      </svg>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: core,
          height: core,
          borderRadius: "50%",
          background: `linear-gradient(165deg, ${accent}2b 0%, #f8fcf6 52%, #0a0f14 100%)`,
          border: `1px solid ${dim ? `${accent}33` : `${accent}55`}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow:
            `${dim ? `0 0 0 1px #00000030 inset` : `0 0 0 1px #00000055 inset`}, ` +
            `${dim ? "none" : `0 0 12px ${accent}20`}`,
          overflow: "hidden",
        }}
      >
        {hasImg ? (
          // URLs arbitrárias (avatar em storage/CDN): alinhado aos cards CRM com <img>.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={trim} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Icon
            size={Math.min(22, Math.round(core * 0.45))}
            color={dim ? "#64748b" : accent}
            strokeWidth={2}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
