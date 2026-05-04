"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  AgentState,
  Particle,
  Connection,
  STATE_VISUALS,
} from "@/lib/agent-states";
import { getScaledRooms, getRoomByPosition, getNavigationPoint, OFFICE_MAP, type Room } from "@/lib/office-map";
import { type LiveLead } from "@/lib/data/live-leads";
import LiveLeadDot from "./LiveLeadDot";

export type Agent = {
  id: string;
  nome: string;
  avatar: string;
  funcao: string;
  area: string;
  sala: string;
  sala_id?: string;
  posicao: { x: number; y: number };
  perfil: {
    humor: string;
    personalidade: string;
    tom_comunicacao: string;
    estilo_trabalho: string;
  };
  status: { online: boolean; modo: string };
  tarefas: { ativas: number; concluidas_hoje: number };
  governanca: { nivel: string; score: number };
  /* API-ready fields */
  currentActivity?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageFrom?: string;
  needsUserDecision?: boolean;
  decisionDescription?: string;
  conversationHistory?: unknown[];
};

export type PacketAnim = {
  id: string;
  fromPos: { x: number; y: number };
  toPos:   { x: number; y: number };
  progress: number;
  color: string;
};

const WORLD_W  = 960;
const WORLD_H  = 540;
const RING_R   = 18;
const FILL_R   = 14;
const HIT_R    = 16;
const BOB_SPEED = 0.0016;
const BOB_AMP   = 2.8;

interface LeadAnim {
  id: string;
  x: number; y: number;
  targetX: number; targetY: number;
  step: number; alpha: number;
  born: number;
}

const LEAD_FLOW = [
  getNavigationPoint("main_entrance",             WORLD_W, WORLD_H) ?? { x: 488, y: 482 },
  getNavigationPoint("waiting_area",              WORLD_W, WORLD_H) ?? { x: 425, y: 413 },
  getNavigationPoint("main_reception_desk",       WORLD_W, WORLD_H) ?? { x: 345, y: 413 },
  getNavigationPoint("active_attendance_stations",WORLD_W, WORLD_H) ?? { x: 557, y: 413 },
];

const SPEECH_COLORS: Record<string, string> = {
  "Executivo":   "#f59e0b",
  "Marketing":   "#22c55e",
  "Estratégia":  "#60a5fa",
  "Conteúdo":    "#a78bfa",
  "Design":      "#f472b6",
  "Performance": "#34d399",
  "Atendimento": "#06b6d4",
  "Comercial":   "#fb923c",
};

function getActivityText(agent: Agent): string {
  if (agent.currentActivity) return agent.currentActivity;
  const fn = agent.funcao.toLowerCase();
  if (fn.includes("ceo"))           return "Revisando metas do trimestre";
  if (fn.includes("gerente"))       return "Coordenando entregas da equipe";
  if (fn.includes("plano"))         return "Elaborando estratégia de campanha";
  if (fn.includes("brief"))         return "Coletando briefing do cliente";
  if (fn.includes("agenda"))        return "Organizando calendário editorial";
  if (fn.includes("copy"))          return "Criando copy para anúncio";
  if (fn.includes("designer grá"))  return "Desenvolvendo arte para Meta Ads";
  if (fn.includes("ui/ux"))         return "Otimizando landing page";
  if (fn.includes("motion"))        return "Animando reel para campanha";
  if (fn.includes("google"))        return "Ajustando lances no Google Ads";
  if (fn.includes("meta"))          return "Escalando campanha no Meta";
  if (fn.includes("analytics"))     return "Analisando performance do período";
  if (fn.includes("social media"))  return "Publicando conteúdo no Instagram";
  if (fn.includes("criador"))       return "Gravando Reels da campanha";
  if (fn.includes("community"))     return "Respondendo comentários";
  if (fn.includes("atendimento ao"))  return "Qualificando lead na fila";
  if (fn.includes("recepcionista"))   return "Recebendo novo contato";
  if (fn.includes("diretor comercial")) return "Supervisionando funil comercial";
  if (fn.includes("gerente de vendas")) return "Revisando pipeline com a equipe";
  if (fn.includes("closer"))           return "Fazendo diagnóstico com lead";
  if (fn.includes("customer success")) return "Acompanhando satisfação do cliente";
  if (fn.includes("especialista crm")) return "Atualizando pipeline no CRM";
  if (fn.includes("gerente de atend")) return "Monitorando fila de atendimento";
  return "Trabalhando em tarefa prioritária";
}

