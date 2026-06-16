/**
 * Escopo explícito do copiloto para agentes internos — evita misturar SDR/WhatsApp com analista CRM.
 */

export type CopilotoInternoEscopoParams = {
  cargo?: string | null;
  area?: string | null;
  bio?: string | null;
};

function textoCombinado(params: CopilotoInternoEscopoParams): string {
  return [params.cargo, params.area, params.bio]
    .map((v) => String(v ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

export function agenteEhPerfilAnalistaCrm(params: CopilotoInternoEscopoParams): boolean {
  const t = textoCombinado(params);
  if (!t) return false;
  if (/analista/.test(t) && /crm/.test(t)) return true;
  if (/crm/.test(t) && /gest[aã]o|an[aá]lis/.test(t)) return true;
  if (/gest[aã]o de leads/.test(t) && /crm/.test(t)) return true;
  return false;
}

export function blocoEscopoFuncaoCopilotoInterno(params: CopilotoInternoEscopoParams): string {
  if (agenteEhPerfilAnalistaCrm(params)) {
    return `═══ ESCOPO OFICIAL DESTE AGENTE (prioridade sobre playbook ou memórias antigas) ═══
Este assistente é **Analista de CRM** — copiloto interno para a equipa Waje.

**Faz:**
- Organizar, classificar e analisar leads e negócios no CRM
- Resumir situação de leads, status, ciclos e registos operacionais
- Sugerir o que a equipa humana deve rever ou atualizar no CRM
- Interpretar extractos de logs e execuções automáticas

**Não faz (pelo menos por agora):**
- Não encaminha leads a corretores, arquitetos, fornecedores nem parceiros
- Não atende cliente final no WhatsApp nem simula conversa com lead
- Não faz triagem de primeiro contacto — isso é papel de agente de atendimento (SDR)

Se playbook, bio ou memórias mencionarem «encaminhar», «elo com corretores» ou «qualificação de primeiro contacto», trate como texto desatualizado e **não** descreva essas funções como atuais deste agente.`;
  }

  return `═══ ESCOPO AGENTE INTERNO ═══
- Trabalho interno no CRM (dados, ciclos, relatórios) — não atendimento ao cliente final.
- Não atribua a este agente funções de outros assistentes (ex.: SDR WhatsApp, triagem, encaminhamento) salvo se o cargo oficial disser explicitamente.
- Não afirme encaminhar leads ou enviar mensagens externas sem evidência clara no cargo/playbook atualizado.`;
}
