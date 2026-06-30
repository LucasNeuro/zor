import type { ArtefatoCanvasSpec, GraficoArtefatoSpec, SecaoArtefatoSpec } from "@/lib/hub/superagente/types";
import { publicarArtefatoHtml } from "@/lib/hub/superagente/publicar-artefato-html";

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
      if (!t) return "<br/>";
      if (t.startsWith("### ")) return `<h3>${escapeHtml(t.slice(4))}</h3>`;
      if (t.startsWith("## ")) return `<h2>${escapeHtml(t.slice(3))}</h2>`;
      if (t.startsWith("# ")) return `<h1>${escapeHtml(t.slice(2))}</h1>`;
      if (t.startsWith("- ")) return `<li>${escapeHtml(t.slice(2))}</li>`;
      return `<p>${escapeHtml(t)}</p>`;
    })
    .join("\n");
}

function renderGraficoHtml(grafico: GraficoArtefatoSpec, idx: number): string {
  const id = `chart_${idx}`;
  const payload = JSON.stringify({
    type: grafico.tipo,
    data: {
      labels: grafico.labels,
      datasets: grafico.datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        backgroundColor: d.cor || `hsl(${(i * 67) % 360} 55% 45%)`,
        borderColor: d.cor || `hsl(${(i * 67) % 360} 55% 35%)`,
        borderWidth: 1,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { title: { display: Boolean(grafico.titulo), text: grafico.titulo || "" } },
    },
  });
  return `<div class="card"><canvas id="${id}" height="220"></canvas></div>
<script>
(function(){
  const cfg = ${payload};
  new Chart(document.getElementById('${id}'), cfg);
})();
</script>`;
}

function renderSecao(sec: SecaoArtefatoSpec, idx: number): string {
  if (sec.tipo === "grafico") return renderGraficoHtml(sec.grafico, idx);
  if (sec.tipo === "tabela") {
    const head = sec.colunas.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
    const body = sec.linhas
      .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(String(c))}</td>`).join("")}</tr>`)
      .join("");
    return `<div class="card"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  if (sec.html_seguro?.trim()) {
    return `<div class="card prose">${sec.html_seguro.slice(0, 20_000)}</div>`;
  }
  return `<div class="card prose">${markdownSimplesParaHtml(sec.markdown || "")}</div>`;
}

export function gerarHtmlArtefatoCanvas(spec: ArtefatoCanvasSpec): string {
  const escuro = spec.tema !== "claro";
  const bg = escuro ? "#0d1117" : "#f6f8fa";
  const fg = escuro ? "#e6edf3" : "#1f2328";
  const card = escuro ? "#161b22" : "#ffffff";
  const accent = "#3fb950";
  const titulo = escapeHtml(spec.titulo.slice(0, 240));
  const sub = spec.subtitulo ? `<p class="sub">${escapeHtml(spec.subtitulo.slice(0, 400))}</p>` : "";
  const secoes = spec.secoes.map((s, i) => renderSecao(s, i)).join("\n");

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${titulo}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:1.25rem;background:${bg};color:${fg};line-height:1.55}
  h1{font-size:1.35rem;margin:0 0 .25rem;color:${accent}}
  .sub{opacity:.75;margin:0 0 1.25rem;font-size:.95rem}
  .card{background:${card};border:1px solid ${escuro ? "#30363d" : "#d0d7de"};border-radius:12px;padding:1rem;margin:0 0 1rem}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  th,td{border:1px solid ${escuro ? "#30363d" : "#d0d7de"};padding:.45rem .55rem;text-align:left}
  th{background:${escuro ? "#21262d" : "#f6f8fa"}}
  .foot{margin-top:2rem;font-size:.75rem;opacity:.55}
</style>
</head>
<body>
<header><h1>${titulo}</h1>${sub}</header>
<main>${secoes}</main>
<p class="foot">Synkron.IA — artefacto gerado por superagente interno</p>
</body>
</html>`;
}

export async function publicarArtefatoCanvas(
  spec: ArtefatoCanvasSpec,
  meta: {
    agenteSlug: string;
    tenantId: string;
    telefoneGestor?: string | null;
  }
): Promise<{ ok: true; url: string; arquivo_id: string } | { ok: false; erro: string }> {
  if (!spec.titulo?.trim() || !spec.secoes?.length) {
    return { ok: false, erro: "titulo_e_secoes_obrigatorios" };
  }

  const html = gerarHtmlArtefatoCanvas(spec);
  const pub = await publicarArtefatoHtml(html, {
    titulo: spec.titulo,
    agenteSlug: meta.agenteSlug,
    tenantId: meta.tenantId,
    telefoneGestor: meta.telefoneGestor,
    metadata: {
      ferramenta: "hub_superagente_artefato",
      tema: spec.tema ?? "escuro",
      secoes: spec.secoes.length,
    },
  });

  if (!pub.ok) return { ok: false, erro: pub.erro };

  return { ok: true, url: pub.url, arquivo_id: pub.artefato_id };
}
