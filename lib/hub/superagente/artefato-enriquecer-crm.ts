import type { SupabaseClient } from "@supabase/supabase-js";
import type { GraficoArtefatoSpec, SecaoArtefatoSpec } from "@/lib/hub/superagente/types";
import { enriquecerSecoesArtefato } from "@/lib/hub/superagente/artefato-enriquecer";
import {
  linhasTabelaPrecisamPreencher,
  normalizarLinhasTabela,
  preencherTabelaVaziaDeGrafico,
  valorCelulaDeObjeto,
} from "@/lib/hub/superagente/artefato-normalizar";

function normCol(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function indiceColuna(colunas: string[], aliases: string[]): number {
  for (let i = 0; i < colunas.length; i++) {
    const c = normCol(colunas[i] ?? "");
    if (aliases.some((a) => c.includes(a) || a.includes(c))) return i;
  }
  return -1;
}

function formatMoedaBr(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDataBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("pt-BR");
}

type NegocioRow = {
  titulo: string | null;
  valor_estimado: number | null;
  status: string | null;
  etapa: string | null;
  lead_id: string | null;
  hub_leads_crm: { nome: string | null } | { nome: string | null }[] | null;
};

type ContaRow = {
  descricao: string | null;
  valor: number | null;
  vencimento: string | null;
  status: string | null;
  negocio_id: string | null;
  lead_id: string | null;
  hub_leads_crm: { nome: string | null } | { nome: string | null }[] | null;
};

function nomeLeadJoin(
  rel: { nome: string | null } | { nome: string | null }[] | null | undefined
): string {
  if (!rel) return "—";
  if (Array.isArray(rel)) return rel[0]?.nome?.trim() || "—";
  return rel.nome?.trim() || "—";
}

function linhaNegocioParaTabela(colunas: string[], n: NegocioRow): string[] {
  const codigo = n.titulo?.trim() || "—";
  const lead = nomeLeadJoin(n.hub_leads_crm);
  const valor = formatMoedaBr(Number(n.valor_estimado) || 0);
  const status = (n.status || n.etapa || "aberto").trim();

  const mapa: Record<string, string> = {
    codigo: codigo,
    titulo: codigo,
    neg: codigo,
    nome: codigo,
    lead,
    valor,
    montante: valor,
    status,
    estado: status,
    situacao: status,
    vencimento: "—",
  };

  return colunas.map((col) => {
    const c = normCol(col);
    for (const [k, v] of Object.entries(mapa)) {
      if (c.includes(k) || k.includes(c)) return v;
    }
    return "—";
  });
}

function linhaContaParaTabela(colunas: string[], c: ContaRow): string[] {
  const lead = nomeLeadJoin(c.hub_leads_crm);
  const valor = formatMoedaBr(Number(c.valor) || 0);
  const mapa: Record<string, string> = {
    codigo: c.descricao?.trim() || "—",
    titulo: c.descricao?.trim() || "—",
    descricao: c.descricao?.trim() || "—",
    lead,
    valor,
    vencimento: formatDataBr(c.vencimento),
    status: (c.status || "pendente").trim(),
  };
  return colunas.map((col) => {
    const cn = normCol(col);
    for (const [k, v] of Object.entries(mapa)) {
      if (cn.includes(k) || k.includes(cn)) return v;
    }
    return "—";
  });
}

function tabelaPareceNegocios(colunas: string[]): boolean {
  const joined = colunas.map(normCol).join(" ");
  return (
    joined.includes("neg") ||
    (joined.includes("codigo") && joined.includes("lead")) ||
    (joined.includes("titulo") && joined.includes("valor"))
  );
}

function tabelaPareceContas(colunas: string[]): boolean {
  const joined = colunas.map(normCol).join(" ");
  return joined.includes("vencimento") || joined.includes("receber");
}

async function buscarNegociosCrm(
  supabase: SupabaseClient,
  tenantId: string,
  limite = 25
): Promise<NegocioRow[]> {
  const { data, error } = await supabase
    .from("hub_negocios")
    .select("titulo, valor_estimado, status, etapa, lead_id, hub_leads_crm(nome)")
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false })
    .limit(limite);

  if (error || !data?.length) return [];
  return data as NegocioRow[];
}

