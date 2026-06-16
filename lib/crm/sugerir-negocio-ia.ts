import type { SupabaseClient } from "@supabase/supabase-js";
import {
  carregarHistoricoConversaLead,
  carregarMemoriasLeadNegocio,
  extrairDemandaServicoCliente,
  extrairOrcamentosDosTextos,
  formatarOrcamentosParaPrompt,
  type OrcamentoNaConversa,
} from "@/lib/crm/contexto-negocio-conversa";
import { formatarServicosCatalogoParaPrompt } from "@/lib/crm/servicos-catalogo-prompt";
import {
  listarServicosCatalogo,
  sincronizarServicosFromConhecimento,
  type ServicoCatalogoRow,
} from "@/lib/crm/servicos-catalogo";
import { carregarContextoLeadCrmParaPrompt } from "@/lib/ia/atendimento-fluido";
import { mistralMemoryModelId } from "@/lib/ia/hub-model-defaults";
import { mistralChatCompletion } from "@/lib/ia/mistral-chat";
import { resolverConsultaRagParaBusca } from "@/lib/ia/consulta-rag-conversa";
import {
  formatarAnaliseNegocioParaPrompt,
  buscarTrechosConhecimentoTenant,
  formatarTrechosConhecimentoParaPrompt,
  lerAnaliseNegocioTenant,
  type TenantConhecimentoAnaliseNegocio,
} from "@/lib/hub/tenant-conhecimento-rag";

export type SugestaoNegocioIa = {
  servico_catalogo_id: string | null;
  servico_nome: string | null;
  titulo: string;
  valor_estimado: number | null;
  data_entrada: string | null;
  data_entrega: string | null;
  descricao: string | null;
  orcamento_na_conversa?: OrcamentoNaConversa | null;
  fontes?: string[];
};

const TERMOS_CONSULTORIA_GENERICOS = [
  "funil de vendas",
  "estruturação de funil",
  "apoio comercial",
  "consultoria comercial",
  "empresa de software",
  "saas",
  "marketing digital",
  "estratégia comercial",
];

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : t).trim();
  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(body.slice(start, end + 1)) as unknown;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizarData(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const iso = v.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return null;
}

function normalizarValor(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/[^\d.,]/g, "").replace(",", "."));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

