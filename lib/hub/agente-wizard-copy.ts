import type { ModoOperacaoAgente } from "@/lib/hub/agente-modo-operacao";
import { MODO_OPERACAO_LABEL } from "@/lib/hub/agente-modo-operacao";

/** Ramo do wizard — escolhido no passo 0 antes do cargo. */
export type WizardTipoAgente = "canal" | "interno";

export const WIZARD_TIPO_LABEL: Record<WizardTipoAgente, string> = {
  canal: "Agente de atendimento",
  interno: "Assistente interno",
};

export const AGENTE_WIZARD_PASSO_0 = {
  titulo: "Que tipo de IA vai criar?",
  descricao:
    "Ambos usam um cargo do catálogo como base (persona, modelo e harness). O que muda é como operam: canal ao vivo com clientes ou copiloto interno da empresa.",
};

export const AGENTE_WIZARD_STEP_INTRO: Record<
  1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
  { titulo: string; descricao: string }
> = {
  1: {
    titulo: "Cargo do catálogo",
    descricao:
      "Escolha o cargo que define a função (base do harness). Opcionalmente combine com playbook (.md).",
  },
  2: {
    titulo: "Identidade do agente",
    descricao: "Nome do assistente. O tipo (atendimento ou interno) foi definido no passo anterior.",
  },
  3: {
    titulo: "Personalidade",
    descricao:
      "Cinco eixos de tom (1–5). Afeta como o agente fala — não altera cargo, fluxo do playbook nem ferramentas.",
  },
  4: {
    titulo: "Conhecimento do agente",
    descricao:
      "Contexto da empresa contratante: texto estruturado (vai para o playbook) e documentos RAG para consulta factual.",
  },
  5: {
    titulo: "Revisão e ciclos",
    descricao:
      "Confira cargo e tipo de agente. Para internos: escolha interação (copiloto/gestor) ou ciclo programado com horário.",
  },
  6: {
    titulo: "Ferramentas Hub",
    descricao:
      "Funções que o modelo pode invocar no servidor (lead, CRM, WhatsApp). Catálogo builtin + custom do tenant.",
  },
  7: {
    titulo: "Materiais — playbook Waje",
    descricao:
      "Publique ou substitua o playbook no Storage. Se já carregou no passo Cargo, o ficheiro deve aparecer aqui.",
  },
  8: {
    titulo: "Canal",
    descricao: "Configure o canal WhatsApp após criar o agente.",
  },
  9: {
    titulo: "Google Workspace",
    descricao:
      "Ligue a conta Google do cliente (Gmail + Agenda). O agente poderá enviar e-mails e criar reuniões com link Meet.",
  },
};

export function agenteWizardPasso8Intro(emailChannelEnabled: boolean): string {
  return emailChannelEnabled
    ? "Configure o canal de atendimento (WhatsApp ou e-mail) após criar o agente."
    : "Configure o canal WhatsApp após criar o agente.";
}

export function agenteWizardPasso8Descricao(
  modo: ModoOperacaoAgente,
  emailChannelEnabled = false,
  comAgendaGoogle = false
): string {
  if (emailChannelEnabled && modo === "canal_email") {
    const base =
      "Configure Gmail (OAuth), ligue a conta Google e envie um e-mail de teste. O playbook publicado define o fluxo de atendimento.";
    return comAgendaGoogle
      ? `${base} Ligue também a agenda Google da empresa na secção abaixo.`
      : base;
  }
  const wa =
    "Ligue o WhatsApp da empresa: região UAZAPI, instância e QR/código. Configure também o follow-up automático (lembretes por passo). O playbook publicado define o fluxo de atendimento.";
  return comAgendaGoogle
    ? `${wa} Na secção 2, autorize a conta Google da empresa para o agente marcar horários e enviar links Meet.`
    : wa;
}

export function modoOperacaoWizardResumo(modo: ModoOperacaoAgente): string {
  return MODO_OPERACAO_LABEL[modo];
}

export function modoInstrucaoWizardResumo(opts: {
  somentePlaybook: boolean;
  temPlaybookCarregado: boolean;
  temCargo: boolean;
}): string {
  if (opts.somentePlaybook) {
    return "Só playbook (sem cargo no catálogo)";
  }
  if (opts.temCargo && opts.temPlaybookCarregado) {
    return "Cargo + playbook (recomendado)";
  }
  if (opts.temCargo) {
    return "Cargo do catálogo (playbook opcional no passo Materiais)";
  }
  return "—";
}