async function buscarContasReceberCrm(
  supabase: SupabaseClient,
  tenantId: string,
  dias = 15,
  limite = 25
): Promise<ContaRow[]> {
  const ate = new Date();
  ate.setDate(ate.getDate() + dias);
  const ateIso = ate.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("hub_contas_receber")
    .select("descricao, valor, vencimento, status, negocio_id, lead_id, hub_leads_crm(nome)")
    .eq("tenant_id", tenantId)
    .lte("vencimento", ateIso)
    .order("vencimento", { ascending: true })
    .limit(limite);

  if (error || !data?.length) return [];
  return data as ContaRow[];
}

function filtrarPorGrafico(
  linhas: string[][],
  colunas: string[],
  grafico: GraficoArtefatoSpec | undefined
): string[][] {
  if (!grafico?.labels?.length) return linhas;
  const idxCod = indiceColuna(colunas, ["codigo", "neg", "titulo"]);
  if (idxCod < 0) return linhas;
  const labels = new Set(grafico.labels.map((l) => l.trim().toLowerCase()));
  const filtradas = linhas.filter((row) => labels.has(String(row[idxCod] ?? "").trim().toLowerCase()));
  return filtradas.length ? filtradas : linhas;
}

async function preencherTabelaFromCrm(
  supabase: SupabaseClient,
  tenantId: string,
  sec: Extract<SecaoArtefatoSpec, { tipo: "tabela" }>,
  grafico?: GraficoArtefatoSpec
): Promise<Extract<SecaoArtefatoSpec, { tipo: "tabela" }>> {
  if (!sec.colunas.length) return sec;

  let linhas = sec.linhas;
  if (linhasTabelaPrecisamPreencher(linhas)) {
    linhas = preencherTabelaVaziaDeGrafico(sec.colunas, [], grafico);
  }

  if (linhasTabelaPrecisamPreencher(linhas)) {
    if (tabelaPareceContas(sec.colunas)) {
      const contas = await buscarContasReceberCrm(supabase, tenantId);
      if (contas.length) {
        linhas = contas.map((c) => linhaContaParaTabela(sec.colunas, c));
      }
    } else if (tabelaPareceNegocios(sec.colunas)) {
      const negocios = await buscarNegociosCrm(supabase, tenantId);
      if (negocios.length) {
        linhas = negocios.map((n) => linhaNegocioParaTabela(sec.colunas, n));
      }
    }
  }

  linhas = filtrarPorGrafico(linhas, sec.colunas, grafico);
  return { ...sec, linhas };
}

function markdownInsightsIncompleto(md: string): boolean {
  const t = md.trim();
  if (!t) return true;
  if (t.length < 50) return true;
  const ultima = t.split(/\r?\n/).pop()?.trim() ?? "";
  if (/^-\s+\*\*[^*]*$/.test(ultima)) return true;
  if (/\*\*[^*\n]{0,3}$/.test(ultima)) return true;
  return false;
}

function gerarInsightsDeSecoes(secoes: SecaoArtefatoSpec[]): string {
  const kpis = secoes.find((s): s is Extract<SecaoArtefatoSpec, { tipo: "kpi_row" }> => s.tipo === "kpi_row");
  const tabela = secoes.find((s): s is Extract<SecaoArtefatoSpec, { tipo: "tabela" }> => s.tipo === "tabela");

  const linhas: string[] = ["## Insights Críticos", ""];
  if (kpis?.itens.length) {
    for (const k of kpis.itens.slice(0, 4)) {
      linhas.push(`- **${k.label}:** ${k.valor}${k.delta ? ` (${k.delta})` : ""}`);
    }
  }

  if (tabela?.linhas.length) {
    const idxVal = indiceColuna(tabela.colunas, ["valor", "r$"]);
    const idxLead = indiceColuna(tabela.colunas, ["lead"]);
    const idxCod = indiceColuna(tabela.colunas, ["codigo", "titulo", "neg"]);

    const ranked = tabela.linhas
      .map((row) => {
        const raw = idxVal >= 0 ? String(row[idxVal] ?? "") : "0";
        const n = Number(raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
        return {
          n,
          cod: idxCod >= 0 ? String(row[idxCod] ?? "") : "",
          lead: idxLead >= 0 ? String(row[idxLead] ?? "") : "",
        };
      })
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n);

    if (ranked.length >= 2) {
      const top = ranked.slice(0, 2);
      const total = ranked.reduce((s, r) => s + r.n, 0);
      const pct = total > 0 ? Math.round(((top[0]!.n + top[1]!.n) / total) * 100) : 0;
      linhas.push(
        `- **${pct}% da receita prevista** concentra-se em **2 negócios** (${top[0]!.lead}: ${formatMoedaBr(top[0]!.n)} e ${top[1]!.lead}: ${formatMoedaBr(top[1]!.n)}).`
      );
    }

    const leadsUnicos = new Set(ranked.map((r) => r.lead).filter((l) => l && l !== "—"));
    if (leadsUnicos.size) {
      linhas.push(`- **${leadsUnicos.size} leads** com negócios activos neste recorte.`);
    }
  }

  linhas.push("- Priorize follow-up nos negócios de maior valor e contas com vencimento nos próximos 15 dias.");
  return linhas.join("\n");
}

