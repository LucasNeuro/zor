"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, X } from "lucide-react";
import {
  PARCEIRO_LINK_TOKEN_REDE,
  urlCadastroParceiroPublico,
} from "@/lib/crm/parceiro-link-publico";

const OB = {
  borda: "var(--obra-borda, #dcebd8)",
  texto: "var(--obra-texto, #0b2210)",
  texto2: "var(--obra-texto-2, #5d7a67)",
  dourado: "var(--obra-dourado, #c9a24a)",
  panel: "#0f1620",
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ParceiroLinkWizard({ open, onClose }: Props) {
  const [link, setLink] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLink(urlCadastroParceiroPublico());
    setCopiado(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function copiar() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 220,
          background: "rgba(0,0,0,0.55)",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(480px, 100vw)",
          zIndex: 221,
          background: OB.panel,
          borderLeft: `1px solid ${OB.borda}`,
          boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div
          style={{
            borderBottom: `1px solid ${OB.borda}`,
            padding: 16,
            background: "linear-gradient(180deg,#121a26 0%, #101722 100%)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: OB.texto }}>
                Link da rede de parceiros
              </h3>
              <p style={{ margin: "8px 0 0", color: OB.texto2, fontSize: 12, lineHeight: 1.45 }}>
                Um único link para todos. Cada inscrição gera um código único (ex.: PAR-2026-0001).
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                border: `1px solid ${OB.borda}`,
                background: "#1d2633",
                color: OB.texto2,
                borderRadius: 8,
                width: 34,
                height: 34,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <div
            style={{
              background: "rgba(201, 162, 74, 0.08)",
              border: "1px solid rgba(201, 162, 74, 0.35)",
              borderRadius: 12,
              padding: 16,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            <Link2 size={28} style={{ color: OB.dourado, marginBottom: 8 }} />
            <p style={{ color: OB.texto, fontWeight: 700, fontSize: 14, margin: "0 0 6px" }}>
              Link permanente da rede
            </p>
            <p style={{ color: OB.texto2, fontSize: 11, margin: 0, lineHeight: 1.45 }}>
              O parceiro escolhe PF/PJ, mercado, perfil e dados no formulário. Não é preciso gerar
              um link por pessoa.
            </p>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: `1px solid ${OB.borda}`,
              borderRadius: 12,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <p style={{ color: OB.texto2, fontSize: 10, fontWeight: 600, margin: "0 0 8px" }}>
              URL para partilhar
            </p>
            <p
              style={{
                color: OB.texto,
                fontSize: 12,
                wordBreak: "break-all",
                margin: 0,
                fontFamily: "monospace",
              }}
            >
              {link}
            </p>
            <p style={{ color: "#6e7781", fontSize: 10, margin: "10px 0 0" }}>
              Token: <code>{PARCEIRO_LINK_TOKEN_REDE}</code>
            </p>
          </div>

          <button
            type="button"
            onClick={() => void copiar()}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 10,
              border: `1px solid rgba(201, 162, 74, 0.4)`,
              background: "rgba(201, 162, 74, 0.12)",
              color: OB.dourado,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Copy size={16} />
            {copiado ? "Copiado!" : "Copiar link"}
          </button>
        </div>

        <div
          style={{
            padding: "14px 20px",
            borderTop: `1px solid ${OB.borda}`,
            flexShrink: 0,
            background: "#f8fcf6",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 8,
              border: `1px solid ${OB.borda}`,
              background: "transparent",
              color: OB.texto2,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Fechar
          </button>
        </div>
      </aside>
    </>
  );
}
