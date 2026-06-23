import type { AgentPlaybookSnapshotV1 } from "./agent-snapshot";
import {
  HUB_AGENTE_FERRAMENTAS_CATALOGO,
  mergeUsoFerramentasComPadraoPreservandoCustom,
} from "@/lib/hub/agente-ferramentas-registry";
import { MODO_OPERACAO_LABEL, isModoOperacaoAgente } from "@/lib/hub/agente-modo-operacao";

const CICLO_EXEC_LABEL: Record<string, string> = {
  interacao: "Gatilho por interação (mensagem no canal / webhook)",
  tempo_real: "Automático contínuo",
  agenda: "Cadência na agenda (programado)",
};

function yamlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * O mesmo encadeamento que `construirPrompt` usa em produção (sem mercado, memórias de lead nem etapa de fluxo).
 * Serve como documento único estilo «system prompt» para operadores e integrações Agno.
 */
export function buildUnifiedProductionPrompt(snapshot: AgentPlaybookSnapshotV1): string {
  const id = snapshot.identity!;
  const per = snapshot.personalidade_row;
  const humorLabel = String(per?.humor_label ?? "Profissional");
  const personalidadeLabel = String(per?.personalidade_label ?? "Direto");
  const tomComunicacao = String(per?.tom_comunicacao ?? "profissional");
  const descComp = per?.descricao_comportamento != null ? String(per.descricao_comportamento) : "";

  const secoes: string[] = [];

  secoes.push(`═══ IDENTIDADE ═══
${String(id.system_prompt_base ?? "")}

COMPORTAMENTO: Humor ${humorLabel} + Personalidade ${personalidadeLabel}.
Tom de comunicação: ${tomComunicacao}.
${descComp}`);

  const naoPodeFazer = Array.isArray(id.nao_pode_fazer) ? (id.nao_pode_fazer as string[]) : [];
  const sempreDizer = Array.isArray(id.sempre_dizer) ? (id.sempre_dizer as string[]) : [];
  const nuncaDizer = Array.isArray(id.nunca_dizer) ? (id.nunca_dizer as string[]) : [];

  let regrasTexto = "";
  if (naoPodeFazer.length > 0) {
    regrasTexto += `VOCÊ NUNCA PODE:\n${naoPodeFazer.map((r) => `• ${r.replace(/_/g, " ")}`).join("\n")}`;
  }
  if (sempreDizer.length > 0) {
    regrasTexto += `\n\nSEMPRE USAR:\n${sempreDizer.map((r) => `• "${r}"`).join("\n")}`;
  }
  if (nuncaDizer.length > 0) {
    regrasTexto += `\n\nNUNCA DIZER:\n${nuncaDizer.map((r) => `• "${r}"`).join("\n")}`;
  }
  if (snapshot.regras_ia.length > 0) {
    const parts = snapshot.regras_ia
      .map((r) => String(r.instrucao ?? "").trim())
      .filter(Boolean);
    if (parts.length > 0) {
      regrasTexto += `\n\nREGRAS ESPECÍFICAS:\n${parts.map((p) => `• ${p}`).join("\n")}`;
    }
  }
  if (regrasTexto) secoes.push(`═══ REGRAS ═══\n${regrasTexto}`);

  secoes.push(`═══ REGRAS UNIVERSAIS ═══
- Máximo 3 linhas por mensagem no WhatsApp — prefira 1 ou 2
- Responda primeiro a pergunta do cliente, depois conduza
- Nunca mencione que é IA a menos que seja perguntado diretamente
- Se não souber, diga que vai verificar — nunca invente
- Nunca encerre sem indicar o próximo passo`);

  return secoes.join("\n\n");
}

function renderModoOperacionalLines(id: Record<string, unknown>): string[] {
  const lines: string[] = [];
  lines.push("## Contexto operacional (Hub)");
  lines.push("");
  const modo = id.modo_operacao;
  if (isModoOperacaoAgente(modo)) {
    lines.push(`- **Modo de operação:** ${MODO_OPERACAO_LABEL[modo]}`);
  } else if (modo) {
    lines.push(`- **Modo de operação:** \`${String(modo)}\``);
  }
  const ciclo = id.ciclo_execucao_padrao;
  if (typeof ciclo === "string" && ciclo.trim()) {
    lines.push(`- **Ciclo padrão:** ${CICLO_EXEC_LABEL[ciclo] ?? ciclo}`);
  }
  const mistralSync = id.mistral_agent_sync_habilitado === true;
  lines.push(`- **Sincronização Mistral (provisionamento):** ${mistralSync ? "activa" : "inactiva"}`);
  lines.push("");
  lines.push(
    "> Na **conversa real** com lead (WhatsApp / Hub), a engine pode acrescentar memórias, métricas da sessão e outro contexto dinâmico que **não** está neste Markdown estático."
  );
  lines.push("");
  return lines;
}

