"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Minus, Search } from "lucide-react";
import {
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfInputStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { labelColunaRelatorio } from "@/lib/crm/relatorios-data";

type Props = {
  disponiveis: string[];
  recomendadas: string[];
  selecionadas: string[];
  onChange: (next: string[]) => void;
  loading?: boolean;
};

type PillId = "recomendadas" | "todas" | "nenhuma" | "inverter";

function PillButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors"
      style={{
        border: `1px solid ${active ? "rgba(146, 255, 0, 0.55)" : RF_BORDER}`,
        background: active ? "rgba(146, 255, 0, 0.12)" : "rgba(6, 13, 8, 0.6)",
        color: active ? "#92ff00" : RF_TEXT_SECONDARY,
      }}
    >
      {children}
    </button>
  );
}

function CheckboxVisual({
  checked,
  indeterminate,
}: {
  checked: boolean;
  indeterminate?: boolean;
}) {
  return (
    <span
      aria-hidden
      style={{
        width: 20,
        height: 20,
        borderRadius: 5,
        flexShrink: 0,
        border: `2px solid ${checked || indeterminate ? "#92ff00" : RF_BORDER}`,
        background: checked ? "#92ff00" : indeterminate ? "rgba(146, 255, 0, 0.25)" : "transparent",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#0b1f10",
      }}
    >
      {checked ? <Check size={13} strokeWidth={3} /> : indeterminate ? <Minus size={13} strokeWidth={3} /> : null}
    </span>
  );
}

