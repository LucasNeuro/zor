"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Agent, PacketAnim } from "@/components/office/OfficeCanvas";
import {
  AgentState,
  Particle,
  Connection,
  randomWorkingState,
  emitCelebrationParticles,
  getPhrase,
} from "@/lib/agent-states";
import {
  REUNIOES_VALIDAS,
  FLUXOS,
  FLUXO_COMERCIAL,
  RELACIONAMENTOS,
  type Reuniao,
  type Fluxo,
} from "@/lib/office-intelligence";

const HOME: Record<string, { x: number; y: number }> = {};

export interface OfficeLifeResult {
  posOverridesRef:      React.MutableRefObject<Record<string, { x: number; y: number }>>;
  packetsRef:           React.MutableRefObject<PacketAnim[]>;
  statesRef:            React.MutableRefObject<Record<string, AgentState>>;
  stateTimestampsRef:   React.MutableRefObject<Record<string, number>>;
  particlesRef:         React.MutableRefObject<Particle[]>;
  connectionsRef:       React.MutableRefObject<Connection[]>;
  notification:         string | null;
  activeMeeting:        string | null;
}

export function useOfficeLife(agents: Agent[]): OfficeLifeResult {
  /* init HOME once */
  if (Object.keys(HOME).length === 0) {
    for (const a of agents) HOME[a.id] = { ...a.posicao };
  }

  const posOverridesRef    = useRef<Record<string, { x: number; y: number }>>({});
  const packetsRef         = useRef<PacketAnim[]>([]);
  const statesRef          = useRef<Record<string, AgentState>>(
    Object.fromEntries(agents.map((a) => [a.id, randomWorkingState()])),
  );
  const stateTimestampsRef = useRef<Record<string, number>>(
    Object.fromEntries(agents.map((a) => [a.id, Date.now()])),
  );
  const particlesRef   = useRef<Particle[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const posCurrent     = useRef<Record<string, { x: number; y: number }>>(
    Object.fromEntries(agents.map((a) => [a.id, { ...a.posicao }])),
  );
  const posTarget = useRef<Record<string, { x: number; y: number }>>(
    Object.fromEntries(agents.map((a) => [a.id, { ...a.posicao }])),
  );
  /* track which sala is currently occupied */
  const salaOcupada = useRef<Record<string, boolean>>({});

  const [notification,  setNotification]  = useState<string | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);

  /* ── helpers ── */
  const setState = useCallback((id: string, s: AgentState) => {
    statesRef.current[id] = s;
    stateTimestampsRef.current[id] = Date.now();
  }, []);

  const notify = useCallback((msg: string, ms = 4500) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), ms);
  }, []);

  /* ── RAF: lerp + physics ── */
  useEffect(() => {
    let raf: number;
    let lastTs = performance.now();

    function step(ts: number) {
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;

      const LERP = 0.055;
      for (const id of Object.keys(HOME)) {
        const cur = posCurrent.current[id];
        const tgt = posTarget.current[id];
        if (!cur || !tgt) continue;
        cur.x += (tgt.x - cur.x) * LERP;
        cur.y += (tgt.y - cur.y) * LERP;
        const home = HOME[id];
        if (Math.abs(cur.x - home.x) > 0.5 || Math.abs(cur.y - home.y) > 0.5) {
          posOverridesRef.current[id] = { x: cur.x, y: cur.y };
        } else {
          delete posOverridesRef.current[id];
        }
      }

      packetsRef.current = packetsRef.current
        .map((p) => ({ ...p, progress: p.progress + 0.016 }))
        .filter((p) => p.progress < 1);

      const GRAVITY = 220;
      particlesRef.current = particlesRef.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          vy: p.vy + GRAVITY * dt,
          life: p.life - dt / 1.6,
          alpha: p.life,
        }))
        .filter((p) => p.life > 0);

      connectionsRef.current = connectionsRef.current
        .map((c) => ({ ...c, dashOffset: c.dashOffset + 0.4, life: c.life - dt }))
        .filter((c) => c.life > 0);

      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── move helpers ── */
  const moveAgents = useCallback((ids: string[], to: { x: number; y: number }, spread = 22) => {
    ids.forEach((id, i) => {
      const angle = (i / ids.length) * Math.PI * 2;
      posTarget.current[id] = {
        x: to.x + Math.cos(angle) * (ids.length > 1 ? spread : 0),
        y: to.y + Math.sin(angle) * (ids.length > 1 ? spread * 0.5 : 0),
      };
    });
  }, []);

  const returnHome = useCallback((ids: string[]) => {
    ids.forEach((id) => { posTarget.current[id] = { ...HOME[id] }; });
  }, []);

  const sendPacket = useCallback((fromId: string, toId: string, color = "#60a5fa") => {
    const from = posCurrent.current[fromId] ?? HOME[fromId];
    const to   = posCurrent.current[toId]   ?? HOME[toId];
    if (!from || !to) return;
    packetsRef.current.push({
      id: `pkt-${Date.now()}-${fromId}`,
      fromPos: { x: from.x, y: from.y },
      toPos:   { x: to.x,   y: to.y   },
      progress: 0,
      color,
    });
  }, []);

  const celebrateAgent = useCallback((id: string) => {
    setState(id, "comemorando");
    const pos = posCurrent.current[id] ?? HOME[id];
    if (pos) particlesRef.current.push(...emitCelebrationParticles(pos.x, pos.y));
    setTimeout(() => setState(id, randomWorkingState()), 4500);
  }, [setState]);

  const connectAgents = useCallback((fromId: string, toId: string, color = "#06b6d4", life = 10) => {
    setState(fromId, "conversando");
    setState(toId, "conversando");
    connectionsRef.current.push({
      id: `conn-${Date.now()}`,
      fromId, toId, color,
      dashOffset: 0, life, maxLife: life,
    });
    setTimeout(() => {
      if (statesRef.current[fromId] === "conversando") setState(fromId, randomWorkingState());
      if (statesRef.current[toId]   === "conversando") setState(toId,   randomWorkingState());
    }, life * 1000);
  }, [setState]);

  /* ── run a structured meeting from REUNIOES_VALIDAS ── */
  const runReuniaoValida = useCallback((reuniao: Reuniao) => {
    if (salaOcupada.current[reuniao.sala]) return () => {};
    salaOcupada.current[reuniao.sala] = true;

    const { participantes, sala_posicao, duracao_segundos, nome, descricao } = reuniao;
    moveAgents(participantes, sala_posicao, 22);
    participantes.forEach((id) => setState(id, "em_reuniao"));
    setActiveMeeting(reuniao.id);
    notify(`🤝 ${descricao}`, 6000);

    const t1 = setTimeout(() => {
      returnHome(participantes);
      participantes.forEach((id) => setState(id, randomWorkingState()));
    }, duracao_segundos * 1000);

    const t2 = setTimeout(() => {
      setActiveMeeting(null);
      salaOcupada.current[reuniao.sala] = false;
      notify(`✅ ${nome} concluída — agentes retornando`);
    }, (duracao_segundos + 3) * 1000);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [moveAgents, returnHome, setState, notify]);

  /* ── run a structured workflow from FLUXOS ── */
  const runFluxo = useCallback((fluxo: Fluxo) => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumTime = 0;

    fluxo.etapas.forEach((etapa, idx) => {
      const t = setTimeout(() => {
        setState(etapa.agente, "trabalhando");
        const agentObj = agents.find((a) => a.id === etapa.agente);
        const frase = agentObj
          ? getPhrase(agentObj.perfil.humor, agentObj.perfil.personalidade, "trabalhando")
          : etapa.acao;
        notify(`⚡ ${agentObj?.nome ?? etapa.agente}: ${frase}`, (etapa.duracao - 1) * 1000);
        if (idx < fluxo.etapas.length - 1) {
          const nextId = fluxo.etapas[idx + 1].agente;
          const pktColors = ["#22c55e","#60a5fa","#f472b6","#a78bfa","#34d399","#fbbf24"];
          setTimeout(() => sendPacket(etapa.agente, nextId, pktColors[idx % pktColors.length]), Math.max(0, (etapa.duracao - 2) * 1000));
        }
      }, cumTime * 1000);
      timers.push(t);
      cumTime += etapa.duracao;
    });

    /* celebrate last agent */
    const last = fluxo.etapas[fluxo.etapas.length - 1];
    const celebT = setTimeout(() => celebrateAgent(last.agente), cumTime * 1000);
    timers.push(celebT);

    return () => timers.forEach(clearTimeout);
  }, [setState, notify, sendPacket, celebrateAgent]);

  /* ── simulation timeline ── */
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    /* stagger first meeting occurrences */
    const meetingTimers = REUNIOES_VALIDAS.map((r, idx) => {
      const delay = (6 + idx * 18) * 1000;
      return setTimeout(() => cleanups.push(runReuniaoValida(r)), delay);
    });

    /* stagger first workflow occurrences */
    const fluxoTimers = FLUXOS.map((f, idx) => {
      const delay = (12 + idx * 35) * 1000;
      return setTimeout(() => cleanups.push(runFluxo(f)), delay);
    });

    /* stagger first commercial workflow occurrences */
    const comercialTimers = FLUXO_COMERCIAL.map((f, idx) => {
      const delay = (20 + idx * 25) * 1000;
      return setTimeout(() => cleanups.push(runFluxo(f)), delay);
    });

    /* repeating meetings */
    const meetingIntervals = REUNIOES_VALIDAS.map((r) =>
      setInterval(() => cleanups.push(runReuniaoValida(r)), r.intervalo_minutos * 60 * 1000),
    );

    /* repeating fluxos */
    const fluxoIntervals = FLUXOS.map((f) =>
      setInterval(() => cleanups.push(runFluxo(f)), f.intervalo_minutos * 60 * 1000),
    );

    /* repeating commercial fluxos */
    const comercialIntervals = FLUXO_COMERCIAL.map((f) =>
      setInterval(() => cleanups.push(runFluxo(f)), f.intervalo_minutos * 60 * 1000),
    );

    /* random conversations using RELACIONAMENTOS */
    function runConversation() {
      const pairs = Object.entries(RELACIONAMENTOS)
        .filter(([, targets]) => targets.length > 0)
        .map(([from, targets]) => [from, targets[Math.floor(Math.random() * targets.length)]] as [string, string]);
      if (pairs.length === 0) return () => {};
      const [fromId, toId] = pairs[Math.floor(Math.random() * pairs.length)];
      const fa = agents.find((a) => a.id === fromId);
      const ta = agents.find((a) => a.id === toId);
      const colors = ["#06b6d4","#34d399","#60a5fa","#f472b6","#a78bfa"];
      connectAgents(fromId, toId, colors[Math.floor(Math.random() * colors.length)], 10);
      if (fa && ta) {
        const frase = getPhrase(fa.perfil.humor, fa.perfil.personalidade, "conversando");
        notify(`💬 ${fa.nome} → ${ta.nome}: "${frase}"`, 3500);
      }
      return () => {};
    }

    /* random celebrations */
    function runRandomCelebration() {
      const working = agents.filter((a) => statesRef.current[a.id] === "trabalhando");
      if (working.length === 0) return () => {};
      const agent = working[Math.floor(Math.random() * working.length)];
      celebrateAgent(agent.id);
      notify(`🎉 ${agent.nome} concluiu uma tarefa importante!`, 3500);
      return () => {};
    }

    /* lead arrival at reception */
    function runLeadArrival() {
      setState("ag-019", "conversando");
      notify("👋 Novo lead chegou na Recepção! Atendente Beta em ação...", 4000);
      const t1 = setTimeout(() => {
        celebrateAgent("ag-019");
        sendPacket("ag-019", "ag-018", "#06b6d4");
        notify("✅ Lead qualificado! Passando para Atendente Alpha.", 3500);
      }, 7_000);
      const t2 = setTimeout(() => {
        celebrateAgent("ag-018");
        sendPacket("ag-018", "ag-003", "#22c55e");
        notify("🚀 Atendente Alpha encaminhou lead para Plano IA!", 3500);
      }, 12_000);
      const t3 = setTimeout(() => {
        setState("ag-019", randomWorkingState());
        setState("ag-018", randomWorkingState());
      }, 15_000);
      return () => { [t1,t2,t3].forEach(clearTimeout); };
    }

    const convI = setInterval(() => cleanups.push(runConversation()),    20_000);
    const celebI = setInterval(() => cleanups.push(runRandomCelebration()), 35_000);
    const leadI  = setInterval(() => cleanups.push(runLeadArrival()),       90_000);

    /* first occurrences */
    const t0 = setTimeout(() => cleanups.push(runConversation()),       10_000);
    const t1 = setTimeout(() => cleanups.push(runRandomCelebration()),  28_000);
    const t2 = setTimeout(() => cleanups.push(runLeadArrival()),        40_000);

    return () => {
      meetingTimers.forEach(clearTimeout);
      fluxoTimers.forEach(clearTimeout);
      comercialTimers.forEach(clearTimeout);
      meetingIntervals.forEach(clearInterval);
      fluxoIntervals.forEach(clearInterval);
      comercialIntervals.forEach(clearInterval);
      [convI, celebI, leadI].forEach(clearInterval);
      [t0, t1, t2].forEach(clearTimeout);
      cleanups.forEach((fn) => fn());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    posOverridesRef,
    packetsRef,
    statesRef,
    stateTimestampsRef,
    particlesRef,
    connectionsRef,
    notification,
    activeMeeting,
  };
}
