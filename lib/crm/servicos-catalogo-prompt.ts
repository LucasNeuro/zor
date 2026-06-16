import type { ServicoCatalogoRow } from "@/lib/crm/servicos-catalogo";

function formatarMoeda(valor: number, moeda: string): string {
  const m = (moeda || "BRL").toUpperCase();
  if (m === "BRL") {
    return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${m} ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Formata catálogo de serviços/preços para injeção no system prompt do agente. */
export function formatarServicosCatalogoParaPrompt(rows: ServicoCatalogoRow[]): string {
  if (!rows.length) return "";

  const linhas = rows.slice(0, 40).map((r) => {
    const nome = r.nome.trim();
    const desc = r.descricao?.trim();
    const preco =
      r.preco_referencia != null && Number.isFinite(Number(r.preco_referencia))
        ? formatarMoeda(Number(r.preco_referencia), r.moeda)
        : null;
    const tipo = r.tipo?.trim();
    const partes = [`• ${nome}`];
    if (preco) partes.push(`— ${preco}`);
    if (tipo && tipo !== "servico") partes.push(`(${tipo})`);
    if (desc) partes.push(`— ${desc.slice(0, 120)}`);
    return partes.join(" ");
  });

  return linhas.join("\n");
}