export function CrmRelatorioColunasPicker({
  disponiveis,
  recomendadas,
  selecionadas,
  onChange,
  loading,
}: Props) {
  const [busca, setBusca] = useState("");
  const [pillAtiva, setPillAtiva] = useState<PillId | null>("recomendadas");

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return disponiveis;
    return disponiveis.filter((col) => {
      const label = labelColunaRelatorio(col).toLowerCase();
      return label.includes(q) || col.toLowerCase().includes(q);
    });
  }, [busca, disponiveis]);

  const recSet = useMemo(() => new Set(recomendadas), [recomendadas]);
  const selSet = useMemo(() => new Set(selecionadas), [selecionadas]);
  const nSel = selecionadas.length;
  const nTotal = disponiveis.length;
  const pct = nTotal > 0 ? Math.round((nSel / nTotal) * 100) : 0;

  const todasFiltradasMarcadas =
    filtradas.length > 0 && filtradas.every((c) => selSet.has(c));
  const algumasFiltradasMarcadas =
    filtradas.some((c) => selSet.has(c)) && !todasFiltradasMarcadas;
  const todasMarcadas = nTotal > 0 && nSel === nTotal;

  function toggle(col: string) {
    setPillAtiva(null);
    onChange(selSet.has(col) ? selecionadas.filter((c) => c !== col) : [...selecionadas, col]);
  }

  function toggleGrupoFiltrado() {
    setPillAtiva(null);
    const filtradasSet = new Set(filtradas);
    if (todasFiltradasMarcadas) {
      onChange(selecionadas.filter((c) => !filtradasSet.has(c)));
      return;
    }
    onChange([...new Set([...selecionadas, ...filtradas])]);
  }

  function aplicarPill(id: PillId) {
    setPillAtiva(id);
    if (id === "recomendadas") {
      onChange(recomendadas.filter((c) => disponiveis.includes(c)));
    } else if (id === "todas") {
      onChange([...disponiveis]);
    } else if (id === "nenhuma") {
      onChange([]);
    } else if (id === "inverter") {
      onChange(disponiveis.filter((c) => !selSet.has(c)));
    }
  }

  const labelGrupo =
    busca.trim() && filtradas.length !== nTotal
      ? `Selecionar ${filtradas.length} visíveis`
      : `Selecionar todas (${nTotal})`;

  return (
    <div className="flex flex-col gap-3">
      {/* Resumo + barra de progresso */}
      <div
        className="rounded-xl px-3 py-2.5"
        style={{ border: `1px solid ${RF_BORDER}`, background: "rgba(6, 13, 8, 0.72)" }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span style={{ color: RF_TEXT_SECONDARY, fontSize: 12 }}>
            <strong style={{ color: "#92ff00", fontSize: 15 }}>{nSel}</strong>
            <span style={{ color: RF_TEXT_MUTED }}> / {nTotal}</span> colunas na tabela
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              background: nSel === 0 ? "rgba(248,81,73,0.15)" : "rgba(146,255,0,0.12)",
              color: nSel === 0 ? "#f85149" : "#92ff00",
              border: `1px solid ${nSel === 0 ? "rgba(248,81,73,0.35)" : "rgba(146,255,0,0.35)"}`,
            }}
          >
            {nSel === 0 ? "Nenhuma" : todasMarcadas ? "Todas" : `${pct}%`}
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "rgba(63, 152, 72, 0.2)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: "#92ff00" }}
          />
        </div>
      </div>

      {/* Atalhos */}
      <div className="flex flex-wrap gap-2">
        <PillButton active={pillAtiva === "recomendadas"} onClick={() => aplicarPill("recomendadas")}>
          Recomendadas ({recomendadas.filter((c) => disponiveis.includes(c)).length})
        </PillButton>
        <PillButton active={pillAtiva === "todas"} onClick={() => aplicarPill("todas")}>
          Selecionar todas
        </PillButton>
        <PillButton active={pillAtiva === "nenhuma"} onClick={() => aplicarPill("nenhuma")}>
          Limpar
        </PillButton>
        <PillButton active={pillAtiva === "inverter"} onClick={() => aplicarPill("inverter")}>
          Inverter
        </PillButton>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search
          size={15}
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: RF_TEXT_MUTED,
            pointerEvents: "none",
          }}
        />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou campo (ex.: telefone, estagio)..."
          style={{ ...rfInputStyle(), paddingLeft: 36, paddingRight: 12 }}
        />
      </div>

      {loading ? (
        <p style={{ color: RF_TEXT_MUTED, fontSize: 12, padding: "8px 0" }}>A carregar colunas da view…</p>
      ) : disponiveis.length === 0 ? (
        <p style={{ color: RF_TEXT_MUTED, fontSize: 12 }}>Nenhuma coluna disponível.</p>
      ) : (
        <div
          className="overflow-hidden rounded-xl"
          style={{ border: `1px solid ${RF_BORDER_STRONG}`, background: "rgba(6,13,8,0.55)" }}
        >
          {/* Cabeçalho fixo — selecionar grupo */}
          <button
            type="button"
            onClick={toggleGrupoFiltrado}
            className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors hover:bg-[rgba(146,255,0,0.04)]"
            style={{ borderColor: RF_BORDER }}
          >
            <CheckboxVisual checked={todasFiltradasMarcadas} indeterminate={algumasFiltradasMarcadas} />
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", color: RF_TEXT_PRIMARY, fontSize: 12, fontWeight: 700 }}>
                {labelGrupo}
              </span>
              {busca.trim() ? (
                <span style={{ display: "block", color: RF_TEXT_MUTED, fontSize: 10, marginTop: 2 }}>
                  {filtradas.filter((c) => selSet.has(c)).length} de {filtradas.length} visíveis marcadas
                </span>
              ) : null}
            </span>
          </button>

          {filtradas.length === 0 ? (
            <p style={{ color: RF_TEXT_MUTED, fontSize: 12, padding: "12px 14px", margin: 0 }}>
              Nenhuma coluna corresponde a &quot;{busca}&quot;.
            </p>
          ) : (
            <div
              className="grid max-h-[min(320px,42vh)] grid-cols-1 gap-1 overflow-y-auto p-1.5 sm:grid-cols-2"
            >
              {filtradas.map((col) => {
                const active = selSet.has(col);
                const isRec = recSet.has(col);
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => toggle(col)}
                    className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors"
                    style={{
                      border: `1px solid ${active ? "rgba(63, 152, 72, 0.5)" : "transparent"}`,
                      background: active ? "rgba(146, 255, 0, 0.08)" : "rgba(6,13,8,0.4)",
                    }}
                  >
                    <CheckboxVisual checked={active} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          color: active ? RF_TEXT_PRIMARY : "#c8e6c9",
                          fontSize: 12,
                          fontWeight: 600,
                          lineHeight: 1.3,
                        }}
                      >
                        {labelColunaRelatorio(col)}
                      </span>
                      <span
                        style={{
                          display: "block",
                          color: RF_TEXT_MUTED,
                          fontSize: 9,
                          marginTop: 2,
                          fontFamily: "ui-monospace, monospace",
                          lineHeight: 1.3,
                          wordBreak: "break-all",
                        }}
                      >
                        {col}
                      </span>
                      {isRec ? (
                        <span
                          className="mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold"
                          style={{
                            background: "rgba(146,255,0,0.1)",
                            color: "rgba(146,255,0,0.9)",
                            border: "1px solid rgba(146,255,0,0.25)",
                          }}
                        >
                          Recomendada
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p style={{ color: RF_TEXT_MUTED, fontSize: 10, margin: 0, lineHeight: 1.5 }}>
        Marque as colunas que quer ver na tabela. Use <strong style={{ color: RF_TEXT_SECONDARY }}>Selecionar todas</strong>{" "}
        ou o cabeçalho da lista para marcar o grupo filtrado. Larguras ajustáveis depois de criar o relatório.
      </p>
    </div>
  );
}