export function matchServicoCatalogoPorNome(
  catalogo: ServicoCatalogoRow[],
  nome: string | null | undefined
): ServicoCatalogoRow | null {
  const termo = nome?.trim().toLowerCase();
  if (!termo || !catalogo.length) return null;

  const exact = catalogo.find((r) => r.nome.trim().toLowerCase() === termo);
  if (exact) return exact;

  const contains = catalogo.filter(
    (r) =>
      r.nome.toLowerCase().includes(termo) ||
      termo.includes(r.nome.trim().toLowerCase())
  );
  if (contains.length === 1) return contains[0];

  const words = termo.split(/\s+/).filter((w) => w.length > 2);
  if (words.length) {
    let best: ServicoCatalogoRow | null = null;
    let bestScore = 0;
    for (const r of catalogo) {
      const nomeLower = r.nome.toLowerCase();
      const score = words.filter((w) => nomeLower.includes(w)).length;
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    if (best && bestScore >= Math.min(2, words.length)) return best;
  }

  return contains[0] ?? null;
}

function corpusLead(opts: {
  interesse?: string | null;
  mensagens: string[];
  memorias: string[];
  ultimaMensagem?: string | null;
}): string {
  return [
    opts.interesse ?? "",
    opts.ultimaMensagem ?? "",
    ...opts.mensagens,
    ...opts.memorias,
  ]
    .join(" ")
    .toLowerCase();
}

/** Escolhe serviço do catálogo alinhado à conversa; senão o primeiro item indexado. */
export function escolherMelhorServicoCatalogo(
  catalogo: ServicoCatalogoRow[],
  opts: {
    interesse?: string | null;
    mensagens: string[];
    memorias: string[];
    ultimaMensagem?: string | null;
    analise?: TenantConhecimentoAnaliseNegocio | null;
  }
): ServicoCatalogoRow | null {
  if (!catalogo.length) return null;

  const corpus = corpusLead(opts);
  const termosAnalise = (opts.analise?.produtos_servicos ?? [])
    .concat(opts.analise?.nicho ? [opts.analise.nicho] : [])
    .join(" ")
    .toLowerCase();

  let best: ServicoCatalogoRow | null = null;
  let bestScore = -1;

  for (const r of catalogo) {
    const nome = r.nome.trim().toLowerCase();
    const desc = (r.descricao ?? "").toLowerCase();
    let score = 0;

    if (corpus.includes(nome)) score += 8;
    for (const w of nome.split(/\s+/).filter((x) => x.length > 2)) {
      if (corpus.includes(w)) score += 2;
    }
    if (desc) {
      for (const w of desc.split(/\s+/).filter((x) => x.length > 3).slice(0, 12)) {
        if (corpus.includes(w)) score += 1;
      }
    }
    if (termosAnalise && nome) {
      for (const w of nome.split(/\s+/).filter((x) => x.length > 3)) {
        if (termosAnalise.includes(w)) score += 2;
      }
      if (termosAnalise.includes(nome)) score += 4;
    }

    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  return best ?? catalogo[0];
}

function textoPermiteTermoConsultoria(
  termo: string,
  analise: TenantConhecimentoAnaliseNegocio | null
): boolean {
  if (!analise) return false;
  const blob = [
    analise.sintese,
    analise.nicho,
    analise.modelo_negocio,
    analise.perfil_empresa,
    ...analise.produtos_servicos,
    ...analise.segmentos,
  ]
    .join(" ")
    .toLowerCase();
  return blob.includes(termo);
}

export function pareceSugestaoDesalinhada(
  texto: string,
  analise: TenantConhecimentoAnaliseNegocio | null,
  servicoMatch: ServicoCatalogoRow | null
): boolean {
  const t = texto.toLowerCase();
  for (const termo of TERMOS_CONSULTORIA_GENERICOS) {
    if (t.includes(termo) && !textoPermiteTermoConsultoria(termo, analise)) {
      return true;
    }
  }
  if (!servicoMatch) return true;
  const nome = servicoMatch.nome.toLowerCase();
  if (!t.includes(nome) && !nome.split(/\s+/).some((w) => w.length > 3 && t.includes(w))) {
    return true;
  }
  return false;
}

function montarTituloNegocio(
  servico: ServicoCatalogoRow | null,
  leadNome: string,
  demandaConversa?: string | null
): string {
  const demanda = demandaConversa?.trim();
  const nomeCatalogo = servico?.nome?.trim();

  if (nomeCatalogo && demanda) {
    const dl = demanda.toLowerCase();
    const nl = nomeCatalogo.toLowerCase();
    if (dl.includes(nl) || nl.includes(dl.slice(0, 12))) {
      return `${nomeCatalogo} — ${leadNome}`;
    }
    return `Negócio — ${leadNome} — ${demanda}`;
  }
  if (demanda) return `Negócio — ${leadNome} — ${demanda}`;
  if (nomeCatalogo) return `${nomeCatalogo} — ${leadNome}`;
  return `Negócio — ${leadNome}`;
}

function montarDescricaoSegura(opts: {
  servico: ServicoCatalogoRow | null;
  interesse?: string | null;
  analise?: TenantConhecimentoAnaliseNegocio | null;
  mensagens: string[];
  orcamento?: OrcamentoNaConversa | null;
  demandaConversa?: string | null;
  fontes?: string[];
}): string | null {
  const partes: string[] = [];
  if (opts.orcamento) {
    partes.push(
      `Orçamento na conversa: R$ ${opts.orcamento.valor.toFixed(2)} (${opts.orcamento.trecho.slice(0, 120)})`
    );
  }
  if (opts.demandaConversa?.trim()) {
    partes.push(`Pedido do cliente: ${opts.demandaConversa.trim().slice(0, 120)}`);
  }
  if (opts.servico?.nome) {
    partes.push(`Serviço do catálogo: ${opts.servico.nome.trim()}`);
  }
  if (opts.interesse?.trim()) {
    partes.push(`Interesse do lead: ${opts.interesse.trim().slice(0, 200)}`);
  } else if (opts.mensagens.length) {
    partes.push("Sugestão cruzando conversa, documentos da empresa e catálogo.");
  }
  if (opts.analise?.nicho?.trim()) {
    partes.push(`Nicho: ${opts.analise.nicho.trim()}`);
  }
  if (opts.fontes?.length) {
    partes.push(`Fontes: ${opts.fontes.join(", ")}`);
  }
  return partes.length ? partes.join(" · ") : null;
}

function sugestaoFallback(
  leadNome: string,
  catalogo: ServicoCatalogoRow[],
  ctx: Awaited<ReturnType<typeof carregarContextoLeadCrmParaPrompt>>,
  opts: {
    interesse?: string | null;
    mensagens: string[];
    memorias: string[];
    ultimaMensagem?: string | null;
    analise?: TenantConhecimentoAnaliseNegocio | null;
    orcamento?: OrcamentoNaConversa | null;
    demandaConversa?: string | null;
    fontes?: string[];
  }
): SugestaoNegocioIa {
  const servico = escolherMelhorServicoCatalogo(catalogo, opts);
  const titulo = montarTituloNegocio(servico, leadNome, opts.demandaConversa);
  let valor: number | null = opts.orcamento?.valor ?? null;
  if (valor == null && servico?.preco_referencia != null && Number.isFinite(Number(servico.preco_referencia))) {
    valor = Number(servico.preco_referencia);
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const entrega = new Date();
  entrega.setDate(entrega.getDate() + 14);

  return {
    servico_catalogo_id: servico?.id ?? null,
    servico_nome: servico?.nome ?? null,
    titulo,
    valor_estimado: valor,
    data_entrada: hoje,
    data_entrega: entrega.toISOString().slice(0, 10),
    descricao: montarDescricaoSegura({
      servico,
      interesse: opts.interesse ?? ctx?.interesse ?? null,
      analise: opts.analise ?? null,
      mensagens: opts.mensagens,
      orcamento: opts.orcamento ?? null,
      demandaConversa: opts.demandaConversa ?? null,
      fontes: opts.fontes,
    }),
    orcamento_na_conversa: opts.orcamento ?? null,
    fontes: opts.fontes,
  };
}

async function carregarLeadParaSugestaoNegocio(
  supabase: SupabaseClient,
  leadId: string
): Promise<Record<string, unknown> | null> {
  const tentativas = [
    "id, nome, estagio, interesse_principal, valor_estimado, ultima_mensagem",
    "id, nome, estagio, valor_estimado, ultima_mensagem",
    "id, nome, estagio, valor_estimado",
    "id, nome",
  ];
  for (const select of tentativas) {
    const { data, error } = await supabase
      .from("hub_leads_crm")
      .select(select)
      .eq("id", leadId)
      .maybeSingle();
    if (!error && data && typeof data === "object" && (data as { id?: string }).id) {
      return data as Record<string, unknown>;
    }
  }
  return null;
}

export async function sugerirNegocioViaIa(
  supabase: SupabaseClient,
  tenantId: string,
  leadId: string
): Promise<SugestaoNegocioIa> {
  const lead = await carregarLeadParaSugestaoNegocio(supabase, leadId);

  if (!lead?.id) {
    throw new Error("Lead não encontrado.");
  }

  const leadNome = typeof lead.nome === "string" ? lead.nome.trim() || "Cliente" : "Cliente";
  const interesse =
    typeof lead.interesse_principal === "string" ? lead.interesse_principal.trim() : null;
  const ultimaMensagem =
    typeof lead.ultima_mensagem === "string" ? lead.ultima_mensagem.trim() : null;

  let catalogo = await listarServicosCatalogo(supabase, tenantId);
  if (!catalogo.length) {
    try {
      await sincronizarServicosFromConhecimento(supabase, tenantId);
      catalogo = await listarServicosCatalogo(supabase, tenantId);
    } catch {
      /* catálogo opcional */
    }
  }

  const analiseCache = await lerAnaliseNegocioTenant(supabase, tenantId);
  const analiseNegocio = analiseCache?.analise ?? null;
  const textoAnalise = analiseNegocio ? formatarAnaliseNegocioParaPrompt(analiseNegocio) : "";

  const [ctx, memorias, historico] = await Promise.all([
    carregarContextoLeadCrmParaPrompt(supabase, leadId),
    carregarMemoriasLeadNegocio(supabase, leadId),
    carregarHistoricoConversaLead(supabase, leadId),
  ]);

  const mensagens = historico.linhas;
  const orcamentos = extrairOrcamentosDosTextos([
    ...mensagens,
    ...memorias,
    ultimaMensagem ?? "",
  ]);
  const orcamentoPrincipal = orcamentos[0] ?? null;
  const demandaConversa = extrairDemandaServicoCliente(historico.turnos, mensagens);

  const consultaRag = resolverConsultaRagParaBusca(
    demandaConversa ?? interesse ?? ultimaMensagem ?? leadNome,
    historico.turnos
  );
  const [trechosConversa, trechosPrecos] = await Promise.all([
    buscarTrechosConhecimentoTenant(supabase, tenantId, consultaRag, {
      limit: 5,
      threshold: 0.5,
    }),
    buscarTrechosConhecimentoTenant(
      supabase,
      tenantId,
      `${consultaRag} tabela preços orçamento serviços valores`,
      { limit: 4, threshold: 0.48 }
    ),
  ]);
  const trechosMap = new Map<string, (typeof trechosConversa)[0]>();
  for (const t of [...trechosConversa, ...trechosPrecos]) {
    trechosMap.set(t.conteudo.slice(0, 100), t);
  }
  const trechosDocs = [...trechosMap.values()].slice(0, 8);
  const textoTrechos = formatarTrechosConhecimentoParaPrompt(trechosDocs);

  const fontes: string[] = [];
  if (mensagens.length) fontes.push("conversa");
  if (orcamentoPrincipal) fontes.push("orçamento na conversa");
  if (trechosDocs.length) fontes.push("documentos");
  if (analiseNegocio) fontes.push("análise do negócio");
  if (catalogo.length) fontes.push("catálogo");

  const escolhaOpts = {
    interesse,
    mensagens,
    memorias,
    ultimaMensagem,
    analise: analiseNegocio,
  };

  const textoCatalogo = formatarServicosCatalogoParaPrompt(catalogo);
  const contextoPartes = [
    textoAnalise
      ? `═══ IDENTIDADE DO NEGÓCIO (Conhecimento — fonte principal) ═══\n${textoAnalise}`
      : "Análise do negócio ainda não gerada em Conhecimento.",
    `Lead: ${leadNome}`,
    lead.estagio ? `Estágio funil: ${String(lead.estagio)}` : null,
    interesse ? `Interesse declarado: ${interesse}` : null,
    lead.valor_estimado != null ? `Valor estimado no lead: R$ ${lead.valor_estimado}` : null,
    ultimaMensagem ? `Última mensagem: ${ultimaMensagem.slice(0, 300)}` : null,
    ctx?.negociosResumo?.length
      ? `Negócios existentes: ${ctx.negociosResumo.join("; ")}`
      : "Sem negócios vinculados.",
    memorias.length ? `Memórias do lead:\n${memorias.join("\n")}` : null,
    mensagens.length
      ? `═══ CONVERSA COMPLETA (prioridade para título e valor) ═══\n${mensagens.join("\n")}`
      : "Sem histórico de mensagens no CRM.",
    `═══ ORÇAMENTOS DETECTADOS NA CONVERSA ═══\n${formatarOrcamentosParaPrompt(orcamentos)}`,
    demandaConversa ? `Demanda explícita do cliente: ${demandaConversa}` : null,
    textoTrechos
      ? `═══ TRECHOS DOS DOCUMENTOS DA EMPRESA (preços, serviços, tabela) ═══\n${textoTrechos}`
      : null,
    textoCatalogo
      ? `═══ CATÁLOGO OFICIAL (use SOMENTE estes serviços/preços) ═══\n${textoCatalogo}`
      : "Catálogo vazio — sincronize Conhecimento ou cadastre serviços.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const hoje = new Date().toISOString().slice(0, 10);

  const system = `Você sugere campos para criar um NEGÓCIO no CRM Waje.
Prioridade das fontes: (1) ORÇAMENTOS NA CONVERSA e pedido do cliente, (2) DOCUMENTOS DA EMPRESA, (3) CATÁLOGO OFICIAL, (4) identidade do negócio.

Responda APENAS JSON (sem markdown):
{
  "servico_nome": "nome EXATO de um item do catálogo",
  "titulo": "formato preferido: «Serviço do catálogo — nome do lead» OU «Negócio — nome do lead — pedido do cliente»",
  "valor_estimado": 123.45,
  "data_entrada": "YYYY-MM-DD",
  "data_entrega": "YYYY-MM-DD",
  "descricao": "nota curta factual citando conversa e/ou documento"
}

REGRAS OBRIGATÓRIAS:
- Leia TODA a conversa: se o cliente pediu «conserto celular», «troca de tela», etc., o titulo DEVE refletir isso.
- Se houver valor R$ explícito na conversa (orçamento da IA ou atendente), use esse valor em valor_estimado.
- Se não houver valor na conversa, use preço do catálogo ou documento; se incerto, null.
- servico_nome deve ser item REAL do catálogo mais próximo do pedido na conversa.
- NUNCA invente consultoria genérica se o cliente falou de reparo/serviço concreto.
- descricao: cite o que o cliente pediu e, se houver, o orçamento mencionado.
- data_entrada: preferencialmente ${hoje}.
- data_entrega: prazo realista (reparo celular: 3–7 dias; projetos: até 30 dias).`;

  const out = await mistralChatCompletion({
    model: mistralMemoryModelId(),
    system,
    messages: [{ role: "user", content: contextoPartes.slice(0, 18_000) }],
    maxTokens: 800,
    temperature: 0.1,
  });

  if (!out.ok || !out.text.trim()) {
    return sugestaoFallback(leadNome, catalogo, ctx, {
      ...escolhaOpts,
      orcamento: orcamentoPrincipal,
      demandaConversa,
      fontes,
    });
  }

  const obj = parseJsonObject(out.text);
  if (!obj) {
    return sugestaoFallback(leadNome, catalogo, ctx, {
      ...escolhaOpts,
      orcamento: orcamentoPrincipal,
      demandaConversa,
      fontes,
    });
  }

  const servicoNomeIa =
    typeof obj.servico_nome === "string" ? obj.servico_nome.trim() || null : null;
  let servicoMatch = matchServicoCatalogoPorNome(catalogo, servicoNomeIa);
  if (!servicoMatch) {
    servicoMatch = escolherMelhorServicoCatalogo(catalogo, escolhaOpts);
  }

  let tituloIa =
    typeof obj.titulo === "string" && obj.titulo.trim()
      ? obj.titulo.trim().slice(0, 200)
      : "";
  const descricaoIa =
    typeof obj.descricao === "string" ? obj.descricao.trim().slice(0, 500) || null : null;

  const textoSugestao = `${tituloIa} ${descricaoIa ?? ""} ${servicoNomeIa ?? ""}`;
  const desalinhada = pareceSugestaoDesalinhada(textoSugestao, analiseNegocio, servicoMatch);

  let titulo = desalinhada
    ? montarTituloNegocio(servicoMatch, leadNome, demandaConversa)
    : tituloIa || montarTituloNegocio(servicoMatch, leadNome, demandaConversa);

  let valor = normalizarValor(obj.valor_estimado);
  if (valor == null && orcamentoPrincipal) valor = orcamentoPrincipal.valor;
  if (valor == null && servicoMatch?.preco_referencia != null) {
    valor = Number(servicoMatch.preco_referencia);
  }
  if (valor == null && lead.valor_estimado != null) {
    valor = Number(lead.valor_estimado);
  }

  let descricao = desalinhada
    ? montarDescricaoSegura({
        servico: servicoMatch,
        interesse,
        analise: analiseNegocio,
        mensagens,
        orcamento: orcamentoPrincipal,
        demandaConversa,
        fontes,
      })
    : descricaoIa;

  if (
    descricao &&
    pareceSugestaoDesalinhada(descricao, analiseNegocio, servicoMatch)
  ) {
    descricao = montarDescricaoSegura({
      servico: servicoMatch,
      interesse,
      analise: analiseNegocio,
      mensagens,
      orcamento: orcamentoPrincipal,
      demandaConversa,
      fontes,
    });
  }

  const dataEntrada = normalizarData(obj.data_entrada) ?? hoje;
  let dataEntrega = normalizarData(obj.data_entrega);
  if (!dataEntrega) {
    const d = new Date();
    const rapido =
      demandaConversa?.toLowerCase().includes("conserto") ||
      demandaConversa?.toLowerCase().includes("tela") ||
      demandaConversa?.toLowerCase().includes("celular");
    d.setDate(d.getDate() + (rapido ? 5 : servicoMatch?.nome.toLowerCase().includes("diagn") ? 3 : 14));
    dataEntrega = d.toISOString().slice(0, 10);
  }

  return {
    servico_catalogo_id: servicoMatch?.id ?? null,
    servico_nome: servicoMatch?.nome ?? servicoNomeIa,
    titulo,
    valor_estimado: valor,
    data_entrada: dataEntrada,
    data_entrega: dataEntrega,
    descricao,
    orcamento_na_conversa: orcamentoPrincipal,
    fontes,
  };
}
