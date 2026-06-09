import type { CSSProperties, ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  RF_ACCENT,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

function actionBtnStyle(destructive = false): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 16px",
    borderRadius: 8,
    border: destructive ? "1px solid rgba(248, 81, 73, 0.45)" : `1px solid ${RF_BORDER_STRONG}`,
    background: destructive ? "rgba(248, 81, 73, 0.1)" : "rgba(18, 56, 43, 0.2)",
    color: destructive ? "#f85149" : RF_TEXT_PRIMARY,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  };
}

type ViewProps = {
  mode: "view";
  onEdit: () => void;
  onDelete: () => void;
};

type EditProps = {
  mode: "edit";
  onBack: () => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
};

export function CadastroSideoverFooterActions(props: ViewProps | EditProps): ReactNode {
  if (props.mode === "view") {
    return (
      <>
        <button type="button" onClick={props.onEdit} style={actionBtnStyle()}>
          <Pencil size={16} /> Editar
        </button>
        <button type="button" onClick={props.onDelete} style={actionBtnStyle(true)}>
          <Trash2 size={16} /> Excluir
        </button>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={props.onBack}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          border: `1px solid ${RF_BORDER_STRONG}`,
          background: "transparent",
          color: RF_TEXT_MUTED,
          cursor: "pointer",
        }}
      >
        Voltar
      </button>
      <button
        type="button"
        onClick={props.onSave}
        disabled={props.saving}
        style={{
          padding: "10px 20px",
          borderRadius: 8,
          border: "none",
          background: RF_ACCENT,
          color: "#0b1f10",
          fontWeight: 700,
          cursor: props.saving ? "not-allowed" : "pointer",
          opacity: props.saving ? 0.65 : 1,
        }}
      >
        {props.saving ? "Salvando…" : props.saveLabel ?? "Guardar alterações"}
      </button>
    </>
  );
}
