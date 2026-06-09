import { inflateRawSync } from "zlib";

type ZipEntry = { name: string; data: Buffer };

/** Lê entradas ZIP locais (Office Open XML: docx, xlsx, pptx, odt). */
export function* iterZipEntries(buffer: Buffer): Generator<ZipEntry> {
  let offset = 0;
  while (offset + 30 < buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const compression = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    if (nameStart + nameLen > buffer.length) break;

    const name = buffer.toString("utf8", nameStart, nameStart + nameLen).replace(/\\/g, "/");
    const dataStart = nameStart + nameLen + extraLen;
    if (dataStart + compSize > buffer.length) break;

    const compData = buffer.subarray(dataStart, dataStart + compSize);
    offset = dataStart + compSize;

    let raw: Buffer | null = null;
    if (compression === 0) {
      raw = compData;
    } else if (compression === 8) {
      try {
        raw = inflateRawSync(compData);
      } catch {
        raw = null;
      }
    }
    if (raw && raw.length > 0) {
      yield { name, data: raw };
    }
  }
}

export function lerEntradasZip(buffer: Buffer, filtro: (path: string) => boolean): ZipEntry[] {
  const out: ZipEntry[] = [];
  for (const entry of iterZipEntries(buffer)) {
    if (filtro(entry.name)) out.push(entry);
  }
  return out;
}

export function xmlOfficeParaTexto(xml: string): string {
  return xml
    .replace(/<w:tab[^/]*\/>/gi, "\t")
    .replace(/<w:br[^/]*\/>/gi, "\n")
    .replace(/<text:line-break[^/]*\/>/gi, "\n")
    .replace(/<a:p[^>]*>/gi, "\n")
    .replace(/<\/a:p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function extrairTextoDocx(buffer: Buffer): string {
  const entries = lerEntradasZip(
    buffer,
    (p) => p === "word/document.xml" || p.endsWith("/word/document.xml")
  );
  const xml = entries.map((e) => e.data.toString("utf8")).join("\n");
  return xmlOfficeParaTexto(xml);
}

export function extrairTextoOdt(buffer: Buffer): string {
  const entries = lerEntradasZip(buffer, (p) => p === "content.xml" || p.endsWith("/content.xml"));
  const xml = entries.map((e) => e.data.toString("utf8")).join("\n");
  return xmlOfficeParaTexto(xml);
}

function parseSharedStringsXlsx(buffer: Buffer): string[] {
  const entries = lerEntradasZip(
    buffer,
    (p) => p === "xl/sharedStrings.xml" || p.endsWith("/xl/sharedStrings.xml")
  );
  const shared: string[] = [];
  for (const entry of entries) {
    const xml = entry.data.toString("utf8");
    const siNodes = xml.match(/<si[\s\S]*?<\/si>/gi) ?? [];
    for (const si of siNodes) {
      const tNodes = si.match(/<t[^>]*>[\s\S]*?<\/t>/gi) ?? [];
      const text = tNodes
        .map((node) => xmlOfficeParaTexto(node.replace(/<\/?t[^>]*>/gi, "")))
        .join("");
      shared.push(text);
    }
  }
  return shared;
}

export function extrairTextoXlsx(buffer: Buffer): string {
  const sharedStrings = parseSharedStringsXlsx(buffer);
  const parts: string[] = [...sharedStrings.filter(Boolean)];

  const sheetEntries = lerEntradasZip(
    buffer,
    (p) =>
      /xl\/worksheets\/sheet\d+\.xml$/i.test(p) || /\/xl\/worksheets\/sheet\d+\.xml$/i.test(p)
  );
  sheetEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  for (const entry of sheetEntries) {
    const xml = entry.data.toString("utf8");

    for (const node of xml.match(/<is>[\s\S]*?<\/is>/gi) ?? []) {
      const t = node.match(/<t[^>]*>([\s\S]*?)<\/t>/i);
      if (t?.[1]) parts.push(xmlOfficeParaTexto(t[1]));
    }

    for (const node of xml.match(/<c[^>]*\bt="s"[^>]*>[\s\S]*?<\/c>/gi) ?? []) {
      const idxMatch = node.match(/<v>(\d+)<\/v>/);
      if (!idxMatch) continue;
      const text = sharedStrings[Number(idxMatch[1])];
      if (text) parts.push(text);
    }

    for (const node of xml.match(/<c[^>]*>[\s\S]*?<\/c>/gi) ?? []) {
      if (/\bt="s"/i.test(node) || /<is>/i.test(node)) continue;
      const v = node.match(/<v>([^<]+)<\/v>/);
      if (v?.[1]) parts.push(v[1].trim());
    }
  }

  return [...new Set(parts.filter((p) => p.length > 0))].join("\n");
}

export function extrairTextoPptx(buffer: Buffer): string {
  const entries = lerEntradasZip(
    buffer,
    (p) => /ppt\/slides\/slide\d+\.xml$/i.test(p) || /\/ppt\/slides\/slide\d+\.xml$/i.test(p)
  );
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return entries.map((e) => xmlOfficeParaTexto(e.data.toString("utf8"))).filter(Boolean).join("\n\n");
}
