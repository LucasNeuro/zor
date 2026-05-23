import type { SupabaseClient } from "@supabase/supabase-js";

export type CargoCatalogoAgente = {
  slug: string;
  titulo: string;
  saudacao_cliente?: string | null;
  usar_perguntas_essenciais?: boolean | null;
  ordem_perguntas_essenciais?: string | null;
  perguntas_essenciais?: unknown;
  comprimento_padrao?: string | null;
};

const CARGO_SELECT =
  "slug,titulo,saudacao_cliente,usar_perguntas_essenciais,ordem_perguntas_essenciais,perguntas_essenciais,comprimento_padrao";

function normalizarTitulo(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function slugifyTitulo(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Resolve hub_cargos_catalogo a partir do titulo gravado em hub_agente_identidade.cargo. */
export async function resolverCargoCatalogoParaAgente(
  supabase: SupabaseClient,
  agenteOrTitulo: string | { cargo?: string | null }
): Promise<CargoCatalogoAgente | null> {
  const tituloAgente =
    typeof agenteOrTitulo === "string"
      ? agenteOrTitulo.trim()
      : String(agenteOrTitulo.cargo ?? "").trim();
  if (!tituloAgente) return null;

  const { data: exact } = await supabase
    .from("hub_cargos_catalogo")
    .select(CARGO_SELECT)
    .eq("titulo", tituloAgente)
    .eq("ativo", true)
    .maybeSingle();
  if (exact) return exact as CargoCatalogoAgente;

  const { data: porSlug } = await supabase
    .from("hub_cargos_catalogo")
    .select(CARGO_SELECT)
    .eq("slug", slugifyTitulo(tituloAgente))
    .eq("ativo", true)
    .maybeSingle();
  if (porSlug) return porSlug as CargoCatalogoAgente;

  const { data: ilike } = await supabase
    .from("hub_cargos_catalogo")
    .select(CARGO_SELECT)
    .ilike("titulo", tituloAgente)
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();
  if (ilike) return ilike as CargoCatalogoAgente;

  const { data: todos } = await supabase
    .from("hub_cargos_catalogo")
    .select(CARGO_SELECT)
    .eq("ativo", true);
  if (!todos?.length) return null;

  const alvo = normalizarTitulo(tituloAgente);
  const match = todos.find((c) => normalizarTitulo(String(c.titulo ?? "")) === alvo);
  return (match as CargoCatalogoAgente | undefined) ?? null;
}
