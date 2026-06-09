"use client";

import {
  AGENTE_PERSONALIDADE_EIXOS,
  gerarPersonalidadeAgente,
} from "@/lib/hub/agente-personalidade-eixos";
import { RF } from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  valores: number[];
  onChange: (index: number, value: number) => void;
  /** Mostra o bloco markdown gerado (wizard). */
  mostrarResultado?: boolean;
  theme?: "light" | "dark";
};

function rotulosEixo(nome: string): { esquerda: string; direita: string } {
  const partes = nome.split("/").map((p) => p.trim());
  if (partes.length >= 2) {
    return { esquerda: partes[0], direita: partes[partes.length - 1] };
  }
  return { esquerda: nome, direita: "" };
}

export function AgentePersonalidadeEixosPanel({
  valores,
  onChange,
  mostrarResultado = true,
  theme = "light",
}: Props) {
  const textoGerado = gerarPersonalidadeAgente(valores);
  const dark = theme === "dark";
  const tituloCor = dark ? RF.texto : "#0b2210";
  const mutedCor = dark ? RF.texto3 : "#4a6356";
  const fraseCor = dark ? RF.texto2 : "#2d4a38";
  const accentCor = dark ? RF.limao : "#2d6a4f";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {AGENTE_PERSONALIDADE_EIXOS.map((eixo, i) => {
        const v = valores[i] ?? 3;
        const { esquerda, direita } = rotulosEixo(eixo.nome);
        const frase = eixo.frases[Math.min(4, Math.max(0, v - 1))];

        return (
          <div key={eixo.nome} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: tituloCor }}>{eixo.nome}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: accentCor,
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}
              >
                {v}/5
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 10,
                fontWeight: 600,
                color: mutedCor,
              }}
            >
              <span>{esquerda}</span>
              <span style={{ textAlign: "right" }}>{direita}</span>
            </div>

            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={v}
              onChange={(e) => onChange(i, Number.parseInt(e.target.value, 10))}
              aria-label={`${eixo.nome}: ${v} de 5`}
              style={{
                width: "100%",
                height: 6,
                accentColor: accentCor,
                cursor: "pointer",
              }}
            />

            <p
              style={{
                margin: 0,
                fontSize: 11,
                lineHeight: 1.5,
                color: fraseCor,
                padding: "8px 10px",
                borderRadius: 8,
                background: dark ? "rgba(11, 31, 16, 0.72)" : "#eef7eb",
                border: `1px solid ${dark ? RF.borda : "#dcebd8"}`,
              }}
            >
              {frase}
            </p>
          </div>
        );
      })}

      {mostrarResultado ? (
        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: dark ? RF.limao : "#5d7a67",
              display: "block",
              marginBottom: 8,
            }}
          >
            RESULTADO (vai para o prompt do agente)
          </label>
          <pre
            style={{
              background: "#0b1f10",
              border: "1px solid #1e3a2f",
              borderRadius: 8,
              padding: 12,
              color: "#e8f5e9",
              fontSize: 11,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              margin: 0,
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
            }}
          >
            {textoGerado}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
