// Coordenadas percentuais dos agentes no canvas (% da área de exibição)
// Funciona em qualquer resolução — desktop e mobile

export const MAPA_AGENTES: Record<string, { sala: string; x: number; y: number }> = {
  // N1 — CEO
  ceo:                     { sala: "Sala do CEO",               x: 41.5, y: 21.1 },
  // N2 — Diretores
  ariane:                  { sala: "Diretoria Executiva",       x: 27.2, y: 21.1 },
  diretor_comercial:       { sala: "Sala de Reunião 01",        x: 56.3, y: 21.1 },
  diretor_operacoes:       { sala: "Sala de Reunião 02",        x: 68.8, y: 21.1 },
  // N3 — Gestores
  gestor_trafego:          { sala: "Performance & Tráfego",     x: 72.5, y: 44.4 },
  gestor_conteudo:         { sala: "Copy Lab",                  x: 38.8, y: 44.4 },
  gerente_atendimento:     { sala: "Recepção",                  x: 52.8, y: 73.9 },
  gerente_vendas:          { sala: "Recepção",                  x: 58.8, y: 73.9 },
  gestor_projetos:         { sala: "Estratégia & Planejamento", x: 25.0, y: 44.4 },
  // N4 — Executores de Conteúdo
  copywriter:              { sala: "Copy Lab",                  x: 38.1, y: 48.9 },
  designer:                { sala: "Design Studio",             x: 53.8, y: 44.4 },
  motion_designer:         { sala: "Design Studio",             x: 57.8, y: 48.9 },
  social_media:            { sala: "Conteúdo & Mídia",          x: 85.0, y: 44.4 },
  revisor_ia:              { sala: "Conteúdo & Mídia",          x: 89.1, y: 48.9 },
  // N4 — Executores de Tráfego
  analista_trafego_google: { sala: "Performance & Tráfego",     x: 69.4, y: 48.9 },
  analista_trafego_meta:   { sala: "Performance & Tráfego",     x: 73.4, y: 48.9 },
  analytics_ia:            { sala: "Performance & Tráfego",     x: 77.5, y: 44.4 },
  // N4 — Executores Comercial / Vendas
  sdr:                     { sala: "Recepção",                  x: 49.4, y: 73.9 },
  atendente:               { sala: "Recepção",                  x: 55.6, y: 73.9 },
  closer:                  { sala: "Sala de Reunião 01",        x: 53.1, y: 21.1 },
  cs:                      { sala: "Sala de Reunião 02",        x: 65.6, y: 21.1 },
  crm_ia:                  { sala: "Estratégia & Planejamento", x: 21.9, y: 48.9 },
  // N4 — Operações
  dev_ia:                  { sala: "Sala de Servidores",        x: 83.8, y: 21.1 },
  // N5 — Especialistas
  estrategista:            { sala: "Estratégia & Planejamento", x: 25.0, y: 48.9 },
  pesquisador:             { sala: "Estratégia & Planejamento", x: 28.1, y: 48.9 },
  monitor_qualidade:       { sala: "Copa",                      x: 75.6, y: 21.1 },
};

export const CORES_AREA: Record<string, string> = {
  Diretoria:  "#c9a24a",
  Marketing:  "#8b5cf6",
  Conteúdo:   "#10b981",
  Tráfego:    "#3b82f6",
  Comercial:  "#ef4444",
  Vendas:     "#ef4444",
  Atendimento:"#f97316",
  Operações:  "#6b7280",
  Estratégia: "#f59e0b",
  Gestão:     "#06b6d4",
};

export const TAMANHO_NIVEL: Record<number, number> = {
  1: 36,
  2: 32,
  3: 28,
  4: 24,
  5: 22,
};

export function getInitials(cargo: string): string {
  const skip = new Set(["de", "do", "da", "dos", "das", "e", "IA", "ao"]);
  const words = cargo.split(" ").filter(w => w.length > 1 && !skip.has(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return cargo.slice(0, 2).toUpperCase();
}
