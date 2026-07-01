import { isUrlArtefatoApp } from "@/lib/hub/superagente/artefato-public-url";

/** Uma entrega de canvas: 1 URL, texto curto, sem duplicar relatório no chat. */
export function normalizarEntregaArtefacto(
  texto: string,
  urls: string[] | undefined
): { texto: string; urls_publicas?: string[] } {
  const lista = [...new Set((urls ?? []).filter(Boolean))];
  const artefatos = lista.filter((u) => isUrlArtefatoApp(u));
  if (!artefatos.length) {
    return { texto, urls_publicas: lista.length ? lista : undefined };
  }

  const principal = artefatos[0]!;
  const textoCurto = `📊 Relatório interativo:\n${principal}`;

  return {
    texto: textoCurto,
    urls_publicas: [principal],
  };
}
