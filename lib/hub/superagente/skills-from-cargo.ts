import type { SuperagenteSkill } from "@/lib/hub/superagente/types";

function slugSkill(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

const PACOTE_BASE: SuperagenteSkill = {
  id: "jarvis_operacoes",
  titulo: "Jarvis operacional",
  descricao: "Consultar e actuar sobre dados reais da empresa (CRM, financeiro, KPIs).",
  ferramentas_sugeridas: [
    "hub_superagente_dados",
    "hub_operacao_empresa",
    "hub_dados_empresa",
    "hub_metricas_escritorio",
  ],
};

const PACOTE_RELATORIOS: SuperagenteSkill = {
  id: "artefatos_relatorios",
  titulo: "Relatórios e canvas",
  descricao: "Dashboard HTML (KPIs, gráficos multi-cor, tabelas) com link público — um canvas por pedido.",
  ferramentas_sugeridas: ["hub_superagente_artefato"],
};

const PACOTE_MULTIMODAL: SuperagenteSkill = {
  id: "percepcao_multimodal",
  titulo: "OCR, áudio e visão",
  descricao: "Transcrever áudio, extrair texto de PDF/imagem e analisar conteúdo visual via Mistral.",
  ferramentas_sugeridas: ["hub_mistral_percepcao"],
};

/** Cargo/área → skills do harness (cargo é seed, skills são o contrato operacional). */
export function gerarSkillsSuperagenteFromCargo(
  cargo?: string | null,
  area?: string | null
): SuperagenteSkill[] {
  const t = [cargo, area]
    .map((v) => String(v ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");

  const skills: SuperagenteSkill[] = [PACOTE_BASE, PACOTE_RELATORIOS, PACOTE_MULTIMODAL];

  if (/financ|cfo|contab|fluxo|caixa|dre/.test(t)) {
    skills.push({
      id: slugSkill("financeiro_analise") || "financeiro",
      titulo: "Análise financeira",
      descricao: "Fluxo de caixa, contas a pagar/receber, KPIs e relatórios executivos.",
      ferramentas_sugeridas: ["hub_superagente_dados", "hub_superagente_artefato"],
    });
  }

  if (/crm|comercial|vendas|sdr|pipeline|leads/.test(t)) {
    skills.push({
      id: slugSkill("crm_pipeline") || "crm",
      titulo: "Pipeline e leads",
      descricao: "Enriquecimento de leads, negócios, atividades e conversas.",
      ferramentas_sugeridas: ["hub_superagente_dados", "hub_operacao_empresa"],
    });
  }

  if (/marketing|trafego|campanha|conteudo/.test(t)) {
    skills.push({
      id: slugSkill("marketing_ops") || "marketing",
      titulo: "Marketing e tráfego",
      descricao: "Métricas de campanha, conhecimento RAG e criativos.",
      ferramentas_sugeridas: ["hub_superagente_dados", "hub_mistral_percepcao"],
    });
  }

  if (/jurid|legal|contrato/.test(t)) {
    skills.push({
      id: slugSkill("juridico_docs") || "juridico",
      titulo: "Documentos e compliance",
      descricao: "OCR de contratos e análise estruturada de documentos.",
      ferramentas_sugeridas: ["hub_mistral_percepcao", "hub_superagente_artefato"],
    });
  }

  const seen = new Set<string>();
  return skills.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

/** Alinha ferramentas sugeridas das skills com o pacote activo no wizard/agente. */
export function ajustarSkillsPorFerramentasAtivas(
  skills: SuperagenteSkill[],
  uso: Partial<Record<string, boolean>>
): SuperagenteSkill[] {
  const ativas = new Set(
    Object.entries(uso)
      .filter(([, v]) => v === true)
      .map(([k]) => k)
  );
  if (!ativas.size) return skills;

  return skills.map((s) => ({
    ...s,
    ferramentas_sugeridas: s.ferramentas_sugeridas.filter(
      (f) => ativas.has(f) || f.startsWith("harness_")
    ),
  }));
}

export function formatarBlocoSkillsHarness(skills: SuperagenteSkill[]): string {
  if (!skills.length) return "";
  const linhas = skills.map(
    (s) =>
      `- **${s.titulo}** (\`${s.id}\`): ${s.descricao} Ferramentas: ${s.ferramentas_sugeridas.join(", ")}.`
  );
  return [
    "═══ HARNESS SUPERAGENTE (skills derivadas do cargo) ═══",
    "Actue como superagente autónomo: planeie, use ferramentas, gere artefactos partilháveis.",
    "Skills activas:",
    ...linhas,
  ].join("\n");
}
