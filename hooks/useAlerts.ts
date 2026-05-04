"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Alert, AlertArea, AlertSeverity, ALERTS_MOCK } from "@/lib/alerts-system";

let _nextId = 100;

const NEW_ALERT_POOL: Omit<Alert, "id" | "timestamp" | "resolvido">[] = [
  {
    severity: "warning",
    area: "campanhas",
    titulo: "Budget 85% utilizado",
    descricao: "Meta Ads consumiu R$5.1k de R$6k do budget diário. Ritmo acima do esperado.",
    acao_label: "Ajustar limite",
    acao_tipo: "ajustar_budget",
  },
  {
    severity: "info",
    area: "atendimento",
    titulo: "Novo lead qualificado",
    descricao: "Lead #250 qualificado pelo SDR com potencial R$55k. Enviado para o Closer.",
    auto_resolve_ms: 60_000,
  },
  {
    severity: "critical",
    area: "crm",
    titulo: "Lead morno há 72h",
    descricao: "Lead Carlos F. sem contato há 72h. Probabilidade de churn alta.",
    acao_label: "Contatar agora",
    acao_tipo: "contato_lead",
  },
  {
    severity: "warning",
    area: "clientes",
    titulo: "NPS abaixo de 7",
    descricao: "2 clientes avaliaram a semana com NPS 5. Risco de perda do contrato.",
    acao_label: "Ver clientes",
    acao_tipo: "ver_clientes",
  },
  {
    severity: "info",
    area: "criacao",
    titulo: "Copy Meta Ads entregue",
    descricao: "Copy Alpha concluiu a copy da campanha. Aguarda revisão antes de subir.",
    auto_resolve_ms: 90_000,
  },
];

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>(() => [...ALERTS_MOCK]);
  const [newAlert, setNewAlert] = useState<Alert | null>(null);
  const poolIdx = useRef(0);

  const resolveAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolvido: true } : a)));
  }, []);

  const addAlert = useCallback((partial: Omit<Alert, "id" | "timestamp" | "resolvido">) => {
    const alert: Alert = {
      ...partial,
      id: `alt-dyn-${++_nextId}`,
      timestamp: new Date(),
      resolvido: false,
    };
    setAlerts((prev) => [alert, ...prev]);
    setNewAlert(alert);
    if (alert.auto_resolve_ms) {
      setTimeout(() => resolveAlert(alert.id), alert.auto_resolve_ms);
    }
  }, [resolveAlert]);

  useEffect(() => {
    alerts.forEach((a) => {
      if (a.auto_resolve_ms && !a.resolvido) {
        const elapsed = Date.now() - a.timestamp.getTime();
        const remaining = a.auto_resolve_ms - elapsed;
        if (remaining <= 0) {
          resolveAlert(a.id);
        } else {
          const t = setTimeout(() => resolveAlert(a.id), remaining);
          return () => clearTimeout(t);
        }
      }
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const template = NEW_ALERT_POOL[poolIdx.current % NEW_ALERT_POOL.length];
      poolIdx.current++;
      addAlert(template);
    }, 45_000);
    return () => clearInterval(id);
  }, [addAlert]);

  const criticals = alerts.filter((a) => a.severity === "critical" && !a.resolvido);
  const warnings = alerts.filter((a) => a.severity === "warning" && !a.resolvido);
  const feed = alerts.filter((a) => !a.resolvido).slice(0, 8);

  const dismissNew = useCallback(() => setNewAlert(null), []);

  return { alerts, criticals, warnings, feed, newAlert, resolveAlert, addAlert, dismissNew };
}