function renderFerramentasLines(id: Record<string, unknown>): string[] {
  const lines: string[] = [];
  lines.push("## Ferramentas Hub (Mistral function calling)");
  lines.push("");
  const motor = id.motor_ferramentas_habilitado === true;
  lines.push(`**Motor de ferramentas:** ${motor ? "activo" : "inactivo"}.`);
  lines.push("");
  const uso = mergeUsoFerramentasComPadraoPreservandoCustom(id.uso_ferramentas_ia);
  const activas = Object.entries(uso).filter(([, v]) => v === true);
  if (activas.length === 0) {
    lines.push("*Nenhuma ferramenta activa no mapa `uso_ferramentas_ia` para este agente.*");
  } else {
    lines.push("Funções **activas** (o modelo pode pedi-las ao servidor quando o motor está ligado e há sessão de lead):");
    lines.push("");
    for (const [key] of activas) {
      const cat = HUB_AGENTE_FERRAMENTAS_CATALOGO.find((c) => c.id === key);
      if (cat) {
        if (cat.metaCapacidade) {
          lines.push(`- **${cat.titulo}** — capacidade do modelo: ${cat.descricao}`);
        } else if (cat.mistralFunction) {
          lines.push(`- **${cat.titulo}** — \`${cat.mistralFunction.name}\`: ${cat.descricao}`);
        }
      } else {
        lines.push(
          `- **Custom / extensão** — \`${key}\`: ver catálogo em CRM → Ferramentas IA (tenant).`
        );
      }
    }
  }
  lines.push("");
  lines.push(
    "Estas chamadas **não** são executadas no painel «Copiloto IA» em modo revisão interna; apenas na pipeline de atendimento com tools."
  );
  lines.push("");
  return lines;
}

function renderCargoLegivel(cargo: Record<string, unknown>): string[] {
  const out: string[] = [];
  out.push("## Cargo — resumo para operadores (`hub_cargos_catalogo`)");
  out.push("");
  const titulo = cargo.titulo != null ? String(cargo.titulo) : "";
  const descCurta = cargo.descricao_curta != null ? String(cargo.descricao_curta) : "";
  if (titulo) out.push(`**Título:** ${titulo}`);
  if (descCurta) out.push(`**Descrição curta:** ${descCurta}`);
  const promptT = cargo.prompt_template != null ? String(cargo.prompt_template) : "";
  if (promptT.trim()) {
    out.push("");
    out.push("**Modelo de prompt do catálogo:**");
    out.push("");
    out.push(promptT);
  }

  const saudacao = cargo.saudacao_cliente != null ? String(cargo.saudacao_cliente).trim() : "";
  if (saudacao) {
    out.push("");
    out.push(`**Saudação cliente (externo):** ${saudacao}`);
  }
  const comprimento = cargo.comprimento_padrao != null ? String(cargo.comprimento_padrao).trim() : "";
  if (comprimento) {
    out.push(`**Comprimento padrão:** ${comprimento}`);
  }
  const usarPerguntas = cargo.usar_perguntas_essenciais === true;
  const perguntas = Array.isArray(cargo.perguntas_essenciais)
    ? cargo.perguntas_essenciais.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (usarPerguntas) {
    out.push("");
    out.push("### Perguntas essenciais");
    if (perguntas.length > 0) {
      for (const p of perguntas) out.push(`- ${p}`);
    } else {
      out.push("- (ativo, mas sem perguntas preenchidas)");
    }
  }

  const blocoLista = (título: string, arr: unknown) => {
    if (!Array.isArray(arr) || arr.length === 0) return;
    out.push("");
    out.push(`### ${título}`);
    for (const item of arr) out.push(`- ${String(item)}`);
  };

  blocoLista("Responsabilidades", cargo.responsabilidades);
  blocoLista("Limitações", cargo.limitacoes);
  blocoLista("Liberações API (referência do cargo)", cargo.liberacoes_api);

  const escala = cargo.escala_para;
  if (escala && typeof escala === "object" && !Array.isArray(escala) && Object.keys(escala).length > 0) {
    out.push("");
    out.push("### Escalação (`escala_para`)");
    out.push("");
    out.push("```json");
    out.push(JSON.stringify(escala, null, 2));
    out.push("```");
  }

  out.push("");
  return out;
}

