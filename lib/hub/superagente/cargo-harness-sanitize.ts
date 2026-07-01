/**
 * Normaliza bullets do catálogo hub_cargos_catalogo para harness interno.
 * Remove contradições com CRUD CRM e ruído de plataforma multi-tenant.
 */

function linhasArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

/** Junta fragmentos partidos no meio da frase (ex.: "leads ativos" + "taxa de conversão"). */
export function normalizarBulletsCargo(raw: unknown): string[] {
  const items = linhasArray(raw);
  if (!items.length) return [];

  const merged: string[] = [];
  let buf = "";

  for (const item of items) {
    if (!buf) {
      buf = item;
      continue;
    }
    const bufEnds = /[.!?;:]$/.test(buf);
    const itemStartsLower = /^[a-záàâãéêíóôõúç0-9]/.test(item);
    if (!bufEnds && itemStartsLower && buf.length < 140) {
      buf = `${buf} ${item}`;
    } else {
      merged.push(buf);
      buf = item;
    }
  }
  if (buf) merged.push(buf);
  return merged;
}

const NAO_PODE_CONTRADIZ_CRM: RegExp[] = [
  /modificar dados/i,
  /sem (autoriza|valida)/i,
  /sem permiss[aã]o/i,
  /entrada de dados manual/i,
  /n[aã]o aced/i,
  /acessar dados de clientes/i,
  /executar tarefas manuais/i,
  /multi-tenant/i,
  /console multi/i,
  /faturamento|assinatura|planos de assinatura/i,
  /whatsapp|e-?mail.*cliente/i,
  /interagir diretamente com clientes/i,
  /roteiros de atendimento/i,
  /scripts de comunica/i,
  /fechamento de neg[oó]cios/i,
  /vendas diretas/i,
  /or[cç]amentos|propostas sem/i,
  /s[oó] leitura|somente leitura/i,
];

const PODE_FAZER_RUIDO: RegExp[] = [
  /integrar novos tenants/i,
  /permiss[oõ]es e acessos de usu[aá]rios no console/i,
  /configurar pipelines.*tenants/i,
  /multi-tenant/i,
  /gerenciar contratos|faturas financeiras/i,
  /roi da plataforma/i,
];

export function filtrarNaoPodeInterno(bullets: string[]): string[] {
  return bullets.filter((b) => !NAO_PODE_CONTRADIZ_CRM.some((re) => re.test(b)));
}

export function filtrarPodeFazerInterno(bullets: string[]): string[] {
  return bullets.filter((b) => !PODE_FAZER_RUIDO.some((re) => re.test(b)));
}

const NAO_PODE_PADRAO_INTERNO = [
  "Atender cliente final ou simular WhatsApp comercial.",
  "Inventar números ou factos sem consultar ferramentas no mesmo turno.",
  "Alterar orçamentos, propostas ou contratos sem confirmação explícita do utilizador interno.",
];

export function sanitizarCatalogoInterno(
  pode: unknown,
  naoPode: unknown
): { podeFazer: string[]; naoPodeFazer: string[] } {
  const podeFazer = filtrarPodeFazerInterno(normalizarBulletsCargo(pode)).slice(0, 8);
  const naoFiltrado = filtrarNaoPodeInterno(normalizarBulletsCargo(naoPode));
  const seen = new Set(naoFiltrado.map((s) => s.toLowerCase()));
  for (const n of NAO_PODE_PADRAO_INTERNO) {
    if (!seen.has(n.toLowerCase())) {
      naoFiltrado.push(n);
      seen.add(n.toLowerCase());
    }
  }
  return { podeFazer, naoPodeFazer: naoFiltrado.slice(0, 8) };
}

/** Remove secções e linhas que contradizem o harness CRM após refinamento Mistral. */
export function limparPromptMistralInterno(prompt: string): string {
  let p = prompt.trim();
  p = p.replace(/##\s*N[aã]o pode fazer[\s\S]*?(?=\n##\s|\n═══|$)/gi, "").trim();
  p = p.replace(/##\s*Pode fazer[\s\S]*?(?=\n##\s|\n═══|$)/gi, "").trim();

  const linhas = p.split("\n").filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (/modificar dados|sem valida|s[oó] leitura|somente leitura|n[aã]o aced|n[aã]o pode gravar/i.test(t)) {
      return false;
    }
    if (/multi-tenant|console multi|whatsapp comercial|cliente final/i.test(t) && /^[-*]/.test(t)) {
      return false;
    }
    return true;
  });

  return linhas.join("\n").trim();
}
