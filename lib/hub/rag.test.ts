import { describe, expect, it } from "vitest";
import { deflateRawSync } from "zlib";
import { extrairTextoDocumentoRag } from "./rag";

function buildMinimalPdfLiteralText(text: string): Buffer {
  const stream = `BT /F1 12 Tf 10 700 Td (${text}) Tj ET`;
  const body = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R>>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1>>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R>>endobj
4 0 obj<< /Length ${stream.length}>>stream
${stream}
endstream
endobj
xref
0 5
0000000000 65535 f 
trailer<< /Size 5 /Root 1 0 R>>
startxref
0
%%EOF`;
  return Buffer.from(body, "latin1");
}

function buildMinimalPdfHexText(text: string): Buffer {
  const hex = Buffer.from(text, "latin1").toString("hex").toUpperCase();
  const stream = `BT /F1 12 Tf 10 700 Td <${hex}> Tj ET`;
  const body = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R>>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1>>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R>>endobj
4 0 obj<< /Length ${stream.length}>>stream
${stream}
endstream
endobj
trailer<< /Size 5 /Root 1 0 R>>
%%EOF`;
  return Buffer.from(body, "latin1");
}

describe("extrairTextoDocumentoRag", () => {
  it("extrai texto de PDF com literais (Tj)", () => {
    const buf = buildMinimalPdfLiteralText("Obra10 plus conhecimento comercial SDR exemplo");
    const r = extrairTextoDocumentoRag("teste.pdf", "application/pdf", buf);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.texto).toContain("Obra10");
    }
  });

  it("extrai texto de PDF com hex (<...> Tj)", () => {
    const buf = buildMinimalPdfHexText(
      "Obra10 plus hex encoding para RAG com texto suficiente para passar no limite minimo"
    );
    const r = extrairTextoDocumentoRag("teste.pdf", "application/pdf", buf);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.texto.toLowerCase()).toContain("obra10");
    }
  });

  it("aceita docx com word/document.xml", () => {
    const xml = `<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Conteudo docx Obra10 plus SDR conhecimento comercial longo o bastante</w:t></w:r></w:p></w:body></w:document>`;
    const nameBuf = Buffer.from("word/document.xml", "utf8");
    const data = Buffer.from(xml, "utf8");
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
    const buf = Buffer.concat([localHeader, compressed]);
    const r = extrairTextoDocumentoRag("teste.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buf);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.texto.toLowerCase()).toContain("obra10");
  });

  it("aceita markdown direto", () => {
    const buf = Buffer.from("# Titulo\n\nConteudo suficiente para indexar no RAG do agente.", "utf8");
    const r = extrairTextoDocumentoRag("doc.md", "text/markdown", buf);
    expect(r.ok).toBe(true);
  });
});
