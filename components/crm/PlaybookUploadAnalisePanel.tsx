"use client";

import { Loader2, Download } from "lucide-react";
import {
  PLAYBOOK_EXEMPLO_ARQUIVO,
  PLAYBOOK_EXEMPLO_MD_URL,
} from "@/lib/playbook/playbook-exemplo";

export type PlaybookUploadStatus = "idle" | "hover" | "enviando" | "sucesso" | "erro";

export type PlaybookAnaliseResultado = {
  resumo: string;
  nota: number | null;
  notaComentario: string;
  pontosChave: string[];
  gaps: string[];
  riscos: string[];
  recomendacoes: string[];
  textoBruto: string;
  modelo: string | null;
  origem: "mistral" | "fallback";
};

export const PLAYBOOK_ACCEPT_ATTR = ".md,.txt,text/markdown,text/plain";

type Props = {
  inputId: string;
  modoPreCriacao?: boolean;
  uploadStatus: PlaybookUploadStatus;
  uploadMensagem: string;
  uploadPct: number;
  arquivoNome: string;
  conteudoPreview: string;
  conteudoCarregado: boolean;
  analiseLoading: boolean;
  analisePct: number;
  analiseErro: string;
  analiseResultado: PlaybookAnaliseResultado | null;
  dropzoneBorder: string;
  dropzoneBg: string;
  onHoverChange: (hover: boolean) => void;
  onFileSelect: (file: File) => void;
  onAnalisar: () => void;
};

function corNota(nota: number): string {
  if (nota >= 7.5) return "#3fb950";
  if (nota >= 5) return "#d29922";
  return "#f85149";
}

