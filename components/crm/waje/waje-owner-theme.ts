"use client";

import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

export const WO = {
  pageBg: "#060d08",
  panelBg: "linear-gradient(165deg, rgba(11, 31, 16, 0.98) 0%, rgba(6, 13, 8, 0.99) 100%)",
  cardBg: "rgba(8, 18, 12, 0.92)",
  border: RF_BORDER,
  borderStrong: RF_BORDER_STRONG,
  text: RF_TEXT_PRIMARY,
  text2: RF_TEXT_SECONDARY,
  textMuted: RF_TEXT_MUTED,
  accent: RF_ACCENT,
  metricBg: "rgba(6, 13, 8, 0.75)",
} as const;

export type WajeOwnerTab = "tenants" | "agentes" | "pagamentos" | "usuarios" | "leads" | "plataformas";
