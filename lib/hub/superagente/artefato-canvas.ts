import type { ArtefatoCanvasSpec, GraficoArtefatoSpec, SecaoArtefatoSpec } from "@/lib/hub/superagente/types";
import type { ArtefatoBranding } from "@/lib/hub/superagente/artefato-branding";
import { enriquecerSecoesArtefato } from "@/lib/hub/superagente/artefato-enriquecer";
import { montarHtmlArtefatoShell } from "@/lib/hub/superagente/artefato-shell";
import { publicarArtefatoHtml } from "@/lib/hub/superagente/publicar-artefato-html";

const CORES = ["#3f9848", "#2d6a3e", "#5dca68", "#1a4d2e", "#7ab88a", "#b8e6cf"];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownSimplesParaHtml(md: string): string {
  return md
    .split(/\r?\n/)
    .map((linha) => {
      const t = linha.trim();
      if (!t) return "";
      if (t.startsWith("### ")) return `<h3>${escapeHtml(t.slice(4))}</h3>`;
      if (t.startsWith("## ")) return `<h2>${escapeHtml(t.slice(3))}</h2>`;
      if (t.startsWith("# ")) return `<h2>${escapeHtml(t.slice(2))}</h2>`;
      if (t.startsWith("- ")) return `<li>${escapeHtml(t.slice(2))}</li>`;
      return `<p>${escapeHtml(t)}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

function chartScript(grafico: GraficoArtefatoSpec, idx: number, tema: "claro" | "escuro"): { html: string; script: string } {
  const id = `chart_${idx}`;
  const escuro = tema !== "claro";
  const tituloCor = escuro ? "#e8f5e9" : "#0b2210";
  const tickCor = escuro ? "#7a9a7e" : "#5d7a67";
  const gridCor = escuro ? "rgba(63,152,72,0.12)" : "rgba(45,74,53,0.1)";
  const payload = {
    type: grafico.tipo,
    data: {
      labels: grafico.labels,
      datasets: grafico.datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        backgroundColor:
          grafico.tipo === "line"
            ? `${d.cor || CORES[i % CORES.length]}55`
            : (d.cor || CORES[i % CORES.length]),
        borderColor: d.cor || CORES[i % CORES.length],
        borderWidth: grafico.tipo === "line" ? 2 : 1,
        fill: grafico.tipo === "line",
        tension: 0.35,
      })),
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

function renderSecao(sec: SecaoArtefatoSpec, idx: number, tema: "claro" | "escuro"): { html: string; scripts: string[] } {
  if (sec.tipo === "grafico") {
    const c = chartScript(sec.grafico, idx, tema);
    return { html: c.html, scripts: [c.script] };
  }
  if (sec.tipo === "tabela") {
    const head = sec.colunas.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
    const body = sec.linhas
      .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(String(c))}</td>`).join("")}</tr>`)
      .join("");
    return {
      html: `<div class="card table-card"><span class="table-scroll-hint">Deslize para ver mais colunas →</span><div class="table-scroll" role="region" aria-label="Tabela de dados" tabindex="0"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`,
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

export function gerarHtmlArtefatoCanvas(
  spec: ArtefatoCanvasSpec,
  branding: ArtefatoBranding
): string {
  const secoes = enriquecerSecoesArtefato(spec.secoes);
  const temaCanvas = spec.tema === "claro" ? "claro" : "escuro";
  const scripts: string[] = [];
  const blocos: string[] = [];
  const graficos: string[] = [];
  let chartIdx = 0;

  for (let i = 0; i < secoes.length; i++) {
    const sec = secoes[i]!;
    const idx = sec.tipo === "grafico" ? chartIdx++ : i;
    const { html, scripts: ss } = renderSecao(sec, idx, temaCanvas);
    if (sec.tipo === "grafico") graficos.push(html);
    else blocos.push(html);
    scripts.push(...ss);
  }

  const mainHtml = [
    ...blocos,
    graficos.length ? `<div class="grid-charts">${graficos.join("")}</div>` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const scriptsExtra =
    scripts.length > 0
      ? `<script>document.addEventListener("DOMContentLoaded",function(){${scripts.join("")}});</script>`
      : undefined;

  return montarHtmlArtefatoShell({
    titulo: spec.titulo,
    subtitulo: spec.subtitulo,
    conteudoMainHtml: mainHtml,
    branding,
    tema: spec.tema === "claro" ? "claro" : "escuro",
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
    tema: "escuro",
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
      tema: spec.tema ?? "escuro",
      secoes: spec.secoes.length,
      agente_nome: branding.agenteNome,
    },
  });

  if (!pub.ok) return { ok: false, erro: pub.erro };

  return { ok: true, url: pub.url, arquivo_id: pub.artefato_id };
}
