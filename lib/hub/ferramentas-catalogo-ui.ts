import type { HubAgenteFerramentaId } from "@/lib/hub/agente-ferramentas-registry";
import type { HubFerramentaCustomRow } from "@/lib/hub/ferramentas-custom-db";
import type { HubFerramentaExternaRow } from "@/lib/hub/fetch-hub-ferramentas-externas";

export type FerramentaCatalogoTipo = "builtin" | "custom" | "externa";

export type FerramentaCatalogoRowBuiltin = {
  tipo: "builtin";
  id: HubAgenteFerramentaId;
  titulo: string;
  descricao: string;
  functionName: string;
  politica: "leitura" | "escrita";
  categoria: string;
  ativo: true;
};

export type FerramentaCatalogoRowCustom = {
  tipo: "custom";
  id: string;
  ferramenta_key: string;
  titulo: string;
  descricao_curta: string | null;
  descricao_modelo: string;
  builtin_impl: string;
  politica: "leitura" | "escrita";
  ativo: boolean;
};

export type FerramentaCatalogoRowExterna = {
  tipo: "externa";
  id: string;
  ferramenta_key: string;
  titulo: string;
  descricao_curta: string | null;
  descricao_modelo: string;
  integracao_id: string;
  metodo_http: string;
  url_template: string;
  politica: "leitura" | "escrita";
  ativo: boolean;
};

export type FerramentaCatalogoRow =
  | FerramentaCatalogoRowBuiltin
  | FerramentaCatalogoRowCustom
  | FerramentaCatalogoRowExterna;

export const FERRAMENTAS_LIGHT = {
  page: "#f8fcf6",
  surface: "#ffffff",
  border: "#dcebd8",
  text: "#0b2210",
  muted: "#5d7a67",
  faint: "#6e7681",
  accent: "#c9a24a",
  accentMuted: "#eef7eb",
  ok: "#22c55e",
  danger: "#f85149",
  link: "#0f6b4f",
} as const;

export function tipoFerramentaLabel(tipo: FerramentaCatalogoTipo): string {
  if (tipo === "builtin") return "Built-in";
  if (tipo === "custom") return "Custom";
  return "Externa";
}

export function politicaLabel(politica: "leitura" | "escrita"): string {
  return politica === "escrita" ? "Escrita" : "Só leitura";
}

export function execucaoLabel(row: FerramentaCatalogoRow): string {
  if (row.tipo === "builtin") return row.functionName;
  if (row.tipo === "custom") return row.builtin_impl;
  return `${row.integracao_id} · ${row.metodo_http}`;
}

export function externaRowToCatalogo(row: HubFerramentaExternaRow): FerramentaCatalogoRowExterna {
  return {
    tipo: "externa",
    id: row.id,
    ferramenta_key: row.ferramenta_key,
    titulo: row.titulo,
    descricao_curta: row.descricao_curta ?? null,
    descricao_modelo: row.descricao_modelo,
    integracao_id: row.integracao_id,
    metodo_http: row.metodo_http,
    url_template: row.url_template,
    politica: row.politica,
    ativo: row.ativo !== false,
  };
}

export function customRowToCatalogo(
  row: HubFerramentaCustomRow,
  politica: "leitura" | "escrita" = "leitura"
): FerramentaCatalogoRowCustom {
  return {
    tipo: "custom",
    id: row.id,
    ferramenta_key: row.ferramenta_key,
    titulo: row.titulo,
    descricao_curta: row.descricao_curta ?? null,
    descricao_modelo: row.descricao_modelo,
    builtin_impl: row.builtin_impl,
    politica,
    ativo: row.ativo !== false,
  };
}

export function catalogoRowKey(row: FerramentaCatalogoRow): string {
  if (row.tipo === "builtin") return row.id;
  return row.ferramenta_key;
}
