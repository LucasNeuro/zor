import { gerarTextoIa } from "@/lib/hub/gerar-texto-ia";

export const TEXTO_SUGESTAO_CONTEXTOS = [
  "followup_passo",
  "playbook_mensagem",
  "playbook_menu_prompt",
  "playbook_input_prompt",
  "playbook_menu_opcao",
  "playbook_complete",
] as const;

export type TextoSugestaoContexto = (typeof TEXTO_SUGESTAO_CONTEXTOS)[number];

export type TextoSugestaoAcao = "sugerir" | "melhorar";

export type AgenteTextoSugestaoCtx = {
  nome: string;
  cargo?: string;
  area?: string;
  tom_voz?: string;
  personalidade?: string;
};

export type TextoSugestaoMeta = {
  passo_ordem?: number;
  tipo_conteudo?: string;
  atraso_label?: string;
  passos_anteriores?: string[];
  step_id?: string;
  step_kind?: string;
  step_title?: string;
  menu_prompt?: string;
  option_id?: string;
};

const SYSTEM = `És redactor de mensagens WhatsApp para o CRM Waje.
Escreve em português (Brasil), tom profissional e humano, adequado ao agente.
Regras:
- Mensagens curtas (ideal até 320 caracteres; máximo 480).
- Pode usar {nome} como placeholder do cliente — mantém exactamente assim.
- Não prometas descontos, liberações ou prazos inventados.
- Sem markdown, sem aspas à volta da mensagem inteira.
- Uma única mensagem por resposta — só o texto final.`;

function isContexto(v: unknown): v is TextoSugestaoContexto {
  return typeof v === "string" && (TEXTO_SUGESTAO_CONTEXTOS as readonly string[]).includes(v);
}

export function isTextoSugestaoContexto(v: unknown): v is TextoSugestaoContexto {
  return isContexto(v);
}

function blocoAgente(agente: AgenteTextoSugestaoCtx): string {
  const linhas = [
    `Agente: ${agente.nome}`,
    agente.cargo ? `Cargo: ${agente.cargo}` : null,
    agente.area ? `Área: ${agente.area}` : null,
    agente.tom_voz ? `Tom de voz: ${agente.tom_voz}` : null,
    agente.personalidade ? `Personalidade: ${agente.personalidade}` : null,
  ].filter(Boolean);
  return linhas.join("\n");
}

function labelContexto(ctx: TextoSugestaoContexto): string {
  switch (ctx) {
    case "followup_passo":
      return "lembrete automático de follow-up WhatsApp (cliente sem responder)";
    case "playbook_mensagem":
      return "mensagem fixa do fluxo WhatsApp (script, não conversa livre da IA)";
    case "playbook_menu_prompt":
      return "pergunta introdutória de um menu de opções no fluxo WhatsApp";
    case "playbook_input_prompt":
      return "pergunta para recolher um dado do cliente no fluxo WhatsApp";
    case "playbook_menu_opcao":
      return "rótulo curto de uma opção num menu WhatsApp";
    case "playbook_complete":
      return "mensagem de encerramento / resumo final do fluxo WhatsApp";
    default:
      return "mensagem WhatsApp";
  }
}

function blocoMeta(ctx: TextoSugestaoContexto, meta: TextoSugestaoMeta): string {
  const partes: string[] = [];
  if (ctx === "followup_passo") {
    if (meta.passo_ordem != null) partes.push(`Passo nº ${meta.passo_ordem} da cadência.`);
    if (meta.tipo_conteudo) partes.push(`Tipo: ${meta.tipo_conteudo}.`);
    if (meta.atraso_label) partes.push(`Dispara após ${meta.atraso_label} sem resposta do cliente.`);
    const ant = (meta.passos_anteriores || []).filter(Boolean);
    if (ant.length) {
      partes.push(`Mensagens dos passos anteriores (não repetir):\n${ant.map((t, i) => `${i + 1}. ${t}`).join("\n")}`);
    }
  } else {
    if (meta.step_id) partes.push(`Step ID: ${meta.step_id}.`);
    if (meta.step_kind) partes.push(`Tipo de passo: ${meta.step_kind}.`);
    if (meta.step_title) partes.push(`Título: ${meta.step_title}.`);
    if (meta.menu_prompt) partes.push(`Menu associado: «${meta.menu_prompt}».`);
    if (meta.option_id) partes.push(`ID da opção: ${meta.option_id}.`);
  }
  return partes.length ? partes.join("\n") : "";
}

function limparRespostaModelo(raw: string): string {
  let t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("«") && t.endsWith("»")) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t.slice(0, 480);
}

export async function sugerirTextoFluxoIa(opts: {
  acao: TextoSugestaoAcao;
  contexto: TextoSugestaoContexto;
  agente: AgenteTextoSugestaoCtx;
  texto_atual?: string;
  meta?: TextoSugestaoMeta;
}): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const atual = (opts.texto_atual || "").trim();
  const meta = opts.meta ?? {};
  const tipo = labelContexto(opts.contexto);

  if (opts.acao === "melhorar" && !atual) {
    return { ok: false, error: "Escreva um rascunho antes de melhorar." };
  }

  const accaoLinha =
    opts.acao === "melhorar"
      ? `Melhora o rascunho abaixo: corrige ortografia, clareza e tom — **sem alterar a intenção nem inventar ofertas**.`
      : `Gera **uma** mensagem nova adequada ao contexto.`;

  const rascunho =
    opts.acao === "melhorar"
      ? `\nRascunho actual:\n${atual}\n`
      : atual
        ? `\nRascunho parcial (podes completar ou reformular):\n${atual}\n`
        : "";

  const extraFollowup =
    opts.contexto === "followup_passo" && meta.passo_ordem != null && meta.passo_ordem >= 3
      ? "\nEste é um passo tardio — pode ser um pouco mais directo que os primeiros, mas continua respeitoso."
      : "";

  const extraMenuOpcao =
    opts.contexto === "playbook_menu_opcao"
      ? "\nO rótulo deve ser curto (2–6 palavras), claro para tocar no WhatsApp."
      : "";

  const user = `${accaoLinha}

Contexto: ${tipo}

${blocoAgente(opts.agente)}
${blocoMeta(opts.contexto, meta) ? `\n${blocoMeta(opts.contexto, meta)}` : ""}
${rascunho}${extraFollowup}${extraMenuOpcao}

Responde só com o texto da mensagem.`;

  const out = await gerarTextoIa({ user, system: SYSTEM, maxTokens: 400 });
  if (!out.ok) return out;
  const texto = limparRespostaModelo(out.texto);
  if (!texto) return { ok: false, error: "Modelo devolveu texto vazio." };
  return { ok: true, texto };
}