function govColor(score: number): string {
  if (score >= 85) return "#22c55e";
  if (score >= 70) return "#eab308";
  return "#ef4444";
}
function govColorDark(score: number): string {
  if (score >= 85) return "#14532d";
  if (score >= 70) return "#713f12";
  return "#7f1d1d";
}

function getRingColor(
  score: number,
  state: AgentState,
  isSelected: boolean,
  isHovered: boolean,
  ts: number,
  elapsed: number,
): string {
  if (isSelected) return "#f59e0b";
  if (isHovered)  return "#ffffff";
  if (state === "alerta") {
    return Math.floor(ts / 100) % 2 === 0 ? "#ef4444" : "#7f1d1d";
  }
  if (state === "comemorando") {
    if (elapsed < 1500) return Math.floor(elapsed / 250) % 2 === 0 ? "#fbbf24" : "#22c55e";
    return "#fbbf24";
  }
  if (state === "em_reuniao") return "#3b82f6";
  if (state === "aguardando") return "#6b7280";
  if (state in STATE_VISUALS && state !== "trabalhando" && state !== "pausado") {
    return STATE_VISUALS[state].ringColor;
  }
  return govColor(score);
}


function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

interface Props {
  agents: Agent[];
  selectedId: string | null;
  onAgentClick: (agent: Agent) => void;
  posOverridesRef?:    React.MutableRefObject<Record<string, { x: number; y: number }>>;
  packetsRef?:         React.MutableRefObject<PacketAnim[]>;
  statesRef?:          React.MutableRefObject<Record<string, AgentState>>;
  stateTimestampsRef?: React.MutableRefObject<Record<string, number>>;
  particlesRef?:       React.MutableRefObject<Particle[]>;
  connectionsRef?:     React.MutableRefObject<Connection[]>;
  onAgentHover?: (agent: Agent, mouseX: number, mouseY: number) => void;
  onAgentLeave?: () => void;
  liveLeads?: LiveLead[];
  onLeadClick?: (lead: LiveLead) => void;
  selectedAgentId?: string;
}

