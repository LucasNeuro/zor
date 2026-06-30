import type { IntegracaoMarcaIconVariant } from "@/components/crm/IntegracaoMarcaIcon";
import {
  ferramentaIntegradorPorKey,
  HUB_INTEGRADORES_CATALOGO,
  type HubIntegradorId,
} from "@/lib/hub/integradores-catalogo";

export type CatalogoFerramentaIntegradorLite = {
  ferramenta_key: string;
  titulo: string;
  integrador_nome: string;
  integrador_id?: HubIntegradorId;
  politica: string;
  descricao_curta?: string | null;
  requerConexao?: boolean;
  emBreve?: boolean;
};

export function integradorMarcaIconVariant(
  ferramentaKey: string,
  integradorId?: string | null
): IntegracaoMarcaIconVariant | null {
  const id =
    (integradorId as HubIntegradorId | undefined) ??
    ferramentaIntegradorPorKey(ferramentaKey)?.integrador.id;

  if (id === "gmail") return "gmail";
  if (id === "google_calendar") return "google-calendar";
  if (id === "google_docs") return "google";
  if (id === "mem0") return "mem0";
  if (id === "mistral") return "mistral";

  if (ferramentaKey.startsWith("hub_int_gcal_")) return "google-calendar";
  if (ferramentaKey.startsWith("hub_int_gmail_")) return "gmail";
  if (ferramentaKey.startsWith("hub_int_mem0_")) return "mem0";
  if (ferramentaKey === "hub_mistral_percepcao") return "mistral";

  return null;
}

/** Catálogo completo de ferramentas de integradores (ligadas ou pendentes de OAuth). */
export function buildCatalogoIntegradorFerramentasCompleto(
  conexoes: Record<string, { configurado?: boolean; plataforma_ok?: boolean }> = {},
  opts?: { incluirEmBreve?: boolean }
): CatalogoFerramentaIntegradorLite[] {
  const lista: CatalogoFerramentaIntegradorLite[] = [];
  for (const entry of HUB_INTEGRADORES_CATALOGO) {
    if (entry.emBreve && !opts?.incluirEmBreve) continue;
    const cx = conexoes[entry.id];
    const ligado = cx?.configurado === true || (entry.id === "mistral" && cx?.plataforma_ok === true);
    for (const f of entry.ferramentas) {
      if (f.exportarMistral === false) continue;
      lista.push({
        ferramenta_key: f.ferramenta_key,
        titulo: f.titulo,
        integrador_nome: entry.nome,
        integrador_id: entry.id,
        politica: f.politica,
        descricao_curta: f.descricao_curta ?? null,
        requerConexao: !ligado && !entry.emBreve,
        emBreve: entry.emBreve,
      });
    }
  }
  return lista;
}
