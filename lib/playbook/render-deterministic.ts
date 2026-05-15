import type { AgentPlaybookSnapshotV1 } from "./agent-snapshot";
import { ordemConhecimentoSecao } from "@/lib/hub/conhecimento-secoes";

const SECAO_LABEL: Record<string, string> = {
  fluxo_sdr: "Núcleo operacional — objetivo, triagem e fluxo (POP)",
  empresa: "Sobre o negócio",
  servicos: "Serviços",
  atendimento: "Como atender",
  proibicoes: "Nunca fazer",
  objeccoes: "Objeções comuns",
  exemplos: "Exemplos de atendimento",
};

function yamlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
  lines.push(`agno_usage: "Use as secções 'Instruções canónicas' e 'Texto base do sistema' como base de instructions/description no Agno Agent — não contradizer listas ou citações literais abaixo."`);
  lines.push("---");
  lines.push("");
  lines.push(`# Playbook — ${nome}`);
  lines.push("");
  lines.push(`> Documento derivado da configuração Obra10+ (tabelas \`hub_*\`). Hash do snapshot: \`${sourceHash}\`.`);
  lines.push("");

  lines.push("## Instruções canónicas (Agno)");
  lines.push("");
  lines.push("- Seguir exatamente limites **Pode / Não pode / Nunca dizer / Sempre dizer** quando existirem.");
  lines.push("- O texto em **system_prompt_base** e **personalidade** no Identidade é prioridade operacional.");
  lines.push("- Se existirem linhas em **hub_agente_conhecimento**, tratar como fonte por secção abaixo.");
  lines.push("- Regras em **hub_regras_ia** aplicam-se por ordem de `prioridade`.");
  lines.push("- Matriz **hub_autonomia_matriz**: quando `exige_aprovacao` ou limites BRL, não avançar sem fluxo de aprovação humano.");
  lines.push("- Referência Agno: [Build your first agent](https://docs.agno.com/first-agent).");
  lines.push("");

  lines.push("## Identidade (`hub_agente_identidade`)");
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

  if (snapshot.conhecimento.length > 0) {
    lines.push("## Conhecimento (`hub_agente_conhecimento`)");
    lines.push("");
    const conhOrd = [...snapshot.conhecimento].sort((a, b) => {
      const sa = String(a.secao || "");
      const sb = String(b.secao || "");
      const d = ordemConhecimentoSecao(sa) - ordemConhecimentoSecao(sb);
      if (d !== 0) return d;
      return sa.localeCompare(sb);
    });
    for (const row of conhOrd) {
      const sec = String(row.secao || "");
      const label = SECAO_LABEL[sec] || sec;
      lines.push(`### ${label} (\`${sec}\`) — ${String(row.titulo ?? "")}`);
      lines.push("");
      lines.push(String(row.conteudo ?? ""));
      lines.push("");
    }
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
    lines.push("## Cargo catálogo (`hub_cargos_catalogo` — referência pelo título do cargo)");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(snapshot.cargo_catalogo, null, 2));
    lines.push("```");
    lines.push("");
  }

  lines.push("## Texto base do sistema (campo único `system_prompt_base`)");
  lines.push("");
  lines.push(String(id.system_prompt_base ?? "(vazio)"));
  lines.push("");

  lines.push("## Personalidade textual (campo `personalidade` em identidade)");
  lines.push("");
  lines.push(String(id.personalidade ?? "(vazio)"));
  lines.push("");

  return lines.join("\n");
}