function completarSecaoInsights(secoes: SecaoArtefatoSpec[]): SecaoArtefatoSpec[] {
  const auto = gerarInsightsDeSecoes(secoes);
  let temTexto = false;

  const out = secoes.map((sec) => {
    if (sec.tipo !== "texto") return sec;
    temTexto = true;
    const md = sec.markdown?.trim() ?? "";
    if (markdownInsightsIncompleto(md)) {
      return { tipo: "texto" as const, markdown: auto };
    }
    return sec;
  });

  if (!temTexto) {
    out.push({ tipo: "texto", markdown: auto });
  }
  return out;
}

/** Enriquecimento síncrono + dados reais do CRM + insights completos. */
export async function enriquecerSecoesArtefatoComCrm(
  supabase: SupabaseClient,
  tenantId: string,
  secoes: SecaoArtefatoSpec[]
): Promise<SecaoArtefatoSpec[]> {
  let out = enriquecerSecoesArtefato(secoes);
  const grafico = out.find((s): s is Extract<SecaoArtefatoSpec, { tipo: "grafico" }> => s.tipo === "grafico");

  const enriched: SecaoArtefatoSpec[] = [];
  for (const sec of out) {
    if (sec.tipo === "tabela") {
      enriched.push(
        await preencherTabelaFromCrm(
          supabase,
          tenantId,
          sec,
          grafico?.grafico
        )
      );
    } else {
      enriched.push(sec);
    }
  }

  return completarSecaoInsights(enriched);
}

/** Re-export para testes — mapeia objeto com chaves em inglês. */
export function mapObjetoLinhaTabela(colunas: string[], row: Record<string, unknown>): string[] {
  const aliases: Record<string, string[]> = {
    codigo: ["code", "codigo", "código", "neg", "id"],
    titulo: ["title", "titulo", "título", "nome"],
    lead: ["lead", "lead_nome", "cliente", "customer"],
    valor: ["value", "valor", "amount", "valor_estimado"],
    status: ["status", "estado", "state"],
    vencimento: ["due", "vencimento", "due_date", "data"],
  };

  return colunas.map((col) => {
    const direct = valorCelulaDeObjeto(row, col);
    if (direct.trim()) return direct;
    const c = normCol(col);
    for (const [canon, keys] of Object.entries(aliases)) {
      if (!c.includes(canon) && !keys.some((k) => c.includes(normCol(k)))) continue;
      for (const k of keys) {
        for (const [rk, rv] of Object.entries(row)) {
          if (normCol(rk) === normCol(k)) return String(rv ?? "");
        }
      }
    }
    return "";
  });
}

export function normalizarLinhasTabelaRobusta(colunas: string[], linhasRaw: unknown[]): string[][] {
  const base = normalizarLinhasTabela(colunas, linhasRaw);
  if (base.length) return base;

  const out: string[][] = [];
  for (const row of linhasRaw) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const cells = mapObjetoLinhaTabela(colunas, row as Record<string, unknown>);
      if (cells.some((c) => c.trim())) out.push(cells);
    }
  }
  return out;
}
