import type { ModoOperacaoAgente } from "@/lib/hub/agente-modo-operacao";
import { MODO_OPERACAO_LABEL } from "@/lib/hub/agente-modo-operacao";

export const AGENTE_WIZARD_STEP_INTRO: Record<
  1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
  { titulo: string; descricao: string }
> = {
  1: {
    titulo: "Como instruir este agente?",
    descricao:
      "Escolha um cargo do catálogo e/ou carregue um playbook (.md). Pode usar os dois juntos.",
  },
  2: {
    titulo: "Identidade do agente",
    descricao: "Nome do assistente e tipo de operação: atendimento ao cliente ou agente interno.",
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
      "Confira cargo, playbook e tipo de agente. Configure o ciclo padrão e crie o agente no Hub.",
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
    descricao: "Configure o canal de atendimento (WhatsApp ou e-mail) após criar o agente.",
  },
};

export function agenteWizardPasso8Descricao(modo: ModoOperacaoAgente): string {
  if (modo === "canal_email") {
    return "Configure remetente, endereço de entrada e envie um e-mail de teste (Resend). O playbook publicado define o fluxo de atendimento.";
  }
  return "Ligue o WhatsApp da empresa: região UAZAPI, instância e QR/código. O playbook publicado define o fluxo de atendimento.";
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
