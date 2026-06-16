"use client";

import {
  RF_ACCENT,
  RF_BORDER_STRONG,
  RF_INPUT_STYLE,
  RF_LIGHT_BORDER,
  RF_LIGHT_BORDER_STRONG,
  RF_LIGHT_INPUT_STYLE,
  RF_LIGHT_PANEL,
  RF_LIGHT_TEXT_MUTED,
  RF_LIGHT_TEXT_SECONDARY,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  type CrmSideoverTheme,
} from "@/lib/crm/crm-retrofit-dark-theme";

export type CrmNota = {
  id: string;
  conteudo: string;
  criado_por: string;
  criado_em: string;
};

type Props = {
  notas: CrmNota[];
  novaNota: string;
  onNovaNotaChange: (value: string) => void;
  onAdicionar: () => void | Promise<void>;
  adicionando?: boolean;
  /** @deprecated use theme */
  variant?: "sideover" | "waje";
  theme?: CrmSideoverTheme;
};

function tempo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function resolveLight(props: Props): boolean {
  if (props.theme === "light") return true;
  if (props.theme === "dark") return false;
  return props.variant === "waje";
}

/** Aba de observações reutilizável (leads e negócios). */
export function LeadObservacoesTab(props: Props) {
  const {
    notas,
    novaNota,
    onNovaNotaChange,
    onAdicionar,
    adicionando,
  } = props;
  const isLight = resolveLight(props);

  if (isLight) {
    return (
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: RF_LIGHT_BORDER_STRONG,
          background: RF_LIGHT_PANEL,
          boxShadow: "0 1px 3px rgba(11, 34, 16, 0.06)",
        }}
      >
        <textarea
          value={novaNota}
          onChange={(e) => onNovaNotaChange(e.target.value)}
          placeholder="Escreva uma observação…"
          rows={3}
          className="mb-3 w-full resize-y rounded-xl border p-3 text-sm font-medium outline-none placeholder:text-[#9ca3af] focus:border-[#86efac]"
          style={{
            ...RF_LIGHT_INPUT_STYLE,
            borderRadius: 10,
            color: "#111827",
          }}
        />
        <button
          type="button"
          onClick={() => void onAdicionar()}
          disabled={!novaNota.trim() || adicionando}
          className="mb-4 w-full rounded-xl border-0 py-2.5 text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: RF_ACCENT, color: "#0b1f10" }}
        >
          {adicionando ? "A guardar…" : "+ Adicionar observação"}
        </button>
        {notas.length === 0 ? (
          <p
            className="py-4 text-center text-sm"
            style={{ color: RF_LIGHT_TEXT_MUTED }}
          >
            Nenhuma observação ainda
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {notas.map((n) => (
              <li
                key={n.id}
                className="rounded-xl border p-3"
                style={{
                  borderColor: RF_LIGHT_BORDER,
                  background: "#ffffff",
                }}
              >
                <p
                  className="m-0 whitespace-pre-wrap text-sm font-medium leading-relaxed"
                  style={{ color: "#111827" }}
                >
                  {n.conteudo}
                </p>
                <div
                  className="mt-2 text-xs font-semibold"
                  style={{ color: RF_LIGHT_TEXT_SECONDARY }}
                >
                  {n.criado_por} · {tempo(n.criado_em)} atrás
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const INPUT: React.CSSProperties = {
    ...RF_INPUT_STYLE,
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
  };

  return (
    <div>
      <textarea
        value={novaNota}
        onChange={(e) => onNovaNotaChange(e.target.value)}
        placeholder="Escreva uma observação…"
        rows={3}
        style={{ ...INPUT, width: "100%", resize: "vertical", marginBottom: 8 }}
      />
      <button
        type="button"
        onClick={() => void onAdicionar()}
        disabled={!novaNota.trim() || adicionando}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: 10,
          border: "none",
          background: RF_ACCENT,
          color: "#0b1f10",
          fontWeight: 800,
          fontSize: 13,
          cursor: novaNota.trim() && !adicionando ? "pointer" : "not-allowed",
          opacity: novaNota.trim() && !adicionando ? 1 : 0.5,
          marginBottom: 16,
        }}
      >
        {adicionando ? "A guardar…" : "+ Adicionar observação"}
      </button>
      {notas.length === 0 ? (
        <p style={{ color: RF_TEXT_MUTED, fontSize: 13, textAlign: "center" }}>
          Nenhuma observação ainda
        </p>
      ) : (
        notas.map((n) => (
          <div
            key={n.id}
            style={{
              background: "rgba(18,56,43,0.15)",
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
              border: `1px solid ${RF_BORDER_STRONG}`,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: RF_TEXT_PRIMARY, lineHeight: 1.5 }}>
              {n.conteudo}
            </p>
            <div style={{ marginTop: 8, fontSize: 11, color: RF_TEXT_MUTED }}>
              {n.criado_por} · {tempo(n.criado_em)} atrás
            </div>
          </div>
        ))
      )}
    </div>
  );
}
