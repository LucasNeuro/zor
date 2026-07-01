import { BRAND_GREEN, BRAND_MARK_BG } from "@/lib/brand";
import type { ArtefatoBranding } from "@/lib/hub/superagente/artefato-branding";

export type ArtefatoShellTema = "claro" | "escuro";

export type ArtefatoShellParams = {
  titulo: string;
  subtitulo?: string;
  conteudoMainHtml: string;
  branding: ArtefatoBranding;
  tema?: ArtefatoShellTema;
  scriptsExtra?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function cssArtefatoShell(tema: ArtefatoShellTema): string {
  const escuro = tema !== "claro";
  const bg = escuro ? "#060d08" : "#eef1f5";
  const panel = escuro ? BRAND_MARK_BG : "#ffffff";
  const card = escuro
    ? "linear-gradient(165deg, rgba(11, 31, 16, 0.97) 0%, rgba(6, 13, 8, 0.99) 100%)"
    : "#ffffff";
  const fg = escuro ? "#e8f5e9" : "#0b2210";
  const fg2 = escuro ? "#b8d4bc" : "#2d4a35";
  const fgMuted = escuro ? "#7a9a7e" : "#5d7a67";
  const heading = escuro ? "#e8f5e9" : "#0b2210";
  const border = escuro ? "rgba(63, 152, 72, 0.22)" : "#dcebd8";
  const borderStrong = escuro ? "rgba(63, 152, 72, 0.42)" : "#b8d4bc";
  /** Verde marca só em detalhes (ícone, borda) — nunca em títulos ou tabelas. */
  const accentMark = BRAND_GREEN;
  const accentSoft = escuro ? "#5dca68" : BRAND_GREEN;

  return `
  :root{
    --bg:${bg};--panel:${panel};--card:${card};--fg:${fg};--fg2:${fg2};--muted:${fgMuted};
    --heading:${heading};--border:${border};--border-strong:${borderStrong};
    --accent-mark:${accentMark};--accent-soft:${accentSoft};
    --shell-pad:clamp(.75rem,3.5vw,1.25rem);
    --card-pad:clamp(.75rem,3vw,1.05rem);
  }
  *{box-sizing:border-box}
  html{
    -webkit-text-size-adjust:100%;
    text-size-adjust:100%;
  }
  html,body{
    margin:0;padding:0;min-height:100%;width:100%;max-width:100vw;overflow-x:hidden;
    background:var(--bg);color:var(--fg);
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    line-height:1.55;
    font-size:clamp(.875rem,2.8vw,1rem);
  }
  img,svg,video,canvas{max-width:100%;height:auto}
  .shell{
    width:100%;max-width:960px;margin:0 auto;
    padding:var(--shell-pad);
    padding-bottom:calc(2rem + env(safe-area-inset-bottom,0px));
    padding-left:calc(var(--shell-pad) + env(safe-area-inset-left,0px));
    padding-right:calc(var(--shell-pad) + env(safe-area-inset-right,0px));
  }
  .topbar{
    display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;
    padding:.75rem 0 1rem;border-bottom:1px solid var(--border);flex-wrap:wrap;
  }
  .brand{display:flex;align-items:center;gap:.65rem;min-width:0;flex:1 1 auto}
  .brand-mark{
    width:clamp(32px,9vw,36px);height:clamp(32px,9vw,36px);flex-shrink:0;
    border-radius:10px;background:var(--panel);border:1px solid var(--accent-mark);
    display:flex;align-items:center;justify-content:center;
    font-weight:800;font-size:10px;color:var(--accent-soft);letter-spacing:.04em
  }
  .brand-name{font-weight:800;font-size:clamp(.88rem,3.5vw,.95rem);color:var(--heading);line-height:1.2}
  .brand-sub{font-size:clamp(.62rem,2.5vw,.7rem);color:var(--muted);letter-spacing:.06em;text-transform:uppercase}
  .badge{
    flex-shrink:0;font-size:.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
    padding:.3rem .55rem;border-radius:999px;border:1px solid var(--border-strong);
    color:var(--fg2);background:${escuro ? "rgba(63,152,72,.12)" : "#eef7eb"}
  }
  .hero{
    margin:1rem 0;padding:var(--card-pad);border-radius:14px;
    background:var(--card);border:1px solid var(--border-strong);
    border-left:4px solid var(--accent-mark)
  }
  .hero h1{
    margin:0 0 .35rem;font-size:clamp(1.1rem,4.5vw,1.35rem);font-weight:800;
    color:var(--heading);line-height:1.3;word-wrap:break-word;overflow-wrap:anywhere
  }
  .hero .sub{margin:0;font-size:clamp(.85rem,3.2vw,.92rem);color:var(--fg2);word-wrap:break-word}
  .agent{
    display:flex;align-items:flex-start;gap:.75rem;margin-top:.85rem;padding-top:.85rem;
    border-top:1px solid var(--border)
  }
  .agent img{
    width:clamp(44px,12vw,52px);height:clamp(44px,12vw,52px);flex-shrink:0;
    border-radius:50%;object-fit:cover;border:2px solid var(--border-strong);background:var(--panel)
  }
  .agent>div{min-width:0;flex:1}
  .agent-name{font-weight:800;font-size:clamp(.88rem,3.5vw,.95rem);color:var(--heading)}
  .agent-role{font-size:clamp(.75rem,3vw,.8rem);color:var(--fg2)}
  .agent-meta{
    font-size:clamp(.68rem,2.8vw,.72rem);color:var(--muted);margin-top:.15rem;
    word-break:break-word
  }
  main{width:100%;min-width:0}
  main .grid-charts{
    display:grid;grid-template-columns:1fr;gap:1rem;width:100%;margin-bottom:1rem
  }
  main .grid-charts-single{grid-template-columns:1fr}
  @media (min-width:640px){
    main .grid-charts{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
    main .grid-charts-single{grid-template-columns:1fr}
  }
  .kpi-row-wrap{margin:0 0 1rem;width:100%}
  .kpi-row-title{
    margin:0 0 .75rem;font-size:clamp(.88rem,3.5vw,.95rem);font-weight:800;color:var(--heading)
  }
  .kpi-row{
    display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;width:100%
  }
  @media (min-width:720px){
    .kpi-row{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
  }
  .kpi-card{
    border-radius:12px;padding:1rem 1.05rem;min-height:96px;
    background:var(--kpi-bg,#3f9848);color:var(--kpi-fg,#fff);
    box-shadow:0 4px 16px rgba(63,152,72,.22);display:flex;flex-direction:column;justify-content:center;gap:.25rem
  }
  .kpi-label{font-size:.72rem;font-weight:700;opacity:.92;text-transform:uppercase;letter-spacing:.04em}
  .kpi-valor{font-size:clamp(1.15rem,4vw,1.45rem);font-weight:800;line-height:1.15;word-break:break-word}
  .kpi-delta{font-size:.72rem;font-weight:700;margin-top:.15rem;opacity:.95}
  .badge{
    display:inline-block;padding:.2rem .5rem;border-radius:999px;font-size:.68rem;font-weight:700;
    text-transform:capitalize;white-space:nowrap
  }
  .badge-ok{background:rgba(46,204,113,.18);color:#1e8449}
  .badge-warn{background:rgba(243,156,18,.2);color:#b9770e}
  .badge-info{background:rgba(52,152,219,.18);color:#1f6fa8}
  .badge-danger{background:rgba(233,30,99,.15);color:#ad1457}
  .badge-muted{background:rgba(127,140,141,.15);color:#5d6d7e}
  .card{
    background:var(--card);border:1px solid var(--border);border-radius:14px;
    padding:var(--card-pad);margin:0 0 1rem;width:100%;min-width:0;overflow:hidden
  }
  .card h2,.card h3{
    margin:0 0 .65rem;font-size:clamp(.88rem,3.5vw,.95rem);font-weight:800;
    color:var(--heading);word-wrap:break-word
  }
  .card.prose p,.card.prose li{
    margin:.35rem 0;font-size:clamp(.82rem,3.2vw,.9rem);color:var(--fg2);
    word-wrap:break-word;overflow-wrap:anywhere
  }
  .card.prose h2,.card.prose h3{color:var(--heading)}
  .table-card{padding:0;overflow:hidden}
  .table-card .table-title{
    margin:0;padding:var(--card-pad) var(--card-pad) .35rem;
    font-size:clamp(.88rem,3.5vw,.95rem);font-weight:800;color:var(--heading)
  }
  .table-card .table-scroll-hint{
    display:block;padding:.45rem var(--card-pad) 0;font-size:.65rem;color:var(--muted);
    text-align:center
  }
  @media (min-width:768px){.table-card .table-scroll-hint{display:none}}
  .table-scroll{
    width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;
    padding:var(--card-pad);padding-top:.5rem
  }
  table{width:100%;min-width:520px;border-collapse:collapse;font-size:clamp(.75rem,2.8vw,.82rem)}
  th,td{
    border:1px solid var(--border);padding:.45rem .5rem;text-align:left;
    vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere;hyphens:auto
  }
  th{
    background:${escuro ? "rgba(63,152,72,.18)" : "#eef7eb"};color:var(--fg2);
    font-weight:700;font-size:clamp(.65rem,2.5vw,.72rem);
    text-transform:uppercase;letter-spacing:.03em;white-space:nowrap
  }
  td{color:var(--fg2);max-width:280px}
  td.table-empty{text-align:center;color:var(--muted);font-style:italic;padding:1.25rem}
  @media (max-width:639px){td{max-width:200px;font-size:.78rem}}
  tr:nth-child(even) td{background:${escuro ? "rgba(63,152,72,.06)" : "#f6fbf4"}}
  .chart-wrap{
    position:relative;width:100%;min-height:200px;height:clamp(200px,55vw,320px)
  }
  .chart-wrap canvas{
    display:block;width:100%!important;height:100%!important;max-height:none!important
  }
  footer{
    margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border);
    display:flex;flex-direction:column;align-items:flex-start;gap:.65rem
  }
  @media (min-width:480px){
    footer{flex-direction:row;align-items:center;justify-content:space-between;flex-wrap:wrap}
  }
  .foot-agent{display:flex;align-items:center;gap:.55rem;min-width:0}
  .foot-agent img{
    width:28px;height:28px;flex-shrink:0;border-radius:50%;border:1px solid var(--border)
  }
  .foot-text{font-size:clamp(.68rem,2.8vw,.72rem);color:var(--muted);word-wrap:break-word}
  .foot-agent strong{color:var(--heading);font-weight:700}
  @media print{
    .topbar .badge,.table-scroll-hint{display:none}
    body{background:#fff;color:#111}
    .table-scroll{overflow:visible}
    table{min-width:0}
  }
  `;
}

export function montarHtmlArtefatoShell(params: ArtefatoShellParams): string {
  const tema = params.tema ?? "escuro";
  const escuro = tema !== "claro";
  const titulo = escapeHtml(params.titulo.slice(0, 240));
  const sub = params.subtitulo
    ? `<p class="sub">${escapeHtml(params.subtitulo.slice(0, 400))}</p>`
    : "";
  const b = params.branding;
  const cargoLinha = [b.cargo, b.area].filter(Boolean).join(" · ");
  const avatar = escapeHtml(b.avatarUrl);
  const nome = escapeHtml(b.agenteNome);
  const slug = escapeHtml(b.agenteSlug);
  const plat = escapeHtml(b.plataformaNome);

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="mobile-web-app-capable" content="yes"/>
<meta name="theme-color" content="${escuro ? "#060d08" : "#f8fcf6"}"/>
<title>${titulo} — ${plat}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>${cssArtefatoShell(tema)}</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark">IA</div>
      <div>
        <div class="brand-name">${plat}</div>
        <div class="brand-sub">Relatório interativo</div>
      </div>
    </div>
    <span class="badge">Canvas superagente</span>
  </header>
  <section class="hero">
    <h1>${titulo}</h1>
    ${sub}
    <div class="agent">
      <img src="${avatar}" alt="" width="52" height="52" referrerpolicy="no-referrer"/>
      <div>
        <div class="agent-name">${nome}</div>
        <div class="agent-role">${cargoLinha ? escapeHtml(cargoLinha) : "Funcionário IA interno"}</div>
        <div class="agent-meta">Gerado em ${escapeHtml(b.geradoEm)} · ${slug}</div>
      </div>
    </div>
  </section>
  <main>${params.conteudoMainHtml}</main>
  <footer>
    <div class="foot-agent">
      <img src="${avatar}" alt="" width="28" height="28" referrerpolicy="no-referrer"/>
      <span class="foot-text">Preparado por <strong>${nome}</strong></span>
    </div>
    <span class="foot-text">${plat} · dados operacionais do CRM</span>
  </footer>
</div>
${params.scriptsExtra ?? ""}
<script>
(function(){
  function resizeCharts(){
    if(typeof Chart==="undefined")return;
    document.querySelectorAll("canvas").forEach(function(el){
      var ch=Chart.getChart(el);
      if(ch)ch.resize();
    });
  }
  window.addEventListener("resize",resizeCharts,{passive:true});
  window.addEventListener("orientationchange",function(){setTimeout(resizeCharts,120);});
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",function(){setTimeout(resizeCharts,80);});
  }else{setTimeout(resizeCharts,80);}
})();
</script>
</body>
</html>`;
}
