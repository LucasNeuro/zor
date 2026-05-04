export interface AcaoGovernanca {
  quem_recomenda: string[];
  quem_aprova: string[];
  notificar_usuario: boolean;
  limite_autonomia?: string;
}

export interface GovernanceConfig {
  acoes: Record<string, AcaoGovernanca>;
  ceo_protecao: { reunioes_permitidas: string[]; relacionamentos_diretos: string[] };
  escalada: { nivel_critico: number; nivel_alerta: number; notificar_usuario_em: string[] };
  limites_autonomia: Record<number, { descricao: string; acoes_livres: string[]; acoes_restritas: string[] }>;
}

export const GOVERNANCE: GovernanceConfig = {
  acoes: {
    subir_campanha: {
      quem_recomenda: ["ag-012", "ag-013"],
      quem_aprova: ["ag-001", "ag-002"],
      notificar_usuario: true,
      limite_autonomia: "Budget acima de R$500 requer aprovação da Dir. Marketing",
    },
    aumentar_budget: {
      quem_recomenda: ["ag-012", "ag-013", "ag-014"],
      quem_aprova: ["ag-001", "ag-002"],
      notificar_usuario: true,
      limite_autonomia: "Qualquer aumento acima de 20% exige aprovação do CEO",
    },
    pausar_campanha: {
      quem_recomenda: ["ag-012", "ag-013", "ag-014"],
      quem_aprova: ["ag-001"],
      notificar_usuario: true,
      limite_autonomia: "Pausa emergencial por ROAS < 1.5 é autônoma; demais exigem aprovação",
    },
    publicar_conteudo: {
      quem_recomenda: ["ag-006", "ag-007", "ag-008", "ag-015", "ag-016"],
      quem_aprova: ["ag-001", "ag-015"],
      notificar_usuario: false,
      limite_autonomia: "Conteúdo de marca requer aprovação; posts de rotina são autônomos",
    },
    enviar_proposta: {
      quem_recomenda: ["ag-022", "ag-021"],
      quem_aprova: ["ag-020", "ag-021"],
      notificar_usuario: true,
      limite_autonomia: "Propostas acima de R$10.000 exigem aprovação do Dir. Comercial",
    },
    fechar_contrato: {
      quem_recomenda: ["ag-022"],
      quem_aprova: ["ag-021", "ag-020", "ag-002"],
      notificar_usuario: true,
      limite_autonomia: "Todo fechamento notifica o usuário — sem exceção",
    },
    distribuir_lead: {
      quem_recomenda: ["ag-019", "ag-018"],
      quem_aprova: ["ag-025"],
      notificar_usuario: false,
      limite_autonomia: "Distribuição automática para leads standard; estratégicos notificam o usuário",
    },
    cancelar_cliente: {
      quem_recomenda: ["ag-023"],
      quem_aprova: ["ag-020", "ag-002"],
      notificar_usuario: true,
      limite_autonomia: "Cancelamentos sempre notificam o usuário e o CEO",
    },
    relatorio_usuario: {
      quem_recomenda: ["ag-014", "ag-001", "ag-020"],
      quem_aprova: [],
      notificar_usuario: true,
      limite_autonomia: "Relatórios de performance são sempre enviados ao usuário",
    },
    mudanca_estrategia: {
      quem_recomenda: ["ag-003", "ag-001"],
      quem_aprova: ["ag-002"],
      notificar_usuario: true,
      limite_autonomia: "Qualquer mudança estratégica exige aprovação do CEO e notificação ao usuário",
    },
  },

  ceo_protecao: {
    reunioes_permitidas: ["briefing_executivo"],
    relacionamentos_diretos: ["ag-001", "ag-020"],
  },

  escalada: {
    nivel_critico: 70,
    nivel_alerta: 80,
    notificar_usuario_em: ["fechar_contrato", "cancelar_cliente", "mudanca_estrategia", "aumentar_budget"],
  },

  limites_autonomia: {
    1: {
      descricao: "CEO — autoridade máxima",
      acoes_livres: ["todas"],
      acoes_restritas: [],
    },
    2: {
      descricao: "Diretoria — autonomia estratégica",
      acoes_livres: ["publicar_conteudo", "distribuir_lead", "relatorio_usuario", "pausar_campanha"],
      acoes_restritas: ["fechar_contrato", "cancelar_cliente", "mudanca_estrategia"],
    },
    3: {
      descricao: "Gerência — autonomia operacional",
      acoes_livres: ["publicar_conteudo", "distribuir_lead"],
      acoes_restritas: ["subir_campanha", "aumentar_budget", "enviar_proposta", "fechar_contrato", "cancelar_cliente", "mudanca_estrategia"],
    },
    4: {
      descricao: "Execução — autonomia de rotina",
      acoes_livres: ["publicar_conteudo"],
      acoes_restritas: ["subir_campanha", "aumentar_budget", "pausar_campanha", "enviar_proposta", "fechar_contrato", "distribuir_lead", "cancelar_cliente", "mudanca_estrategia"],
    },
    5: {
      descricao: "Atendimento — autonomia de contato",
      acoes_livres: ["distribuir_lead"],
      acoes_restritas: ["subir_campanha", "aumentar_budget", "pausar_campanha", "publicar_conteudo", "enviar_proposta", "fechar_contrato", "cancelar_cliente", "relatorio_usuario", "mudanca_estrategia"],
    },
  },
};

export function podeExecutar(nivelHierarquico: number, acao: string): boolean {
  const limite = GOVERNANCE.limites_autonomia[nivelHierarquico];
  if (!limite) return false;
  if (limite.acoes_livres.includes("todas")) return true;
  return limite.acoes_livres.includes(acao);
}

export function quemAprova(acao: string): string[] {
  return GOVERNANCE.acoes[acao]?.quem_aprova ?? [];
}

export function precisaNotificarUsuario(acao: string): boolean {
  return GOVERNANCE.acoes[acao]?.notificar_usuario ?? false;
}
