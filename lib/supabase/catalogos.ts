import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type CargoCatalogo = {
  slug: string;
  titulo: string;
  area: string;
  nivel: number;
  modelo_padrao: string;
  modelo_critico: string;
  modelo_alto_valor: string;
  supervisor_slug: string | null;
  pode_fazer_padrao: string[];
  nao_pode_fazer_padrao: string[];
  prompt_template: string;
  limite_autonomia_brl: number;
  descricao: string;
};

export type PerfilPersonalidade = {
  id: number;
  humor: string;
  personalidade: string;
  tom_comunicacao: string;
  estilo_trabalho: string;
  comportamento_alerta: string;
  comportamento_comemoracao: string;
  frase_trabalhando: string;
  frase_alerta: string;
  frase_comemorando: string;
  prompt_fragmento: string;
};

export type MercadoCatalogo = {
  sigla: string;
  nome: string;
  descricao: string;
  cor: string;
};

export async function fetchCargosCatalogo(): Promise<CargoCatalogo[]> {
  const { data } = await sb()
    .from("hub_cargos_catalogo")
    .select("*")
    .eq("ativo", true)
    .order("nivel", { ascending: true })
    .order("titulo");
  return (data || []) as CargoCatalogo[];
}

export async function fetchPerfisPersonalidade(): Promise<PerfilPersonalidade[]> {
  const { data } = await sb()
    .from("hub_perfis_personalidade")
    .select("*")
    .order("humor")
    .order("personalidade");
  return (data || []) as PerfilPersonalidade[];
}

export async function fetchMercados(): Promise<MercadoCatalogo[]> {
  const { data } = await sb()
    .from("hub_mercados")
    .select("sigla, nome, descricao, cor")
    .eq("ativo", true)
    .order("sigla");
  return (data || []) as MercadoCatalogo[];
}

export async function fetchCargoPorSlug(slug: string): Promise<CargoCatalogo | null> {
  const { data } = await sb()
    .from("hub_cargos_catalogo")
    .select("*")
    .eq("slug", slug)
    .single();
  return (data || null) as CargoCatalogo | null;
}

export async function fetchPerfilPorCombinacao(humor: string, personalidade: string): Promise<PerfilPersonalidade | null> {
  const { data } = await sb()
    .from("hub_perfis_personalidade")
    .select("*")
    .eq("humor", humor)
    .eq("personalidade", personalidade)
    .single();
  return (data || null) as PerfilPersonalidade | null;
}
