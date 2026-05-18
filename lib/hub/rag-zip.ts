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

export function extrairTextoXlsx(buffer: Buffer): string {
  const entries = lerEntradasZip(
    buffer,
    (p) => p === "xl/sharedStrings.xml" || p.endsWith("/xl/sharedStrings.xml")
  );
  const parts: string[] = [];
  for (const entry of entries) {
    const xml = entry.data.toString("utf8");
    const tNodes = xml.match(/<t[^>]*>[\s\S]*?<\/t>/gi) ?? [];
    for (const node of tNodes) {
      const inner = node.replace(/<t[^>]*>/i, "").replace(/<\/t>/i, "");
      parts.push(xmlOfficeParaTexto(inner));
    }
  }
  return parts.filter(Boolean).join("\n");
}

export function extrairTextoPptx(buffer: Buffer): string {
  const entries = lerEntradasZip(
    buffer,
    (p) => /ppt\/slides\/slide\d+\.xml$/i.test(p) || /\/ppt\/slides\/slide\d+\.xml$/i.test(p)
  );
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return entries.map((e) => xmlOfficeParaTexto(e.data.toString("utf8"))).filter(Boolean).join("\n\n");
}
