import type { HubAgenteFerramentaId } from "@/lib/hub/agente-ferramentas-registry";
import type { HubFerramentaCustomRow } from "@/lib/hub/ferramentas-custom-db";

/** Agente com ferramenta activa — usado nos sideovers builtin/custom. */
export type FerramentaAgenteUso = {
  agente_slug: string;
  nome?: string | null;
};

export type HubFerramentaCustomForm = {
  titulo: string;
  slug_curto: string;
  descricao_curta: string;
  descricao_modelo: string;
  builtin_impl: string;
  smart_provider: string;
  smart_model: string;
  smart_prompt: string;
  ativo: boolean;
};

export function slugCurtoFromKey(key: string): string {
  const k = String(key || "");
  return k.startsWith("hub_custom_") ? k.slice("hub_custom_".length) : k;
}

export function emptyFerramentaCustomForm(): HubFerramentaCustomForm {
  return {
    titulo: "",
    slug_curto: "",
    descricao_curta: "",
    descricao_modelo: "",
    builtin_impl: "hub_lead_resumo",
    smart_provider: "none",
    smart_model: "",
    smart_prompt: "",
    ativo: true,
  };
}

export function ferramentaCustomRowToForm(row: HubFerramentaCustomRow): HubFerramentaCustomForm {
  return {
    titulo: String(row.titulo || ""),
    slug_curto: slugCurtoFromKey(row.ferramenta_key),
    descricao_curta: row.descricao_curta != null ? String(row.descricao_curta) : "",
    descricao_modelo: String(row.descricao_modelo || ""),
    builtin_impl: String(row.builtin_impl || "hub_lead_resumo"),
    smart_provider: String(row.smart_provider || "none"),
    smart_model: row.smart_model != null ? String(row.smart_model) : "",
    smart_prompt: row.smart_prompt != null ? String(row.smart_prompt) : "",
    ativo: row.ativo !== false,
  };
}

export type FerramentaCustomSideoverMode = "view" | "edit" | "create";

export type FerramentaBuiltinSideoverProps = {
  open: boolean;
  onClose: () => void;
  ferramentaId: HubAgenteFerramentaId | null;
  agentes: FerramentaAgenteUso[];
};

export type FerramentaCustomSideoverProps = {
  open: boolean;
  onClose: () => void;
  mode: FerramentaCustomSideoverMode;
  row: HubFerramentaCustomRow | null;
  onSaved?: (row: HubFerramentaCustomRow) => void;
  onDeleted?: (id: string) => void;
  /** Chamado ao clicar «Editar» em modo view (o pai deve mudar mode para edit). */
  onRequestEdit?: () => void;
};
