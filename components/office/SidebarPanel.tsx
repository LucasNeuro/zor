"use client";

import Link from "next/link";
import { type Metricas } from "@/hooks/useMetricas";

interface SidebarPanelProps {
  painel: string;
  metricas: Metricas;
}

function Stat({ label, value, cor }: { label: string; value: string | number; cor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: "var(--obra-texto-2, #8b949e)" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: cor || "var(--obra-texto, #e6edf3)" }}>{value}</span>
    </div>
  );
}

function NavBtn({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={{
      display: "block", width: "100%", padding: "10px 14px", borderRadius: 8, marginTop: 8,
      background: "rgba(201,162,74,0.1)", border: "1px solid rgba(201,162,74,0.25)",
      color: "var(--obra-dourado, #c9a24a)", fontSize: 12, fontWeight: 700, textAlign: "center",
      textDecoration: "none",
    }}>
      {label} →
    </Link>
  );
}

export function SidebarPanel({ painel, metricas }: SidebarPanelProps) {
  if (painel === "funil_leads" || painel === "pipeline_crm") {
    return (
      <div>
        <Stat label="Leads Hoje" value={metricas.leadsHoje} cor="#22c55e" />
        <Stat label="Aguardando atendimento" value={metricas.leadsAguardando} cor={metricas.leadsAguardando > 0 ? "#c9a24a" : "#34d399"} />
        <Stat label="Receita Potencial" value={metricas.receitaPotencial > 0 ? `R$${(metricas.receitaPotencial / 1000).toFixed(0)}k` : "R$0"} cor="#34d399" />
        <NavBtn href="/crm/leads" label="Ver Pipeline CRM" />
      </div>
    );
  }

  if (painel === "fila_whatsapp" || painel === "conversas_ativas") {
    return (
      <div>
        <Stat label="Fila de mensagens" value={metricas.mensagensFilaPendentes} cor="#22c55e" />
        <Stat label="Aguardando você" value={metricas.leadsAguardando} cor={metricas.leadsAguardando > 0 ? "#c9a24a" : "#34d399"} />
        <Stat label="Aprovações pendentes" value={metricas.aprovacoesPendentes} cor={metricas.aprovacoesPendentes > 0 ? "#ef4444" : "#34d399"} />
        <NavBtn href="/crm/atendimento" label="Abrir Atendimento" />
      </div>
    );
  }

  if (painel === "sla_monitor") {
    return (
      <div>
        <Stat label="Em atendimento" value={metricas.mensagensFilaPendentes} cor="#22c55e" />
        <Stat label="Aguardando resposta" value={metricas.leadsAguardando} cor={metricas.leadsAguardando > 0 ? "#c9a24a" : "#34d399"} />
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(201,162,74,0.05)", border: "1px solid rgba(201,162,74,0.15)", marginTop: 8 }}>
          <p style={{ fontSize: 10, color: "var(--obra-texto-2, #8b949e)", margin: 0, lineHeight: 1.5 }}>
            Meta de SLA: responder em até 5 minutos. Leads aguardando são aqueles sem humano responsável.
          </p>
        </div>
        <NavBtn href="/crm/atendimento" label="Ver Fila de Atendimento" />
      </div>
    );
  }

  if (painel === "aprovacoes_pendentes") {
    return (
      <div>
        <Stat label="Pendentes" value={metricas.aprovacoesPendentes} cor={metricas.aprovacoesPendentes > 0 ? "#ef4444" : "#34d399"} />
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(179,38,30,0.06)", border: "1px solid rgba(179,38,30,0.15)", marginTop: 6, marginBottom: 8 }}>
          <p style={{ fontSize: 10, color: "var(--obra-texto-2, #8b949e)", margin: 0, lineHeight: 1.5 }}>
            Aprovações bloqueiam agentes IA. Revise e decida rapidamente para retomar o atendimento.
          </p>
        </div>
        <NavBtn href="/crm/aprovacoes" label="Revisar Aprovações" />
      </div>
    );
  }

  if (painel === "ias_ativas" || painel === "equipe_online") {
    return (
      <div>
        <Stat label="Agentes ativos" value={metricas.agentesAtivos} cor="#22c55e" />
        <Stat label="Leads hoje" value={metricas.leadsHoje} cor="#60a5fa" />
        <Stat label="Fila mensagens" value={metricas.mensagensFilaPendentes} cor="#a78bfa" />
        <NavBtn href="/crm/agentes" label="Ver Todos os Agentes" />
      </div>
    );
  }

  if (painel === "custos_ia" || painel === "meta_ads" || painel === "google_ads" || painel === "roi_campanhas") {
    return (
      <div>
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(201,162,74,0.05)", border: "1px solid rgba(201,162,74,0.1)", marginBottom: 12 }}>
          <p style={{ fontSize: 10, color: "var(--obra-texto-2, #8b949e)", margin: 0, lineHeight: 1.5 }}>
            Conecte suas contas de anúncios para ver dados reais de custo, CPL e ROAS.
          </p>
        </div>
        <NavBtn href="/crm/integracoes" label="Configurar Integrações" />
      </div>
    );
  }

  if (painel === "logs_decisao") {
    return (
      <div>
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: 12, color: "var(--obra-texto-2, #8b949e)", margin: 0 }}>Histórico de aprovações em breve.</p>
        </div>
        <NavBtn href="/crm/aprovacoes" label="Ver Aprovações Ativas" />
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--obra-texto-2, #8b949e)", lineHeight: 1.5 }}>Seção em desenvolvimento.</p>
    </div>
  );
}
