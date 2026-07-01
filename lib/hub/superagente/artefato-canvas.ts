import type {
  ArtefatoCanvasSpec,
  GraficoArtefatoSpec,
  KpiArtefatoItem,
  SecaoArtefatoSpec,
} from "@/lib/hub/superagente/types";
import type { ArtefatoBranding } from "@/lib/hub/superagente/artefato-branding";
import { enriquecerSecoesArtefato } from "@/lib/hub/superagente/artefato-enriquecer";
import { corDatasetGrafico, KPI_CORES, KPI_ORDEM_WAJE, type KpiCorToken } from "@/lib/hub/superagente/artefato-paleta";
import { montarHtmlArtefatoShell } from "@/lib/hub/superagente/artefato-shell";
import { publicarArtefatoHtml } from "@/lib/hub/superagente/publicar-artefato-html";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownSimplesParaHtml(md: string): string {
  const inlineMd = (raw: string) => {
    const escaped = escapeHtml(raw);
    return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  };

  return md
    .split(/\r?\n/)
    .map((linha) => {
      const t = linha.trim();
      if (!t) return "";
      if (t.startsWith("### ")) return `<h3>${inlineMd(t.slice(4))}</h3>`;
      if (t.startsWith("## ")) return `<h2>${inlineMd(t.slice(3))}</h2>`;
      if (t.startsWith("# ")) return `<h2>${inlineMd(t.slice(2))}</h2>`;
      if (t.startsWith("- ")) return `<li>${inlineMd(t.slice(2))}</li>`;
      return `<p>${inlineMd(t)}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

const STATUS_BADGE: Record<string, string> = {
  pendente: "badge-warn",
  pago: "badge-ok",
  recebido: "badge-ok",
  cancelado: "badge-muted",
  aberto: "badge-info",
  progress: "badge-ok",
  "em negociação": "badge-info",
  atrasado: "badge-danger",
};

function celulaTabela(valor: string, coluna: string): string {
  const col = coluna.trim().toLowerCase();
  if (col === "status" || col === "estado" || col === "situação") {
    const slug = valor.trim().toLowerCase();
    const cls = STATUS_BADGE[slug] ?? "badge-muted";
    return `<td><span class="badge ${cls}">${escapeHtml(valor)}</span></td>`;
  }
  return `<td>${escapeHtml(valor)}</td>`;
}

function chartScript(grafico: GraficoArtefatoSpec, idx: number, tema: "claro" | "escuro"): { html: string; script: string } {
  const id = `chart_${idx}`;
  const escuro = tema !== "claro";
  const tituloCor = escuro ? "#e8f5e9" : "#0b2210";
  const tickCor = escuro ? "#7a9a7e" : "#5d7a67";
  const gridCor = escuro ? "rgba(63,152,72,0.12)" : "rgba(45,74,53,0.08)";

  const payload = {
    type: grafico.tipo,
    data: {
      labels: grafico.labels,
      datasets: grafico.datasets.map((d, i) => {
        const bg = corDatasetGrafico(grafico.tipo, i, d.data.length, d.cor);
        const border = Array.isArray(bg) ? bg : [bg];
        return {
          label: d.label,
          data: d.data,
          backgroundColor:
            grafico.tipo === "line"
              ? `${Array.isArray(bg) ? bg[0] : bg}44`
              : bg,
          borderColor: grafico.tipo === "line" ? (Array.isArray(bg) ? bg[0] : bg) : border,
          borderWidth: grafico.tipo === "line" ? 2 : 1,
          fill: grafico.tipo === "line",
          tension: 0.35,
        };
      }),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: escuro ? "#b8d4bc" : "#2d4a35",
            font: { size: 11 },
            boxWidth: 12,
            padding: 10,
          },
        },
        title: {
          display: Boolean(grafico.titulo),
          text: grafico.titulo || "",
          color: tituloCor,
          font: { size: 13, weight: "700" },
        },
      },
      scales:
        grafico.tipo === "pie" || grafico.tipo === "doughnut"
          ? {}
          : {
              x: {
                ticks: {
                  color: tickCor,
                  maxRotation: 55,
                  minRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 8,
                  font: { size: 10 },
                },
                grid: { color: gridCor },
              },
              y: {
                ticks: { color: tickCor, font: { size: 10 }, maxTicksLimit: 6 },
                grid: { color: gridCor },
              },
            },
    },
  };

  const html = `<div class="card chart-wrap"><canvas id="${id}"></canvas></div>`;
  const script = `(function(){try{new Chart(document.getElementById('${id}'),${JSON.stringify(payload)});}catch(e){console.error(e);}})();`;
  return { html, script };
}

function renderKpiRow(sec: { titulo?: string; itens: KpiArtefatoItem[] }): string {
  const titulo = sec.titulo?.trim()
    ? `<h2 class="kpi-row-title">${escapeHtml(sec.titulo)}</h2>`
    : "";
  const cards = sec.itens.slice(0, 8).map((item, i) => {
    const token = (item.cor ?? KPI_ORDEM_WAJE[i % KPI_ORDEM_WAJE.length])!;
    const palette = KPI_CORES[token] ?? KPI_CORES.azul;
    const delta =
      item.delta?.trim()
        ? `<span class="kpi-delta ${item.delta_positivo === false ? "kpi-delta-neg" : "kpi-delta-pos"}">${escapeHtml(item.delta)}</span>`
        : "";
    return `<article class="kpi-card" style="--kpi-bg:${palette.bg};--kpi-fg:${palette.fg}">
      <div class="kpi-label">${escapeHtml(item.label)}</div>
      <div class="kpi-valor">${escapeHtml(item.valor)}</div>
      ${delta}
    </article>`;
  });
  return `<section class="kpi-row-wrap">${titulo}<div class="kpi-row">${cards.join("")}</div></section>`;
}

function renderSecao(sec: SecaoArtefatoSpec, idx: number, tema: "claro" | "escuro"): { html: string; scripts: string[] } {
  if (sec.tipo === "kpi_row") {
    return { html: renderKpiRow(sec), scripts: [] };
  }
  if (sec.tipo === "grafico") {
    const c = chartScript(sec.grafico, idx, tema);
    return { html: c.html, scripts: [c.script] };
  }
  if (sec.tipo === "tabela") {
    const titulo = sec.titulo?.trim()
      ? `<h2 class="table-title">${escapeHtml(sec.titulo)}</h2>`
      : "";
    const head = sec.colunas.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
    const body =
      sec.linhas.length > 0
        ? sec.linhas
            .map(
              (row) =>
                `<tr>${row.map((c, ci) => celulaTabela(String(c ?? ""), sec.colunas[ci] ?? "")).join("")}</tr>`
            )
            .join("")
        : `<tr><td colspan="${Math.max(sec.colunas.length, 1)}" class="table-empty">Sem linhas — consulte os dados CRM e republique o relatório.</td></tr>`;
    return {
      html: `<div class="card table-card">${titulo}<span class="table-scroll-hint">Deslize para ver mais colunas →</span><div class="table-scroll" role="region" aria-label="Tabela de dados" tabindex="0"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`,
      scripts: [],
    };
  }
  if (sec.html_seguro?.trim()) {
    return { html: `<div class="card prose">${sec.html_seguro.slice(0, 20_000)}</div>`, scripts: [] };
  }
  return {
    html: `<div class="card prose">${markdownSimplesParaHtml(sec.markdown || "")}</div>`,
    scripts: [],
  };
}

function montarMainHtmlOrdenado(secoes: SecaoArtefatoSpec[], tema: "claro" | "escuro"): { html: string; scripts: string[] } {
  const parts: string[] = [];
  const scripts: string[] = [];
  let chartBuffer: string[] = [];
  let chartIdx = 0;

  const flushCharts = () => {
    if (!chartBuffer.length) return;
    const gridClass = chartBuffer.length === 1 ? "grid-charts grid-charts-single" : "grid-charts";
    parts.push(`<div class="${gridClass}">${chartBuffer.join("")}</div>`);
    chartBuffer = [];
  };

  for (let i = 0; i < secoes.length; i++) {
    const sec = secoes[i]!;
    const idx = sec.tipo === "grafico" ? chartIdx++ : i;
    const { html, scripts: ss } = renderSecao(sec, idx, tema);
    scripts.push(...ss);
    if (sec.tipo === "grafico") {
      chartBuffer.push(html);
    } else {
      flushCharts();
      parts.push(html);
    }
  }
  flushCharts();

  return { html: parts.join("\n"), scripts };
}

export function gerarHtmlArtefatoCanvas(spec: ArtefatoCanvasSpec, branding: ArtefatoBranding): string {
  const secoes = enriquecerSecoesArtefato(spec.secoes);
  const temaCanvas = spec.tema === "escuro" ? "escuro" : "claro";
  const { html: mainHtml, scripts } = montarMainHtmlOrdenado(secoes, temaCanvas);

  const scriptsExtra =
    scripts.length > 0
      ? `<script>document.addEventListener("DOMContentLoaded",function(){${scripts.join("")}});</script>`
      : undefined;

  return montarHtmlArtefatoShell({
    titulo: spec.titulo,
    subtitulo: spec.subtitulo,
    conteudoMainHtml: mainHtml,
    branding,
    tema: temaCanvas,
    scriptsExtra,
  });
}

/** Relatório HTML simples (texto) com o mesmo shell da plataforma. */
export function gerarHtmlArtefatoSimples(
  titulo: string,
  bodyHtml: string,
  branding: ArtefatoBranding
): string {
  return montarHtmlArtefatoShell({
    titulo,
    conteudoMainHtml: `<div class="card prose">${bodyHtml}</div>`,
    branding,
    tema: "claro",
  });
}

export async function publicarArtefatoCanvas(
  spec: ArtefatoCanvasSpec,
  meta: {
    agenteSlug: string;
    tenantId: string;
    telefoneGestor?: string | null;
    branding?: ArtefatoBranding;
  }
): Promise<{ ok: true; url: string; arquivo_id: string } | { ok: false; erro: string }> {
  if (!spec.titulo?.trim() || !spec.secoes?.length) {
    return { ok: false, erro: "titulo_e_secoes_obrigatorios" };
  }

  let branding = meta.branding;
  if (!branding) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) return { ok: false, erro: "supabase_nao_configurado" };
    const { createClient } = await import("@supabase/supabase-js");
    const { carregarBrandingAgenteArtefato } = await import("@/lib/hub/superagente/artefato-branding");
    branding = await carregarBrandingAgenteArtefato(
      createClient(url, key, { auth: { persistSession: false } }),
      meta.tenantId,
      meta.agenteSlug
    );
  }

  const html = gerarHtmlArtefatoCanvas(spec, branding);
  const pub = await publicarArtefatoHtml(html, {
    titulo: spec.titulo,
    agenteSlug: meta.agenteSlug,
    tenantId: meta.tenantId,
    telefoneGestor: meta.telefoneGestor,
    metadata: {
      ferramenta: "hub_superagente_artefato",
      tema: spec.tema ?? "claro",
      secoes: spec.secoes.length,
      agente_nome: branding.agenteNome,
    },
  });

  if (!pub.ok) return { ok: false, erro: pub.erro };

  return { ok: true, url: pub.url, arquivo_id: pub.artefato_id };
}
