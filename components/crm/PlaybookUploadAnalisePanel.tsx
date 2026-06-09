"use client";

import { Loader2, Download } from "lucide-react";
import { PLAYBOOK_EXEMPLO_ARQUIVO, PLAYBOOK_EXEMPLO_MD_URL } from "@/lib/playbook/playbook-exemplo";
import { crmBtnOutline, crmBtnPrimaryLg } from "@/lib/crm/crm-button-styles";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";

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
  /** Interrompe análise em curso (barra de progresso). */
  onCancelarAnalise?: () => void;
  /** Remove ficheiro carregado da sessão do wizard. */
  onLimparArquivo?: () => void;
  /** Legenda sob a barra de progresso (ex.: nome do ficheiro ou cargo). */
  progressoContexto?: string;
  /** Texto acima da dropzone (modo pré-criação). */
  introPreCriacao?: string;
  /** Se false, análise é recomendada mas não bloqueia o wizard. */
  analiseObrigatoria?: boolean;
  /** Tema do painel — `dark` em sideovers retrofit Waje. */
  theme?: "light" | "dark";
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
  onCancelarAnalise,
  onLimparArquivo,
  progressoContexto,
  introPreCriacao,
  analiseObrigatoria = true,
  theme = "light",
}: Props) {
  const enviando = uploadStatus === "enviando";
  const dark = theme === "dark";
  const panelBg = dark ? "rgba(6, 13, 8, 0.72)" : "#f8fcf6";
  const panelBorder = dark ? "rgba(63, 152, 72, 0.42)" : "#dcebd8";
  const titleColor = dark ? "#e8f5e9" : "#0b2210";
  const mutedColor = dark ? "#7a9a7e" : "#5d7a67";
  const resultBg = dark ? "rgba(11, 31, 16, 0.92)" : "#ffffff";
  const dropzoneTitleColor = dark ? "#e8f5e9" : "#0b2210";
  const dropzoneMuted = dark ? "#7a9a7e" : "#5d7a67";
  const temArquivo = Boolean(arquivoNome.trim() || conteudoCarregado);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {modoPreCriacao ? (
        <p style={{ color: "#5d7a67", fontSize: 12, margin: 0, lineHeight: 1.55 }}>
          {introPreCriacao ??
            "Carregue o playbook aqui, solicite uma nota de qualidade e só então avance. O arquivo será publicado automaticamente após criar o agente."}
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
          <p style={{ color: dropzoneTitleColor, fontSize: 13, margin: 0, fontWeight: 700 }}>
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
                    : "#5d7a67",
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
        <p style={{ color: dropzoneMuted, fontSize: 12, margin: "8px 0 0", lineHeight: 1.55 }}>
          Arraste e solte o arquivo nesta área ou use o botão para selecionar. Tamanho máximo: 2 MB.
        </p>
        <p style={{ color: dropzoneMuted, fontSize: 12, margin: "10px 0 0", lineHeight: 1.55 }}>
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
            Baixar template Waje v1 (.md)
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
              ...crmBtnOutline(enviando),
              cursor: enviando ? "wait" : "pointer",
            }}
          >
            Selecionar arquivo
          </button>
          <span style={{ color: dropzoneMuted, fontSize: 12 }}>
            {arquivoNome ? `Arquivo: ${arquivoNome}` : "Nenhum arquivo selecionado."}
          </span>
          {temArquivo && onLimparArquivo ? (
            <button
              type="button"
              disabled={enviando || analiseLoading}
              onClick={(e) => {
                e.stopPropagation();
                onLimparArquivo();
              }}
              style={{
                ...crmBtnOutline(enviando || analiseLoading),
                cursor: enviando || analiseLoading ? "not-allowed" : "pointer",
                color: dark ? "#f85149" : "#b3261e",
                border: `1px solid ${dark ? "rgba(248, 81, 73, 0.45)" : "#fecaca"}`,
              }}
            >
              Limpar
            </button>
          ) : null}
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
                background: "#eef7eb",
                border: "1px solid #dcebd8",
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
            <p style={{ color: "#5d7a67", fontSize: 11, margin: "6px 0 0" }}>
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
            background: panelBg,
            border: `1px solid ${panelBorder}`,
            borderRadius: 10,
            padding: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <p style={{ color: titleColor, fontSize: 11, fontWeight: 700, margin: 0 }}>PRÉ-VISUALIZAÇÃO</p>
            <span style={{ color: mutedColor, fontSize: 10, fontWeight: 600 }}>Início do arquivo</span>
          </div>
          <div
            style={{
              background: "#0b1f10",
              border: "1px solid #1e3a2f",
              borderRadius: 8,
              padding: "12px 14px",
              maxHeight: 220,
              overflow: "auto",
            }}
          >
            <pre
              style={{
                margin: 0,
                color: "#e8f5e9",
                fontSize: 12,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
              }}
            >
              {conteudoPreview}
            </pre>
          </div>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          onClick={onAnalisar}
          disabled={analiseLoading || enviando || !conteudoCarregado}
          style={{
            ...crmBtnPrimaryLg(analiseLoading || enviando || !conteudoCarregado, { fullWidth: true }),
            cursor: analiseLoading ? "wait" : analiseLoading || enviando || !conteudoCarregado ? "not-allowed" : "pointer",
          }}
        >
          {analiseLoading ? "A analisar playbook..." : "Analisar playbook"}
        </button>
        <p style={{ color: mutedColor, fontSize: 11, margin: "8px 0 0", lineHeight: 1.5 }}>
          A IA lê o conteúdo, atribui uma nota de 0 a 10 e aponta pontos fortes, lacunas, riscos e sugestões.
          {modoPreCriacao && analiseObrigatoria
            ? " É necessário analisar antes de avançar."
            : modoPreCriacao
              ? " A análise é recomendada, mas opcional neste modo."
              : ""}
        </p>
        {analiseLoading ? (
          <div
            style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${panelBorder}`,
              background: dark ? "rgba(6, 13, 8, 0.72)" : "#eef7eb",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: dark ? "#e8f5e9" : BRAND_TEXT_DARK,
                }}
              >
                <Loader2 size={14} className="animate-spin" aria-hidden />
                A analisar playbook...
              </span>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: dark ? "#92ff00" : "#2d6a4f",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {analisePct}%
                </span>
                {onCancelarAnalise ? (
                  <button
                    type="button"
                    onClick={onCancelarAnalise}
                    style={{
                      ...crmBtnOutline(false),
                      padding: "4px 10px",
                      fontSize: 10,
                      color: dark ? "#f85149" : "#b3261e",
                      border: `1px solid ${dark ? "rgba(248, 81, 73, 0.45)" : "#fecaca"}`,
                    }}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "#dcebd8",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(6, Math.min(100, analisePct))}%`,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${BRAND_TEXT_DARK} 0%, ${BRAND_GREEN_BRIGHT} 100%)`,
                  transition: "width 0.22s ease-out",
                }}
              />
            </div>
            <p style={{ color: mutedColor, fontSize: 11, margin: "8px 0 0", lineHeight: 1.45 }}>
              {progressoContexto?.trim() ||
                arquivoNome ||
                "Lendo estrutura, fluxos e regras do playbook. Isso pode levar alguns segundos."}
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
            background: resultBg,
            border: `1px solid ${panelBorder}`,
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
                <p style={{ margin: 0, color: "#5d7a67", fontSize: 11, fontWeight: 700 }}>NOTA DO PLAYBOOK</p>
                <p style={{ margin: "4px 0 0", color: "#0b2210", fontSize: 13, lineHeight: 1.45 }}>
                  {analiseResultado.notaComentario || analiseResultado.resumo}
                </p>
              </div>
            </div>
          ) : null}

          <div>
            <p style={{ margin: 0, color: "#5d7a67", fontSize: 11, fontWeight: 700 }}>
              RESUMO {analiseResultado.modelo ? `(${analiseResultado.modelo})` : ""}
            </p>
            <p style={{ margin: "6px 0 0", color: "#0b2210", fontSize: 12, lineHeight: 1.5 }}>
              {analiseResultado.resumo}
            </p>
            {analiseResultado.origem === "fallback" ? (
              <p style={{ margin: "8px 0 0", color: "#d29922", fontSize: 11, lineHeight: 1.45 }}>
                Análise local (sem Mistral). Verifique MISTRAL_API_KEY e faturamento no console Mistral para nota
                automática completa.
              </p>
            ) : null}
          </div>

          {analiseResultado.pontosChave.length > 0 ? (
            <div>
              <p style={{ margin: 0, color: "#3fb950", fontSize: 11, fontWeight: 700 }}>PONTOS FORTES</p>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#2d4a38", fontSize: 12, lineHeight: 1.5 }}>
                {analiseResultado.pontosChave.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {analiseResultado.gaps.length > 0 ? (
            <div>
              <p style={{ margin: 0, color: "#d29922", fontSize: 11, fontWeight: 700 }}>LACUNAS</p>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#2d4a38", fontSize: 12, lineHeight: 1.5 }}>
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
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#2d4a38", fontSize: 12, lineHeight: 1.5 }}>
                    {analiseResultado.riscos.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {analiseResultado.recomendacoes.length > 0 ? (
                <div>
                  <p style={{ margin: 0, color: "#58a6ff", fontSize: 11, fontWeight: 700 }}>SUGESTÕES</p>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#2d4a38", fontSize: 12, lineHeight: 1.5 }}>
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

