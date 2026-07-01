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
  const { data: negocios, error } = await supabase
    .from("hub_negocios")
    .select("titulo, valor_estimado, status, etapa, lead_id")
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false })
    .limit(limite);

  if (error || !negocios?.length) return [];

  const leadIds = [
    ...new Set(negocios.map((n) => n.lead_id).filter((id): id is string => Boolean(id))),
  ];
  const leadNomes = new Map<string, string>();
  if (leadIds.length) {
    const { data: leads } = await supabase
      .from("hub_leads_crm")
      .select("id, nome")
      .in("id", leadIds);
    for (const l of leads ?? []) {
      leadNomes.set(String(l.id), String(l.nome ?? "").trim() || "—");
    }
  }

  return negocios.map((n) => ({
    titulo: n.titulo,
    valor_estimado: n.valor_estimado,
    status: n.status,
    etapa: n.etapa,
    lead_id: n.lead_id,
    hub_leads_crm: { nome: leadNomes.get(String(n.lead_id)) ?? "—" },
  }));
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

  const { data: contas, error } = await supabase
    .from("hub_contas_receber")
    .select("descricao, valor, vencimento, status, negocio_id, lead_id")
    .eq("tenant_id", tenantId)
    .lte("vencimento", ateIso)
    .order("vencimento", { ascending: true })
    .limit(limite);

  if (error || !contas?.length) return [];

  const leadIds = [
    ...new Set(contas.map((c) => c.lead_id).filter((id): id is string => Boolean(id))),
  ];
  const leadNomes = new Map<string, string>();
  if (leadIds.length) {
    const { data: leads } = await supabase
      .from("hub_leads_crm")
      .select("id, nome")
      .in("id", leadIds);
    for (const l of leads ?? []) {
      leadNomes.set(String(l.id), String(l.nome ?? "").trim() || "—");
    }
  }

  return contas.map((c) => ({
    descricao: c.descricao,
    valor: c.valor,
    vencimento: c.vencimento,
    status: c.status,
    negocio_id: c.negocio_id,
    lead_id: c.lead_id,
    hub_leads_crm: { nome: leadNomes.get(String(c.lead_id)) ?? "—" },
  }));
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

  return { ...sec, linhas };
}

/** Só preenche tabelas vazias a partir do CRM — sem alterar insights nem ordem das secções. */
export async function enriquecerSecoesArtefatoComCrm(
  supabase: SupabaseClient,
  tenantId: string,
  secoes: SecaoArtefatoSpec[]
): Promise<SecaoArtefatoSpec[]> {
  const { enriquecerSecoesArtefato, filtrarSecoesVazias } = await import(
    "@/lib/hub/superagente/artefato-enriquecer"
  );
  let out = enriquecerSecoesArtefato(secoes);
  const grafico = out.find((s): s is Extract<SecaoArtefatoSpec, { tipo: "grafico" }> => s.tipo === "grafico");

  const enriched: SecaoArtefatoSpec[] = [];
  for (const sec of out) {
    if (sec.tipo === "tabela") {
      enriched.push(await preencherTabelaFromCrm(supabase, tenantId, sec, grafico?.grafico));
    } else {
      enriched.push(sec);
    }
  }

  return filtrarSecoesVazias(enriched);
}

/** Re-export para testes — mapeia objeto com chaves em inglês. */
export function mapObjetoLinhaTabela(colunas: string[], row: Record<string, unknown>): string[] {
  const ALIAS: Record<string, string[]> = {
    codigo: ["code", "codigo", "código", "neg", "titulo", "título"],
    titulo: ["title", "titulo", "título", "nome", "descricao"],
    lead: ["lead", "lead_nome", "cliente", "customer"],
    valor: ["value", "valor", "amount", "valor_estimado", "montante"],
    status: ["status", "estado", "state", "etapa"],
    vencimento: ["due", "vencimento", "due_date", "data_vencimento"],
  };

  const pick = (coluna: string): string => {
    const direct = valorCelulaDeObjeto(row, coluna);
    if (direct.trim()) return direct;
    const c = normCol(coluna);
    for (const [canon, keys] of Object.entries(ALIAS)) {
      const bateColuna = c.includes(canon) || keys.some((k) => c.includes(normCol(k)));
      if (!bateColuna) continue;
      for (const k of keys) {
        for (const [rk, rv] of Object.entries(row)) {
          if (normCol(rk) === normCol(k)) return String(rv ?? "");
        }
      }
    }
    return "";
  };

  return colunas.map(pick);
}

export function normalizarLinhasTabelaRobusta(colunas: string[], linhasRaw: unknown[]): string[][] {
  return normalizarLinhasTabela(colunas, linhasRaw);
}
