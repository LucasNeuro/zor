"use client";
import { useState, useEffect, useCallback } from "react";
import {
  LiveLead,
  RESPONSAVEL_POR_SALA,
  getRandomSpawnPosition,
  getNextPhase,
  PHASE_CONFIG,
} from "@/lib/data/live-leads";

const MENSAGENS_LEADS = [
  "Quero reformar minha cozinha completa",
  "Preciso de orçamento para reforma do apartamento",
  "Vi o anúncio, tenho interesse",
  "Qual o prazo de entrega?",
  "Vocês atendem na zona sul de SP?",
  "Qual o valor médio de uma reforma completa?",
  "Quero fazer marcenaria planejada",
  "Procuro arquiteto para projeto residencial",
];

const MENSAGENS_AGENTES = [
  "Olá! Posso te ajudar com seu projeto",
  "Qual é a metragem do espaço?",
  "Qual região você está localizado?",
  "Qual é o seu orçamento estimado?",
  "Temos parceiros especializados na sua região",
  "Pode me contar mais sobre o projeto?",
  "Vou conectar você com o especialista certo",
];

export function useLiveLeads() {
  const [leads, setLeads] = useState<LiveLead[]>([]);

  /* Atualizar timers e verificar SLA */
  useEffect(() => {
    const interval = setInterval(() => {
      setLeads((prev) =>
        prev.map((lead) => {
          const novoTempo = lead.tempo_na_fase_ms + 5000;
          let novaFase = lead.fase;
          if (lead.fase === "aguardando" && novoTempo > lead.sla_target_ms * 3) {
            novaFase = "critico";
          }
          return { ...lead, tempo_na_fase_ms: novoTempo, fase: novaFase };
        })
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  /* Mostrar e esconder bolhas de mensagem */
  useEffect(() => {
    const interval = setInterval(() => {
      setLeads((prev) =>
        prev.map((lead) => {
          if (lead.fase === "qualificando" || lead.fase === "triagem") {
            const mostrar = Math.random() > 0.6;
            if (mostrar) {
              const isAgente = Math.random() > 0.5;
              const msgs = isAgente ? MENSAGENS_AGENTES : MENSAGENS_LEADS;
              const texto = msgs[Math.floor(Math.random() * msgs.length)];
              return {
                ...lead,
                mensagem_visivel: true,
                ultima_mensagem: {
                  texto,
                  de: isAgente ? ("agente" as const) : ("lead" as const),
                  agente_nome: isAgente ? (lead.agente_responsavel_nome ?? "SDR") : undefined,
                  timestamp: new Date(),
                },
              };
            }
          }
          return { ...lead, mensagem_visivel: false };
        })
      );
      setTimeout(() => {
        setLeads((prev) => prev.map((l) => ({ ...l, mensagem_visivel: false })));
      }, 4000);
    }, 7000);
    return () => clearInterval(interval);
  }, []);


  const avancarFase = useCallback((leadId: string) => {
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id !== leadId) return lead;
        const proximaFase = getNextPhase(lead.fase);
        if (!proximaFase) return lead;
        const proximaSala = PHASE_CONFIG[proximaFase].sala;
        const responsavel = RESPONSAVEL_POR_SALA[proximaSala];
        const novaPosicao = getRandomSpawnPosition(proximaSala);
        return {
          ...lead,
          fase: proximaFase,
          sala_atual: proximaSala,
          posicao: novaPosicao,
          tempo_na_fase_ms: 0,
          movendo: true,
          agente_responsavel_id: responsavel.agente_id,
          agente_responsavel_nome: responsavel.agente_nome,
        };
      })
    );
    setTimeout(() => {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, movendo: false } : l)));
    }, 2500);
  }, []);

  const removerLead = useCallback((leadId: string) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, fase: "saindo" } : l)));
    setTimeout(() => {
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
    }, 2000);
  }, []);

  const marcarCritico = useCallback((leadId: string) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, fase: "critico" } : l)));
  }, []);

  return { leads, avancarFase, removerLead, marcarCritico };
}
