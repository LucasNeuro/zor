function humanizeSegment(seg: string): string {
  return seg
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type CrmHeaderDefault = {
  title: string;
  subtitle?: string;
};

export function defaultCrmHeaderForPath(pathname: string): CrmHeaderDefault {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "crm") {
    return { title: "CRM" };
  }

  if (parts.length === 1) {
    return {
      title: "Dashboard & Relatórios",
    };
  }

  const seg = parts[1];
  const third = parts[2];

  if (seg === "atendimento" && third === "equipe") {
    return {
      title: "Equipe",
      subtitle: "Vendedores e atendentes para transferência WhatsApp",
    };
  }

  if (third && seg === "leads") {
    return { title: "Lead" };
  }
  if (third && seg === "lead") {
    return { title: "Lead" };
  }
  if (third && seg === "parceiros") {
    if (third === "novo") {
      return {
        title: "Convidar Parceiro",
        subtitle: "Gere um link de auto-cadastro para um novo parceiro ou profissional.",
      };
    }
    return { title: "Parceiro" };
  }
  if (third && seg === "agentes") {
    if (third === "novo") {
      return { title: "Novo agente IA" };
    }
    return { title: "Agente IA" };
  }
  if (third && seg === "pessoas") {
    return { title: "Pessoa" };
  }
  if (third && seg === "empresas") {
    return { title: "Empresa" };
  }

  const map: Record<string, CrmHeaderDefault> = {
    analytics: { title: "Analytics", subtitle: "KPIs, métricas e tendências — últimas 24h" },
    kpis: { title: "Analytics", subtitle: "KPIs, métricas e tendências — últimas 24h" },
    leads: { title: "Leads", subtitle: "Pipeline do seu escritório — configure os estágios aqui" },
    pessoas: { title: "Pessoas" },
    empresas: { title: "Empresas" },
    imoveis: { title: "Imóveis" },
    negocios: { title: "Negócios", subtitle: "Pipeline comercial do seu escritório" },
    atendimento: { title: "Inbox", subtitle: "Central de conversas e atendimento" },
    aprovacoes: { title: "Central de Aprovações" },
    parceiros: { title: "Parceiros" },
    painel: {
      title: "Dashboard & Relatórios",
    },
    relatorios: {
      title: "Dashboard & Relatórios",
    },
    trafego: {
      title: "Campanhas",
      subtitle: "Dados Windsor.ai · Meta Ads · Google Ads",
    },
    conteudo: {
      title: "Conteúdo & Copy",
      subtitle: "Central de criação de conteúdo — em desenvolvimento",
    },
    agentes: { title: "Agentes IA", subtitle: "Assistentes, playbooks e configuração por agente" },
    "agentes-reais": {
      title: "Copiloto",
      subtitle: "IA operacional global — orquestração de fluxos, playbooks e ciclos",
    },
    ciclos: { title: "Ciclos de agentes", subtitle: "Agenda, intervalos e execução programada dos agentes IA" },
    canais: {
      title: "Canais WhatsApp",
      subtitle: "Instâncias UAZAPI conectadas aos agentes — operação e status",
    },
    ferramentas: { title: "Ferramentas IA", subtitle: "Catálogo de ferramentas e uso por agente" },
    conhecimento: {
      title: "Conhecimento",
      subtitle: "Base documental da empresa para cargos e agentes IA",
    },
    contatos: {
      title: "Contatos de Notificação",
      subtitle: "Quem recebe alertas de novos leads e aprovações",
    },
    usuarios: {
      title: "Usuários & Permissões",
      subtitle: "Gestão de equipe e papéis — em construção",
    },
    configuracoes: {
      title: "Conta",
      subtitle: "Regras operacionais sem precisar de programador",
    },
    cadastro: {
      title: "Leads",
      subtitle: "Pipeline do seu escritório — configure os estágios aqui",
    },
    "onboarding-tenant": {
      title: "Onboarding",
      subtitle: "Configuração inicial multi-empresa (administradores)",
    },
    integracoes: {
      title: "Integrações",
      subtitle: "Conecte suas plataformas de marketing para ver dados reais no escritório virtual.",
    },
  };

  if (map[seg]) return map[seg]!;

  return { title: humanizeSegment(seg) };
}
