import { describe, expect, it } from "vitest";
import { deflateRawSync } from "zlib";
import { extrairTextoDocx, extrairTextoXlsx } from "./rag-zip";

function zipOneFile(entryName: string, content: string): Buffer {
  const nameBuf = Buffer.from(entryName, "utf8");
  const data = Buffer.from(content, "utf8");
  const compressed = deflateRawSync(data);
  const localHeader = Buffer.alloc(30 + nameBuf.length);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);
  nameBuf.copy(localHeader, 30);
  return Buffer.concat([localHeader, compressed]);
}

describe("rag-zip office", () => {
  it("extrai texto de docx mínimo", () => {
    const xml = `<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Obra10 plus documento comercial para testes de RAG com docx</w:t></w:r></w:p></w:body></w:document>`;
    const buf = zipOneFile("word/document.xml", xml);
    const texto = extrairTextoDocx(buf);
    expect(texto.toLowerCase()).toContain("obra10");
    expect(texto.length).toBeGreaterThan(40);
  });

  it("extrai shared strings de xlsx mínimo", () => {
    const xml = `<?xml version="1.0"?><sst><si><t>Planilha Obra10 com dados suficientes para indexacao RAG</t></si></sst>`;
    const buf = zipOneFile("xl/sharedStrings.xml", xml);
    const texto = extrairTextoXlsx(buf);
    expect(texto.toLowerCase()).toContain("obra10");
  });
});
