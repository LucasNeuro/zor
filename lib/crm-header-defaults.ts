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
      title: "Dashboard",
      subtitle: new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    };
  }

  const seg = parts[1];
  const third = parts[2];

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
      return { title: "Novo Agente IA" };
    }
    return { title: "Agente IA" };
  }

  const map: Record<string, CrmHeaderDefault> = {
    kpis: { title: "Painel de KPIs", subtitle: "Métricas em tempo real — últimas 24h" },
    leads: { title: "Pipeline de Leads" },
    pessoas: { title: "Pessoas" },
    empresas: { title: "Empresas" },
    imoveis: { title: "Imóveis" },
    negocios: { title: "Negócios" },
    atendimento: { title: "Central de Atendimento" },
    aprovacoes: { title: "Central de Aprovações" },
    parceiros: { title: "Parceiros" },
    relatorios: { title: "Relatórios", subtitle: "Exportáveis em PDF e Excel" },
    trafego: {
      title: "Tráfego & Campanhas",
      subtitle: "Dados Windsor.ai · Meta Ads · Google Ads",
    },
    conteudo: {
      title: "Conteúdo & Copy",
      subtitle: "Central de criação de conteúdo — em desenvolvimento",
    },
    agentes: { title: "Agentes IA" },
    ciclos: { title: "Central de Ciclos IA" },
    contatos: {
      title: "Contatos de Notificação",
      subtitle: "Quem recebe alertas de novos leads e aprovações",
    },
    configuracoes: {
      title: "Configurações",
      subtitle: "Regras operacionais sem precisar de programador",
    },
    "onboarding-tenant": {
      title: "Onboarding multi-empresa (piloto)",
      subtitle: "Roteiro interno até o fluxo guiado estar no produto.",
    },
    integracoes: {
      title: "Integrações",
      subtitle: "Conecte suas plataformas de marketing para ver dados reais no escritório virtual.",
    },
  };

  if (map[seg]) return map[seg]!;

  return { title: humanizeSegment(seg) };
}
