"use client";

import {
  FOLLOWUP_ESPERA_PRESETS,
  formatarEsperaMinutos,
  minutosToLegacyAtraso,
} from "@/lib/hub/followup-types";
import {
  RF_LIGHT_BORDER,
  RF_LIGHT_INPUT_STYLE,
  RF_LIGHT_LABEL_STYLE,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_PRIMARY,
  RF_LIGHT_TEXT_SECONDARY,
  RF_BORDER,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfInputStyle,
  rfLabelStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";

type ThemeColors = {
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  miniBtnBg: string;
};

function themeColors(theme: "light" | "dark"): ThemeColors {
  if (theme === "light") {
    return {
      border: RF_LIGHT_BORDER,
      textPrimary: RF_LIGHT_TEXT_PRIMARY,
      textSecondary: RF_LIGHT_TEXT_SECONDARY,
      textMuted: RF_LIGHT_TEXT_MUTED,
      accent: "#2e7d32",
      accentText: "#ffffff",
      miniBtnBg: "#ffffff",
    };
  }
  return {
    border: RF_BORDER,
    textPrimary: RF_TEXT_PRIMARY,
    textSecondary: RF_TEXT_SECONDARY,
    textMuted: RF_TEXT_MUTED,
    accent: "#92ff00",
    accentText: "#0b2210",
    miniBtnBg: "rgba(6,13,8,0.55)",
  };
}

function clampEspera(v: number): number {
  if (!Number.isFinite(v)) return 5;
  return Math.min(525_600, Math.max(1, Math.floor(v)));
}

export type FollowupEsperaMinutosFieldProps = {
  posicao: number;
  esperaMinutos: number;
  disabled?: boolean;
  theme?: "light" | "dark";
  compact?: boolean;
  onChange: (minutos: number) => void;
};

export function FollowupEsperaMinutosField({
  posicao,
  esperaMinutos,
  disabled,
  theme = "light",
  compact,
  onChange,
}: FollowupEsperaMinutosFieldProps) {
  const colors = themeColors(theme);
  const labelStyle = theme === "light" ? RF_LIGHT_LABEL_STYLE : rfLabelStyle();
  const inputStyle = theme === "light" ? RF_LIGHT_INPUT_STYLE : rfInputStyle();
  const indice = Math.max(0, posicao - 1);
  const espera = clampEspera(esperaMinutos);

  function apply(minutos: number) {
    onChange(clampEspera(minutos));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 8 }}>
      <label>
        <span style={labelStyle}>
          {posicao === 1 ? "Minutos sem resposta do cliente" : "Minutos após o passo anterior"}
        </span>
        <input
          type="number"
          min={1}
          max={525600}
          disabled={disabled}
          value={espera}
          onChange={(e) => apply(Number.parseInt(e.target.value, 10) || 1)}
          style={inputStyle}
        />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {FOLLOWUP_ESPERA_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => apply(preset)}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              background: espera === preset ? colors.accent : colors.miniBtnBg,
              color: espera === preset ? colors.accentText : colors.textSecondary,
              fontSize: 10,
              fontWeight: 700,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {formatarEsperaMinutos(preset, indice)}
          </button>
        ))}
      </div>
      {!compact ? (
        <p style={{ margin: 0, fontSize: 10, color: colors.textSecondary, lineHeight: 1.4 }}>
          {posicao === 1 ? (
            <>
              Envia após <strong style={{ color: colors.accent }}>{formatarEsperaMinutos(espera, 0)}</strong>{" "}
              sem mensagem do cliente.
            </>
          ) : (
            <>
              Envia <strong style={{ color: colors.accent }}>{formatarEsperaMinutos(espera, indice)}</strong>{" "}
              depois do passo anterior.
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

export function patchEsperaMinutos(minutos: number): {
  espera_minutos: number;
  atraso_dias: number;
  atraso_horas: number;
  atraso_minutos: number;
} {
  const m = clampEspera(minutos);
  const leg = minutosToLegacyAtraso(m);
  return {
    espera_minutos: m,
    atraso_dias: leg.atraso_dias,
    atraso_horas: leg.atraso_horas,
    atraso_minutos: leg.atraso_minutos,
  };
}
