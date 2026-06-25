/** Resolve origem/canal exibido no CRM (card, filtros, badges). */
export type LeadCanalExibicao = {
  origem: string;
  label: string;
  ehTeste: boolean;
};

function metaObj(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function tagsArray(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
}

export function leadEhSimulacaoOuTeste(lead: {
  origem?: string | null;
  metadata?: unknown;
  tags?: unknown;
}): boolean {
  const meta = metaObj(lead.metadata);
  const tags = tagsArray(lead.tags);
  const origem = String(lead.origem ?? "").toLowerCase();
  return (
    meta.simulacao_canal === true ||
    meta.eh_teste === true ||
    origem === "interno" ||
    origem === "simulacao_ia" ||
    tags.includes("teste") ||
    tags.includes("simulacao_canal") ||
    tags.includes("simulacao")
  );
}

export function leadCanalExibicao(lead: {
  origem?: string | null;
  metadata?: unknown;
  tags?: unknown;
}): LeadCanalExibicao {
  if (leadEhSimulacaoOuTeste(lead)) {
    return { origem: "interno", label: "Interno · teste", ehTeste: true };
  }

  const origem = String(lead.origem ?? "").trim() || "outro";
  const labels: Record<string, string> = {
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    meta_ads: "Meta Ads",
    google_ads: "Google Ads",
    linkedin: "LinkedIn",
    site: "Site",
    indicacao: "Indicação",
    email: "E-mail",
    outro: "Outro",
  };

  return {
    origem,
    label: labels[origem] ?? origem,
    ehTeste: false,
  };
}