export function PlaybookUploadAnalisePanel({
  inputId,
  modoPreCriacao = false,
  uploadStatus,
  uploadMensagem,
  uploadPct,
  arquivoNome,
  conteudoPreview,
  conteudoCarregado,
  analiseLoading,
  analisePct,
  analiseErro,
  analiseResultado,
  dropzoneBorder,
  dropzoneBg,
  onHoverChange,
  onFileSelect,
  onAnalisar,
}: Props) {
  const enviando = uploadStatus === "enviando";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {modoPreCriacao ? (
        <p style={{ color: "#8b949e", fontSize: 12, margin: 0, lineHeight: 1.55 }}>
          Carregue o playbook aqui, peça à IA Mistral uma <strong style={{ color: "#e6edf3" }}>nota de qualidade</strong>{" "}
          e só então avance. O arquivo será publicado automaticamente após criar o agente.
        </p>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        aria-label="Área de upload do playbook. Arraste e solte arquivo .md ou .txt."
        onDragEnter={(e) => {
          e.preventDefault();
          if (!enviando) onHoverChange(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!enviando) onHoverChange(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (!enviando) onHoverChange(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          onHoverChange(false);
          if (enviando) return;
          const file = e.dataTransfer.files?.[0] ?? null;
          if (file) onFileSelect(file);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          const input = document.getElementById(inputId);
          if (input instanceof HTMLInputElement) input.click();
        }}
        style={{
          border: dropzoneBorder,
          borderRadius: 12,
          padding: "16px 14px",
          background: dropzoneBg,
          outline: "none",
          cursor: enviando ? "wait" : "pointer",
          transition: "all 140ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ color: "#e6edf3", fontSize: 13, margin: 0, fontWeight: 700 }}>
            {modoPreCriacao ? "Arraste o playbook aqui" : "Upload do playbook (.md ou .txt)"}
          </p>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color:
                uploadStatus === "erro"
                  ? "#f85149"
                  : uploadStatus === "sucesso"
                    ? "#3fb950"
                    : "#8b949e",
            }}
          >
            {uploadStatus === "enviando"
              ? "ENVIANDO"
              : uploadStatus === "sucesso"
                ? "CARREGADO"
                : uploadStatus === "erro"
                  ? "ERRO"
                  : "PRONTO"}
          </span>
        </div>
        <p style={{ color: "#8b949e", fontSize: 12, margin: "8px 0 0", lineHeight: 1.55 }}>
          Arraste e solte o arquivo nesta área ou use o botão para selecionar. Tamanho máximo: 2 MB.
        </p>
        <p style={{ color: "#8b949e", fontSize: 12, margin: "10px 0 0", lineHeight: 1.55 }}>
          Sem modelo?{" "}
          <a
            href={PLAYBOOK_EXEMPLO_MD_URL}
            download={PLAYBOOK_EXEMPLO_ARQUIVO}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#58a6ff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            <Download size={14} aria-hidden />
            Baixar exemplo de playbook (.md)
          </a>
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={enviando}
            onClick={(e) => {
              e.stopPropagation();
              const input = document.getElementById(inputId);
              if (input instanceof HTMLInputElement) input.click();
            }}
            style={{
              borderRadius: 8,
              border: "1px solid #30363d",
              background: "#21262d",
              color: "#c9a24a",
              fontSize: 12,
              fontWeight: 700,
              padding: "8px 12px",
              cursor: enviando ? "wait" : "pointer",
              opacity: enviando ? 0.75 : 1,
            }}
          >
            Selecionar arquivo
          </button>
          <span style={{ color: "#8b949e", fontSize: 12 }}>
            {arquivoNome ? `Arquivo: ${arquivoNome}` : "Nenhum arquivo selecionado."}
          </span>
        </div>
        <input
          id={inputId}
          type="file"
          accept={PLAYBOOK_ACCEPT_ATTR}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0] ?? null;
            e.currentTarget.value = "";
            if (file) onFileSelect(file);
          }}
        />
        {enviando ? (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                width: "100%",
                height: 8,
                borderRadius: 999,
                background: "#21262d",
                border: "1px solid #30363d",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(6, Math.min(100, uploadPct))}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #1f6feb 0%, #58a6ff 100%)",
                  transition: "width 220ms ease",
                }}
              />
            </div>
            <p style={{ color: "#8b949e", fontSize: 11, margin: "6px 0 0" }}>
              {uploadMensagem || "A processar..."}
            </p>
          </div>
        ) : null}
        {uploadMensagem && !enviando ? (
          <p
            style={{
              color: uploadStatus === "erro" ? "#f85149" : "#3fb950",
              fontSize: 12,
              margin: "10px 0 0",
              lineHeight: 1.45,
            }}
          >
            {uploadMensagem}
          </p>
        ) : null}
      </div>

      {conteudoPreview ? (
        <div
          style={{
            background: "#0d1117",
            border: "1px solid #30363d",
            borderRadius: 10,
            padding: 12,
          }}
        >
          <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>PRÉ-VISUALIZAÇÃO</p>
          <pre
            style={{
              margin: 0,
              color: "#c9d1d9",
              fontSize: 11,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 160,
              overflow: "auto",
            }}
          >
            {conteudoPreview}
          </pre>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          onClick={onAnalisar}
          disabled={analiseLoading || enviando || !conteudoCarregado}
          style={{
            width: "100%",
            borderRadius: 8,
            border: "1px solid #c9a24a55",
            background: "#c9a24a18",
            color: "#d6b976",
            fontSize: 13,
            fontWeight: 700,
            padding: "11px 14px",
            cursor:
              analiseLoading || enviando || !conteudoCarregado ? "not-allowed" : "pointer",
            opacity: analiseLoading || enviando || !conteudoCarregado ? 0.55 : 1,
          }}
        >
          {analiseLoading ? "A analisar com IA Mistral..." : "Analisar playbook com IA Mistral"}
        </button>
        <p style={{ color: "#8b949e", fontSize: 11, margin: "8px 0 0", lineHeight: 1.5 }}>
          A IA lê o conteúdo, atribui uma nota de 0 a 10 e aponta pontos fortes, lacunas, riscos e sugestões.
          {modoPreCriacao ? " É necessário analisar antes de avançar." : ""}
        </p>
        {analiseLoading ? (
          <div
            style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #c9a24a44",
              background: "#c9a24a0f",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
                gap: 12,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#d6b976",
                }}
              >
                <Loader2 size={14} className="animate-spin" aria-hidden />
                A analisar playbook com IA Mistral…
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#c9a24a",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {analisePct}%
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "#21262d",
                border: "1px solid #30363d",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(6, Math.min(100, analisePct))}%`,
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #003b26 0%, #c9a24a 100%)",
                  transition: "width 0.22s ease-out",
                }}
              />
            </div>
            <p style={{ color: "#8b949e", fontSize: 11, margin: "8px 0 0", lineHeight: 1.45 }}>
              Lendo estrutura, fluxos e regras do playbook. Isso pode levar alguns segundos.
            </p>
          </div>
        ) : null}
      </div>

      {analiseErro ? (
        <p
          style={{
            color: "#f85149",
            fontSize: 13,
            margin: 0,
            background: "#f8514918",
            border: "1px solid #f8514944",
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          {analiseErro}
        </p>
      ) : null}

      {analiseResultado ? (
        <div
          style={{
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {analiseResultado.nota != null ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  border: `3px solid ${corNota(analiseResultado.nota)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  background: `${corNota(analiseResultado.nota)}14`,
                }}
              >
                <span style={{ color: corNota(analiseResultado.nota), fontSize: 22, fontWeight: 800 }}>
                  {analiseResultado.nota.toFixed(1)}
                </span>
              </div>
              <div>
                <p style={{ margin: 0, color: "#8b949e", fontSize: 11, fontWeight: 700 }}>NOTA DO PLAYBOOK</p>
                <p style={{ margin: "4px 0 0", color: "#e6edf3", fontSize: 13, lineHeight: 1.45 }}>
                  {analiseResultado.notaComentario || analiseResultado.resumo}
                </p>
              </div>
            </div>
          ) : null}

          <div>
            <p style={{ margin: 0, color: "#8b949e", fontSize: 11, fontWeight: 700 }}>
              RESUMO {analiseResultado.modelo ? `(${analiseResultado.modelo})` : ""}
            </p>
            <p style={{ margin: "6px 0 0", color: "#c9d1d9", fontSize: 12, lineHeight: 1.5 }}>
              {analiseResultado.resumo}
            </p>
            {analiseResultado.origem === "fallback" ? (
              <p style={{ margin: "8px 0 0", color: "#d29922", fontSize: 11 }}>
                Análise local — configure MISTRAL_API_KEY para nota automática completa.
              </p>
            ) : null}
          </div>

          {analiseResultado.pontosChave.length > 0 ? (
            <div>
              <p style={{ margin: 0, color: "#3fb950", fontSize: 11, fontWeight: 700 }}>PONTOS FORTES</p>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#aebccf", fontSize: 12, lineHeight: 1.5 }}>
                {analiseResultado.pontosChave.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {analiseResultado.gaps.length > 0 ? (
            <div>
              <p style={{ margin: 0, color: "#d29922", fontSize: 11, fontWeight: 700 }}>LACUNAS</p>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#aebccf", fontSize: 12, lineHeight: 1.5 }}>
                {analiseResultado.gaps.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {(analiseResultado.riscos.length > 0 || analiseResultado.recomendacoes.length > 0) ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {analiseResultado.riscos.length > 0 ? (
                <div>
                  <p style={{ margin: 0, color: "#f85149", fontSize: 11, fontWeight: 700 }}>RISCOS</p>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#aebccf", fontSize: 12, lineHeight: 1.5 }}>
                    {analiseResultado.riscos.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {analiseResultado.recomendacoes.length > 0 ? (
                <div>
                  <p style={{ margin: 0, color: "#58a6ff", fontSize: 11, fontWeight: 700 }}>SUGESTÕES</p>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#aebccf", fontSize: 12, lineHeight: 1.5 }}>
                    {analiseResultado.recomendacoes.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
