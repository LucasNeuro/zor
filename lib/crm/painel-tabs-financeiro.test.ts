import { describe, expect, it } from "vitest";
import { kpisForPainelTab } from "@/lib/crm/painel-tabs";
import type { CrmDashboardState } from "@/hooks/useCrmDashboard";

const dashBase: CrmDashboardState = {
  leadsHoje: 0,
  leadsAguardando: 0,
  aprovacoesPendentes: 0,
  mensagensFilaPendentes: 0,
  agentesAtivos: 0,
  receitaPotencial: 0,
  parceirosAtivos: 0,
  encaminhamentosHoje: 0,
  taxaQualificacao: 22,
  taxaEncaminhamento: 0,
  alertas: [],
  leadsRecentes: [],
  ciclos: [],
  operacao: { negociosAbertos: 2, conversasAtivas: 0, leadsAtivos: 0 },
  loading: false,
  erro: null,
  carregado: true,
  recarregar: () => {},
};

describe("kpisForPainelTab financeiro", () => {
  it("mostra totais de contas a receber/pagar alinhados ao relatório", () => {
    const kpis = kpisForPainelTab("financeiro", dashBase, {
      kpis: {
        aPagarAberto: 0,
        aReceberAberto: 671,
        vencidoTotal: 0,
        vencidoPagar: 0,
        vencidoReceber: 0,
        saldoProjetado: 671,
        vence7dTotal: 0,
        vence7dCount: 0,
      },
      acao: [],
      aprovacoes: [],
      pipeline: {
        receitaPotencialLeads: 0,
        receitaPotencialNegocios: 671,
        negociosSitDown: 0,
      },
      proximosVencimentos: [],
    });

    expect(kpis.find((k) => k.key === "a-receber")?.valor).toMatch(/671/);
    expect(kpis.find((k) => k.key === "saldo")?.valor).toMatch(/671/);
    expect(kpis.find((k) => k.key === "pipeline-neg")?.valor).toMatch(/671/);
  });
});