export function OfficeCanvas({
  agents,
  selectedId,
  onAgentClick,
  posOverridesRef,
  packetsRef,
  statesRef,
  stateTimestampsRef,
  particlesRef,
  connectionsRef,
  onAgentHover,
  onAgentLeave,
  liveLeads,
  onLeadClick,
  selectedAgentId,
}: Props) {
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const containerRef     = useRef<HTMLDivElement>(null);
  const bgRef            = useRef<HTMLImageElement | null>(null);
  const arianeImgRef     = useRef<HTMLImageElement | null>(null);
  const avatarImgsRef    = useRef<Map<string, HTMLImageElement>>(new Map());
  const hoveredId        = useRef<string | null>(null);
  const hoveredRoomRef   = useRef<Room | null>(null);
  const hoverOpacityRef  = useRef<Record<string, number>>({});
  const animRef             = useRef<number>(0);
  const agentsRef           = useRef(agents);
  const selectedRef         = useRef(selectedId);
  const selectedAgentIdRef  = useRef(selectedAgentId);
  const speechBubblesRef = useRef<Array<{ agentId: string; text: string; born: number }>>([]);
  const lastBubbleAddRef = useRef(0);
  const leadsRef         = useRef<LeadAnim[]>([]);
  let   leadIdCounter    = 0;

  useEffect(() => { agentsRef.current         = agents;          }, [agents]);
  useEffect(() => { selectedRef.current       = selectedId;      }, [selectedId]);
  useEffect(() => { selectedAgentIdRef.current = selectedAgentId; }, [selectedAgentId]);

  /* load background */
  useEffect(() => {
    const img = new Image();
    img.src = "/sprites/office-bg.png";
    img.onload = () => { bgRef.current = img; };
  }, []);

  /* load Ariane avatar */
  useEffect(() => {
    const img = new Image();
    img.onload = () => { arianeImgRef.current = img; };
    img.src = '/avatars/ariane/normal.png';
  }, []);

  /* pre-load image avatars */
  useEffect(() => {
    agents.forEach(agent => {
      if (agent.avatar.startsWith('/') && !avatarImgsRef.current.has(agent.id)) {
        const img = new Image();
        img.src = agent.avatar;
        avatarImgsRef.current.set(agent.id, img);
      }
    });
  }, [agents]);

  /* lead arrivals */
  useEffect(() => {
    function spawnLead() {
      const start = LEAD_FLOW[0];
      const lead: LeadAnim = {
        id: `lead-${++leadIdCounter}`,
        x: start.x, y: start.y,
        targetX: start.x, targetY: start.y,
        step: 0, alpha: 1,
        born: performance.now(),
      };
      leadsRef.current.push(lead);
      /* advance through flow steps */
      LEAD_FLOW.forEach((pt, idx) => {
        if (idx === 0) return;
        setTimeout(() => {
          const l = leadsRef.current.find((x) => x.id === lead.id);
          if (l) { l.targetX = pt.x; l.targetY = pt.y; l.step = idx; }
        }, idx * 3500);
      });
      /* fade out and remove after last step */
      setTimeout(() => {
        const l = leadsRef.current.find((x) => x.id === lead.id);
        if (l) l.alpha = 0;
        setTimeout(() => {
          leadsRef.current = leadsRef.current.filter((x) => x.id !== lead.id);
        }, 800);
      }, LEAD_FLOW.length * 3500 + 1000);
    }
    /* first lead after 5s */
    const first = setTimeout(spawnLead, 5000);
    /* then random interval 45-90s */
    const interval = setInterval(spawnLead, 45000 + Math.random() * 45000);
    return () => { clearTimeout(first); clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* animation loop */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cw = container.clientWidth;
      canvas.width  = cw;
      canvas.height = Math.round((cw * WORLD_H) / WORLD_W);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    function loop(ts: number) {
      const canvas = canvasRef.current;
      const ctx    = canvas?.getContext("2d");
      if (!canvas || !ctx) { animRef.current = requestAnimationFrame(loop); return; }

      const S = canvas.width / WORLD_W;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      /* background */
      if (bgRef.current) {
        ctx.drawImage(bgRef.current, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      /* ── room highlights + labels from office-map ── */
      {
        const scaledRooms = getScaledRooms(WORLD_W, WORLD_H);
        const hRoom = hoveredRoomRef.current;
        const bfs = Math.max(7, 8 * S);
        ctx.font = `600 ${bfs}px sans-serif`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";

        for (const room of scaledRooms) {
          const rx = room.x * S;
          const ry = room.y * S;
          const rw = room.width * S;
          const rh = room.height * S;

          /* hover highlight */
          if (hRoom && hRoom.id === room.id) {
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.fillStyle   = "rgba(255,255,255,0.04)";
            roundRect(ctx, rx, ry, rw, rh, 4 * S);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.18)";
            ctx.lineWidth   = 1 * S;
            roundRect(ctx, rx, ry, rw, rh, 4 * S);
            ctx.stroke();
            ctx.restore();
          }

          /* room label */
          const nx = room.navigationPoint.x * S;
          const ny = (room.navigationPoint.y - room.height * 0.38) * S;
          const tw = ctx.measureText(room.label).width;
          const bw = tw + 10 * S;
          const bh = bfs + 6  * S;
          ctx.save();
          ctx.globalAlpha = 0.75;
          ctx.fillStyle   = "rgba(4,8,20,0.82)";
          roundRect(ctx, nx - bw / 2, ny - bh / 2, bw, bh, 3 * S);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.10)";
          ctx.lineWidth   = 0.6 * S;
          roundRect(ctx, nx - bw / 2, ny - bh / 2, bw, bh, 3 * S);
          ctx.stroke();
          ctx.fillStyle = hRoom?.id === room.id ? "#ffffff" : "rgba(255,255,255,0.45)";
          ctx.fillText(room.label, nx, ny);
          ctx.restore();
        }
      }

      /* ── connection lines ── */
      for (const conn of (connectionsRef?.current ?? [])) {
        const fa = agentsRef.current.find((a) => a.id === conn.fromId);
        const ta = agentsRef.current.find((a) => a.id === conn.toId);
        if (!fa || !ta) continue;
        const fov = posOverridesRef?.current[conn.fromId];
        const tov = posOverridesRef?.current[conn.toId];
        const fx  = (fov?.x ?? fa.posicao.x) * S;
        const fy  = (fov?.y ?? fa.posicao.y) * S;
        const tx  = (tov?.x ?? ta.posicao.x) * S;
        const ty  = (tov?.y ?? ta.posicao.y) * S;
        const alpha = Math.min(1, conn.life / 2);
        ctx.save();
        ctx.globalAlpha  = alpha * 0.55;
        ctx.strokeStyle  = conn.color;
        ctx.lineWidth    = 1.8 * S;
        ctx.setLineDash([7 * S, 4 * S]);
        ctx.lineDashOffset = -(conn.dashOffset * S);
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        /* flowing particle along connection line */
        const pT = (ts * 0.001) % 1;
        const pA = Math.sin(pT * Math.PI) * alpha * 0.9;
        if (pA > 0.01) {
          const pX = fx + (tx - fx) * pT;
          const pY = fy + (ty - fy) * pT;
          const pg = ctx.createRadialGradient(pX, pY, 0, pX, pY, 7 * S);
          pg.addColorStop(0, conn.color + "cc");
          pg.addColorStop(1, conn.color + "00");
          ctx.save();
          ctx.globalAlpha = pA;
          ctx.beginPath(); ctx.arc(pX, pY, 7 * S, 0, Math.PI * 2); ctx.fillStyle = pg; ctx.fill();
          ctx.beginPath(); ctx.arc(pX, pY, 3 * S, 0, Math.PI * 2); ctx.fillStyle = conn.color; ctx.fill();
          ctx.restore();
        }
      }

      /* ── agents ── */
      const list  = agentsRef.current;
      const total = list.length;

      for (let i = 0; i < total; i++) {
        const agent = list[i];
        const phase = (i / total) * Math.PI * 2;
        const bob   = Math.sin(ts * BOB_SPEED + phase) * BOB_AMP;

        const ov    = posOverridesRef?.current[agent.id];
        const state = statesRef?.current[agent.id] ?? "trabalhando";

        let baseX = (ov?.x ?? agent.posicao.x);
        let baseY = (ov?.y ?? agent.posicao.y);

        const elapsed = ts - (stateTimestampsRef?.current[agent.id] ?? ts);

        /* celebration bounce */
        if (state === "comemorando" && elapsed < 4000) {
          const t = elapsed / 4000;
          baseY -= Math.sin(t * Math.PI * 3.5) * (1 - t) * 14;
        }

        /* alert shake */
        if (state === "alerta") {
          baseX += Math.sin(ts * 0.05) * 2;
        }

        /* panel highlight bounce */
        const isHighlighted = !!selectedAgentIdRef.current && agent.id === selectedAgentIdRef.current;
        if (isHighlighted) {
          baseY -= Math.sin(ts * 0.005) * 6;
        }

        const ax  = baseX * S;
        const ay  = baseY * S + bob * S;

        const ringColor = getRingColor(agent.governanca.score, state, selectedRef.current === agent.id, hoveredId.current === agent.id, ts, elapsed);
        const colorDark = govColorDark(agent.governanca.score);

        const ringR   = RING_R * S;
        const fillR   = FILL_R * S;
        const hoverSc = hoveredId.current === agent.id ? 1.12 : 1.0;
        const scaleMod = state === "trabalhando"
          ? 1 + Math.max(0, Math.sin(ts * 0.0021 + phase)) * 0.04
          : 1.0;
        const rR = ringR * hoverSc * scaleMod;
        const fR = fillR * hoverSc * scaleMod;

        const pulse = (Math.sin(ts * 0.0024 + phase) + 1) / 2;

        /* panel highlight ring */
        if (isHighlighted) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(ax, ay, rR + 12 * S, 0, Math.PI * 2);
          ctx.strokeStyle = "#f97316";
          ctx.lineWidth = 3 * S;
          ctx.shadowColor = "#f97316";
          ctx.shadowBlur = 20 * S;
          ctx.stroke();
          ctx.restore();
        }

        /* glow */
        if (agent.status.online) {
          const glowAmt = state === "comemorando" ? 10 : 7;
          const glowR = rR + (glowAmt + pulse * 5) * S;
          const grd = ctx.createRadialGradient(ax, ay, fR * 0.4, ax, ay, glowR);
          grd.addColorStop(0, ringColor + "30");
          grd.addColorStop(1, ringColor + "00");
          ctx.beginPath();
          ctx.arc(ax, ay, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
        }

        /* em_reuniao: slow pulsing blue outer ring */
        if (state === "em_reuniao") {
          const mp = (Math.sin(ts * 0.0009 + phase) + 1) / 2;
          ctx.beginPath();
          ctx.arc(ax, ay, rR + (5 + mp * 7) * S, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(59,130,246,${0.18 + mp * 0.28})`;
          ctx.lineWidth   = 1.5 * S;
          ctx.stroke();
        }

        /* aguardando: slow gray pulse ~6s */
        if (state === "aguardando") {
          const ap = (Math.sin(ts * 0.00105 + phase) + 1) / 2;
          ctx.beginPath();
          ctx.arc(ax, ay, rR + (3 + ap * 8) * S, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(107,114,128,${0.12 + ap * 0.22})`;
          ctx.lineWidth   = 1.5 * S;
          ctx.stroke();
        }

        /* ring */
        ctx.beginPath();
        ctx.arc(ax, ay, rR, 0, Math.PI * 2);
        ctx.strokeStyle = ringColor;
        ctx.lineWidth   = (selectedRef.current === agent.id ? 3 : 2.2) * S;
        ctx.stroke();

        /* filled circle + avatar (image or initials) */
        if (agent.nome === 'Ariane' && arianeImgRef.current) {
          const imgW = 52 * S;
          const imgH = 72 * S;

          ctx.save();

          // 1. HALO NO CHÃO — elipse roxa embaixo dos pés
          ctx.beginPath();
          ctx.ellipse(ax, ay + 8 * S, 28 * S, 10 * S, 0, 0, Math.PI * 2);
          const haloGradient = ctx.createRadialGradient(ax, ay + 8 * S, 0, ax, ay + 8 * S, 28 * S);
          haloGradient.addColorStop(0, 'rgba(139,92,246,0.6)');
          haloGradient.addColorStop(0.6, 'rgba(139,92,246,0.25)');
          haloGradient.addColorStop(1, 'rgba(139,92,246,0)');
          ctx.fillStyle = haloGradient;
          ctx.fill();

          // 2. PARTÍCULAS ao redor do halo
          const tempo = Date.now() / 800;
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + tempo;
            const px = ax + Math.cos(angle) * 22 * S;
            const py = ay + 8 * S + Math.sin(angle) * 7 * S;
            const pulso = 0.4 + Math.sin(tempo * 2 + i) * 0.3;
            ctx.beginPath();
            ctx.arc(px, py, 1.5 * S, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(139,92,246,${pulso})`;
            ctx.fill();
          }

          // 3. SOMBRA DO PERSONAGEM
          ctx.shadowColor = 'rgba(139,92,246,0.5)';
          ctx.shadowBlur = 16 * S;

          // 4. AVATAR — maior, SEM clippath, por cima do canvas
          ctx.drawImage(
            arianeImgRef.current,
            ax - imgW / 2,
            ay - imgH + 12 * S,
            imgW,
            imgH
          );

          ctx.restore();

          // 5. NOME TAG elegante abaixo
          ctx.save();
          const tagW = 52 * S;
          const tagH = 14 * S;
          const tagX = ax - tagW / 2;
          const tagY = ay + 14 * S;

          ctx.fillStyle = 'rgba(8,8,16,0.85)';
          ctx.beginPath();
          roundRect(ctx, tagX, tagY, tagW, tagH, 4 * S);
          ctx.fill();

          ctx.strokeStyle = 'rgba(139,92,246,0.7)';
          ctx.lineWidth = 1 * S;
          ctx.stroke();

          ctx.fillStyle = '#c4b5fd';
          ctx.font = `bold ${Math.max(6, 7.5 * S)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('ARIANE ✦', ax, tagY + tagH / 2);
          ctx.restore();
        } else {
          const avatarImg = avatarImgsRef.current.get(agent.id);
          if (agent.avatar.startsWith('/') && avatarImg?.complete && avatarImg.naturalWidth > 0) {
            const imgH = 48 * S;
            const imgW = imgH * (avatarImg.naturalWidth / avatarImg.naturalHeight);
            ctx.save();
            ctx.drawImage(avatarImg, ax - imgW / 2, ay - imgH * 0.92, imgW, imgH);
            ctx.restore();
          } else {
            ctx.save();
            ctx.shadowColor   = "rgba(0,0,0,0.6)";
            ctx.shadowBlur    = 10 * S;
            ctx.shadowOffsetY = 3  * S;
            ctx.beginPath();
            ctx.arc(ax, ay, fR, 0, Math.PI * 2);
            const grd2 = ctx.createRadialGradient(ax - fR * 0.3, ay - fR * 0.3, 0, ax, ay, fR);
            grd2.addColorStop(0, colorDark);
            grd2.addColorStop(1, "#060d1c");
            ctx.fillStyle = grd2;
            ctx.fill();
            ctx.restore();
            const ifs = Math.max(6, Math.min(9, fR * 0.56));
            ctx.font         = `bold ${ifs}px monospace`;
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle    = "#ffffff";
            ctx.fillText(agent.avatar, ax, ay);
          }
        }

        /* online dot */
        const dotAngle = -Math.PI / 4;
        const dotDist  = rR + 1.5 * S;
        const dotX = ax + Math.cos(dotAngle) * dotDist;
        const dotY = ay + Math.sin(dotAngle) * dotDist;
        const dotR = Math.max(3, 3.5 * S) * (agent.status.online ? 1 + pulse * 0.3 : 1);
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR + 1.2 * S, 0, Math.PI * 2);
        ctx.fillStyle = "#080c1a";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = agent.status.online ? "#22c55e" : "#6b7280";
        ctx.fill();

        /* state icon badge above ring */
        if (state !== "trabalhando" && state !== "pausado") {
          const sv  = STATE_VISUALS[state];
          const bfs = Math.max(9, 11 * S);
          ctx.font         = `${bfs}px sans-serif`;
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(sv.icon, ax, ay - rR - 6 * S);
        }

        /* name tag below — skip for Ariane (rendered as full sprite) */
        if (agent.nome !== 'Ariane' || !arianeImgRef.current) {
          const nfs = Math.max(6, 7.5 * S);
          const displayName = agent.nome.length > 10 ? agent.nome.slice(0, 9) + "…" : agent.nome;
          ctx.font         = `bold ${nfs}px sans-serif`;
          ctx.textAlign    = "center";
          ctx.textBaseline = "top";
          const ntw = ctx.measureText(displayName).width;
          const npw = ntw + 8 * S;
          const nph = nfs + 5 * S;
          const npx = ax - npw / 2;
          const npy = ay + rR + 4 * S;

          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur  = 4 * S;
          ctx.fillStyle   = "rgba(8,8,16,0.85)";
          roundRect(ctx, npx, npy, npw, nph, 3 * S);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth   = 0.5;
          roundRect(ctx, npx, npy, npw, nph, 3 * S);
          ctx.stroke();
          ctx.shadowBlur  = 0;
          ctx.fillStyle   = "#e2e8f0";
          ctx.fillText(displayName, ax, npy + 2.5 * S, npw - 4 * S);
          ctx.restore();

          /* area tooltip — fades in/out on hover */
          const prevOp = hoverOpacityRef.current[agent.id] ?? 0;
          const targetOp = hoveredId.current === agent.id ? 1 : 0;
          const newOp = prevOp + (targetOp - prevOp) * 0.12;
          hoverOpacityRef.current[agent.id] = newOp;

          if (newOp > 0.01) {
            const areaLabel = agent.area || '';
            ctx.font = `${Math.max(5, 6.5 * S)}px sans-serif`;
            const atw = ctx.measureText(areaLabel).width;
            const apw = atw + 10 * S;
            const aph = Math.max(5, 6.5 * S) + 6 * S;
            const apx = ax - apw / 2;
            const apy = npy + nph + 3 * S;

            ctx.save();
            ctx.globalAlpha = newOp;
            ctx.fillStyle   = "rgba(15,15,30,0.95)";
            roundRect(ctx, apx, apy, apw, aph, 3 * S);
            ctx.fill();
            ctx.strokeStyle = "rgba(139,92,246,0.5)";
            ctx.lineWidth   = 0.5;
            roundRect(ctx, apx, apy, apw, aph, 3 * S);
            ctx.stroke();
            ctx.fillStyle    = "#c4b5fd";
            ctx.textAlign    = "center";
            ctx.textBaseline = "top";
            ctx.fillText(areaLabel, ax, apy + 3 * S);
            ctx.restore();
          }
        }
      }

      /* ── speech bubbles ── */
      {
        /* expire old bubbles */
        speechBubblesRef.current = speechBubblesRef.current.filter((b) => ts - b.born < 6200);

        /* add new bubble if < 3 active and enough time since last add */
        if (speechBubblesRef.current.length < 3 && ts - lastBubbleAddRef.current > 2400) {
          const available = list.filter((a) => !speechBubblesRef.current.some((b) => b.agentId === a.id));
          if (available.length > 0) {
            const pick = available[Math.floor(Math.random() * available.length)];
            const raw  = getActivityText(pick);
            const txt  = raw.length > 52 ? raw.slice(0, 52) + "…" : raw;
            speechBubblesRef.current.push({ agentId: pick.id, text: txt, born: ts });
            lastBubbleAddRef.current = ts;
          }
        }

        const bfs = Math.max(8, 10 * S);
        ctx.font = `${bfs}px sans-serif`;

        for (const bubble of speechBubblesRef.current) {
          const agent = list.find((a) => a.id === bubble.agentId);
          if (!agent) continue;

          const elapsed   = ts - bubble.born;
          const lifeRatio = elapsed / 6000;
          let alpha: number;
          if (lifeRatio < 0.07)      alpha = lifeRatio / 0.07;
          else if (lifeRatio > 0.82) alpha = Math.max(0, (1 - lifeRatio) / 0.18);
          else                        alpha = 1;
          if (alpha <= 0.01) continue;

          const ov  = posOverridesRef?.current[agent.id];
          const ax  = (ov?.x ?? agent.posicao.x) * S;
          const ay  = (ov?.y ?? agent.posicao.y) * S;

          const textW = ctx.measureText(bubble.text).width;
          const bw    = Math.min(textW + 16 * S, 200 * S);
          const bh    = bfs + 11 * S;
          const bx    = Math.max(4 * S, Math.min(ax - bw / 2, canvas.width - bw - 4 * S));
          const flipped = ay - RING_R * S - bh - 14 * S < 4 * S;
          const by_base = flipped
            ? ay + (RING_R + 8) * S
            : ay - RING_R * S - bh - 14 * S;

          const areaColor = SPEECH_COLORS[agent.area] ?? "#60a5fa";

          ctx.save();
          ctx.globalAlpha = alpha;

          /* bubble background */
          roundRect(ctx, bx, by_base, bw, bh, 5 * S);
          ctx.fillStyle = "rgba(6,12,30,0.94)";
          ctx.fill();

          /* bubble border */
          roundRect(ctx, bx, by_base, bw, bh, 5 * S);
          ctx.strokeStyle = areaColor + "60";
          ctx.lineWidth   = 0.9 * S;
          ctx.stroke();

          /* pointer triangle */
          const tipX = Math.max(ax, bx + 10 * S);
          const tipY = flipped ? by_base : by_base + bh;
          ctx.beginPath();
          ctx.moveTo(tipX - 4 * S, tipY);
          ctx.lineTo(tipX + 4 * S, tipY);
          ctx.lineTo(tipX, flipped ? tipY - 6 * S : tipY + 6 * S);
          ctx.closePath();
          ctx.fillStyle = "rgba(6,12,30,0.94)";
          ctx.fill();

          /* text */
          ctx.font         = `${bfs}px sans-serif`;
          ctx.fillStyle    = "#cbd5e1";
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(bubble.text, bx + bw / 2, by_base + bh / 2, bw - 8 * S);

          ctx.restore();
        }
      }

      /* ── packet animations ── */
      for (const pkt of (packetsRef?.current ?? [])) {
        const t  = pkt.progress;
        const fx = pkt.fromPos.x * S;
        const fy = pkt.fromPos.y * S;
        const tx = pkt.toPos.x   * S;
        const ty = pkt.toPos.y   * S;
        const mx = (fx + tx) / 2;
        const my = Math.min(fy, ty) - 80 * S;
        const px = (1 - t) ** 2 * fx + 2 * (1 - t) * t * mx + t ** 2 * tx;
        const py = (1 - t) ** 2 * fy + 2 * (1 - t) * t * my + t ** 2 * ty;

        const gg = ctx.createRadialGradient(px, py, 0, px, py, 14 * S);
        gg.addColorStop(0, pkt.color + "cc");
        gg.addColorStop(1, pkt.color + "00");
        ctx.beginPath();
        ctx.arc(px, py, 14 * S, 0, Math.PI * 2);
        ctx.fillStyle = gg;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, 5 * S, 0, Math.PI * 2);
        ctx.fillStyle = pkt.color;
        ctx.fill();

        ctx.font         = `${Math.max(10, 12 * S)}px sans-serif`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("📦", px, py - 7 * S);
      }

      /* ── particles ── */
      for (const prt of (particlesRef?.current ?? [])) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, prt.alpha);
        ctx.beginPath();
        ctx.arc(prt.x * S, prt.y * S, prt.size * S, 0, Math.PI * 2);
        ctx.fillStyle = prt.color;
        ctx.fill();
        ctx.restore();
      }

      /* ── leads ── */
      for (const lead of leadsRef.current) {
        /* smooth lerp toward target */
        lead.x += (lead.targetX - lead.x) * 0.04;
        lead.y += (lead.targetY - lead.y) * 0.04;

        const lx = lead.x * S;
        const ly = lead.y * S;
        const pulse = (Math.sin(ts * 0.005) + 1) / 2;
        const r = (8 + pulse * 3) * S;

        ctx.save();
        ctx.globalAlpha = Math.max(0, lead.alpha);

        /* glow */
        const grd = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 2.2);
        grd.addColorStop(0, "rgba(251,191,36,0.5)");
        grd.addColorStop(1, "rgba(251,191,36,0)");
        ctx.beginPath(); ctx.arc(lx, ly, r * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();

        /* circle */
        ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2);
        ctx.fillStyle = "#fbbf24"; ctx.fill();

        /* label */
        const lfs = Math.max(7, 8 * S);
        ctx.font         = `bold ${lfs}px sans-serif`;
        ctx.textAlign    = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle    = "#ffffff";
        ctx.fillText("Lead", lx, ly - r - 2 * S);

        ctx.restore();
      }

      /* watermark */
      ctx.save();
      ctx.textAlign    = "right";
      ctx.textBaseline = "bottom";
      ctx.font         = `bold ${Math.max(8, 9 * S)}px monospace`;
      ctx.fillStyle    = "#1e2a42";
      ctx.fillText("OBRA10+ — ESCRITÓRIO VIRTUAL", canvas.width - 10, canvas.height - 6);
      ctx.restore();

      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* hit detection */
  const getAgent = useCallback((cx: number, cy: number): Agent | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const S    = canvas.width / WORLD_W;
    const wx   = (cx - rect.left)  * (canvas.width  / rect.width);
    const wy   = (cy - rect.top)   * (canvas.height / rect.height);
    for (const agent of agentsRef.current) {
      const ov = posOverridesRef?.current[agent.id];
      const ax = (ov?.x ?? agent.posicao.x) * S;
      const ay = (ov?.y ?? agent.posicao.y) * S;
      if (Math.sqrt((wx - ax) ** 2 + (wy - ay) ** 2) <= HIT_R * S) return agent;
    }
    return null;
  }, [posOverridesRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    const agent = getAgent(e.clientX, e.clientY);
    if (agent) {
      hoveredId.current = agent.id;
      hoveredRoomRef.current = null;
      if (onAgentHover) onAgentHover(agent, e.clientX, e.clientY);
    } else {
      if (hoveredId.current !== null) {
        hoveredId.current = null;
        if (onAgentLeave) onAgentLeave();
      }
      /* room detection */
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const wx = ((e.clientX - rect.left) / rect.width) * WORLD_W;
        const wy = ((e.clientY - rect.top)  / rect.height) * WORLD_H;
        hoveredRoomRef.current = getRoomByPosition(wx, wy, WORLD_W, WORLD_H);
      }
    }
  }, [getAgent, onAgentHover, onAgentLeave]);

  const handleMouseLeave = useCallback(() => {
    hoveredId.current = null;
    hoveredRoomRef.current = null;
    if (onAgentLeave) onAgentLeave();
  }, [onAgentLeave]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const agent = getAgent(e.clientX, e.clientY);
    if (agent) onAgentClick(agent);
  }, [getAgent, onAgentClick]);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl">
      <canvas
        ref={canvasRef}
        className="block w-full cursor-default"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
      {liveLeads && liveLeads.length > 0 && (
        <svg
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
          viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
          preserveAspectRatio="none"
        >
          {liveLeads.map((lead) => (
            <LiveLeadDot
              key={lead.id}
              lead={lead}
              scaleX={1}
              scaleY={1}
              onClick={(l) => onLeadClick?.(l)}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