/** Playbook base 100% fiel aos dados persistidos (sem LLM). */
export function renderDeterministicPlaybookMd(
  snapshot: AgentPlaybookSnapshotV1,
  sourceHash: string
): string {
  const id = snapshot.identity;
  if (!id) return "# Erro: identidade vazia\n";

  const nome = String(id.nome ?? snapshot.agente_slug);
  const slug = snapshot.agente_slug;
  const genAt = snapshot.captured_at;

  const lines: string[] = [];

  lines.push("---");
  lines.push(`obra10_playbook_schema: 1`);
  lines.push(`obra10_agente_slug: "${yamlEscape(slug)}"`);
  lines.push(`obra10_agente_nome: "${yamlEscape(nome)}"`);
  lines.push(`obra10_source_content_hash: "${sourceHash}"`);
  lines.push(`obra10_generated_at: "${genAt}"`);
  lines.push(
    `agno_usage: "1) Use **Prompt unificado (produção)** como bloco principal de instructions/description. 2) Respeite **Ferramentas Hub** se integrar function calling. 3) JSON abaixo é auditoria — não contradizer listas literais nem campos canónicos."`
  );
  lines.push("---");
  lines.push("");
  lines.push(`# Playbook — ${nome}`);
  lines.push("");
  lines.push(`> Documento derivado da configuração Obra10+ (tabelas \`hub_*\`). Hash do snapshot: \`${sourceHash}\`.`);
  lines.push("");

  lines.push("## Instruções canónicas (Agno / operação)");
  lines.push("");
  lines.push(
    "- O bloco **Prompt unificado (produção)** espelha o que a função `construirPrompt` da engine monta para o modelo (sem memórias de lead nem mercado injectado)."
  );
  lines.push("- **Ferramentas Hub** listam o function calling activo; alinhar com o runtime (Mistral/Agno) se expuser tools.");
  lines.push("- Seguir limites **Pode / Não pode / Nunca dizer / Sempre dizer** na identidade quando existirem.");
  lines.push("- O comportamento de atendimento externo vem prioritariamente do **cargo** (saudação, perguntas essenciais, comprimento padrão).");
  lines.push("- Regras em **hub_regras_ia** aplicam-se por ordem de `prioridade`.");
  lines.push("- Matriz **hub_autonomia_matriz**: quando `exige_aprovacao` ou limites BRL, não avançar sem aprovação humana.");
  lines.push("- Referência Agno: [Build your first agent](https://docs.agno.com/first-agent).");
  lines.push("");

  lines.push(...renderModoOperacionalLines(id));
  lines.push(...renderFerramentasLines(id));

  lines.push("## Prompt unificado (produção — espelho `construirPrompt`)");
  lines.push("");
  lines.push(
    "Texto abaixo é o **system prompt em camadas** que a engine usa (camada de identidade + conhecimento por secção + regras). Não inclui variáveis de sessão (lead, mercado, memórias)."
  );
  lines.push("");
  lines.push("```text");
  lines.push(buildUnifiedProductionPrompt(snapshot));
  lines.push("```");
  lines.push("");

  lines.push("## Identidade (`hub_agente_identidade`) — auditoria JSON");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(id, null, 2));
  lines.push("```");
  lines.push("");

  if (snapshot.personalidade_row && Object.keys(snapshot.personalidade_row).length > 0) {
    lines.push("## Personalidade (`hub_personalidade`)");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(snapshot.personalidade_row, null, 2));
    lines.push("```");
    lines.push("");
  }

  if (snapshot.regras_ia.length > 0) {
    lines.push("## Regras IA (`hub_regras_ia`)");
    lines.push("");
    for (const r of snapshot.regras_ia) {
      lines.push(`- **${String(r.nome ?? "regra")}** (prioridade ${String(r.prioridade ?? 0)})`);
      if (r.instrucao) lines.push(`  - Instrução: ${String(r.instrucao)}`);
      lines.push("");
    }
  }

  if (snapshot.configuracao && Object.keys(snapshot.configuracao).length > 0) {
    lines.push("## Configuração operacional (`hub_agente_configuracao`)");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(snapshot.configuracao, null, 2));
    lines.push("```");
    lines.push("");
  }

  if (snapshot.autonomia_matriz.length > 0) {
    lines.push("## Autonomia (`hub_autonomia_matriz`)");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(snapshot.autonomia_matriz, null, 2));
    lines.push("```");
    lines.push("");
  }

  if (snapshot.cargo_catalogo && Object.keys(snapshot.cargo_catalogo).length > 0) {
    lines.push(...renderCargoLegivel(snapshot.cargo_catalogo));
    lines.push("## Cargo catálogo — JSON completo");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(snapshot.cargo_catalogo, null, 2));
    lines.push("```");
    lines.push("");
  }

  lines.push("## Texto base bruto (`system_prompt_base` na base de dados)");
  lines.push("");
  lines.push(String(id.system_prompt_base ?? "(vazio)"));
  lines.push("");

  lines.push("## Personalidade textual (campo `personalidade` em identidade)");
  lines.push("");
  lines.push(String(id.personalidade ?? "(vazio)"));
  lines.push("");

  return lines.join("\n");
}
