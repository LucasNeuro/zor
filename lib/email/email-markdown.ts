function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Converte markdown leve (**, listas, parágrafos) para HTML de e-mail. */
export function markdownLeveParaHtmlEmail(md: string): string {
  const linhas = md.replace(/\r\n/g, "\n").split("\n");
  const blocos: string[] = [];
  let lista: string[] = [];

  const flushLista = () => {
    if (!lista.length) return;
    blocos.push(`<ul style="margin:0 0 1em;padding-left:1.25em;">${lista.join("")}</ul>`);
    lista = [];
  };

  for (const linha of linhas) {
    const t = linha.trim();
    if (!t) {
      flushLista();
      continue;
    }
    if (t.startsWith("- ") || t.startsWith("* ")) {
      lista.push(`<li style="margin:.25em 0;">${inlineMd(t.slice(2))}</li>`);
      continue;
    }
    flushLista();
    if (t.startsWith("### ")) {
      blocos.push(
        `<h3 style="margin:1em 0 .5em;font-size:15px;font-weight:700;color:#0b2210;">${inlineMd(t.slice(4))}</h3>`
      );
    } else if (t.startsWith("## ")) {
      blocos.push(
        `<h2 style="margin:1em 0 .5em;font-size:16px;font-weight:700;color:#0b2210;">${inlineMd(t.slice(3))}</h2>`
      );
    } else if (t.startsWith("# ")) {
      blocos.push(
        `<h2 style="margin:1em 0 .5em;font-size:16px;font-weight:700;color:#0b2210;">${inlineMd(t.slice(2))}</h2>`
      );
    } else {
      blocos.push(`<p style="margin:0 0 .85em;line-height:1.6;color:#2d4a35;">${inlineMd(t)}</p>`);
    }
  }
  flushLista();
  return blocos.join("\n") || `<p style="margin:0;line-height:1.6;color:#2d4a35;">${inlineMd(md)}</p>`;
}

function inlineMd(texto: string): string {
  let s = escapeHtml(texto);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong style=\"font-weight:700;color:#0b2210;\">$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return s;
}

/** Versão texto simples sem markdown visível (fallback multipart). */
export function markdownLeveParaTextoPlano(md: string): string {
  return md
    .replace(/\r\n/g, "\n")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .trim();
}
