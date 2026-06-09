"use client";

import type { ReactNode } from "react";
import { BookOpen, Globe, Puzzle, Wrench } from "lucide-react";
import { FERRAMENTAS_LIGHT as L } from "@/lib/hub/ferramentas-catalogo-ui";

function GuiaCard({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: typeof Wrench;
  title: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <article
      className="rounded-2xl p-5"
      style={{ background: L.surface, border: `1px solid ${L.border}`, boxShadow: "0 2px 12px rgba(11,31,16,0.04)" }}
    >
      <div className="mb-3 flex items-start gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: L.accentMuted, color: L.accent }}
        >
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-sm font-bold" style={{ color: L.text }}>
              {title}
            </h3>
            <span
              className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: L.accentMuted, color: L.accent, border: `1px solid ${L.border}` }}
            >
              {badge}
            </span>
          </div>
        </div>
      </div>
      <div className="text-[13px] leading-relaxed" style={{ color: L.muted }}>
        {children}
      </div>
    </article>
  );
}

export function CrmFerramentasGuiaPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="m-0 text-base font-bold" style={{ color: L.text }}>
          Como funcionam as ferramentas IA
        </h2>
        <p className="mt-2 m-0 text-sm leading-relaxed" style={{ color: L.muted }}>
          O motor de agentes expõe funções ao modelo (function calling). Cada ferramenta tem um nome único, descrição
          para o LLM e um esquema de parâmetros JSON. Active-as por agente em{" "}
          <strong style={{ color: L.text }}>Modelos</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GuiaCard icon={Puzzle} title="Built-in" badge="Catálogo fixo">
          <p className="m-0">
            Funções seguras já implementadas no Hub (resumo de lead, métricas, notas, etc.). Não editáveis — apenas
            activar ou desactivar por agente. O nome da função Mistral é fixo (ex.:{" "}
            <code className="text-[11px]" style={{ color: L.link }}>
              hub_lead_resumo
            </code>
            ).
          </p>
        </GuiaCard>

        <GuiaCard icon={Wrench} title="Custom" badge="Alias do tenant">
          <p className="m-0">
            Crie um alias com título e instruções próprios sobre uma built-in existente. A execução continua segura
            (mesma implementação), mas o modelo vê outro nome e descrição. Chave no formato{" "}
            <code className="text-[11px]" style={{ color: L.link }}>
              hub_custom_*
            </code>
            .
          </p>
        </GuiaCard>

        <GuiaCard icon={Globe} title="Externa" badge="HTTP + integração">
          <p className="m-0">
            Chamadas HTTP configuráveis via integração do tenant (API key, Bearer ou webhook). Defina URL template,
            método, cabeçalhos e corpo. A credencial vem da integração associada — configure-a primeiro no separador{" "}
            <strong style={{ color: L.text }}>Integrações</strong>. Chave{" "}
            <code className="text-[11px]" style={{ color: L.link }}>
              hub_ext_*
            </code>
            .
          </p>
        </GuiaCard>

        <GuiaCard icon={BookOpen} title="Function calling" badge="Mistral">
          <p className="m-0 mb-3">
            O modelo decide quando invocar uma ferramenta com base na descrição e no contexto da conversa. Os
            parâmetros são validados pelo esquema JSON antes da execução.
          </p>
          <ul className="m-0 list-disc space-y-1 pl-5 text-[12px]">
            <li>
              <strong style={{ color: L.text }}>Só leitura</strong> — consultas sem alterar dados.
            </li>
            <li>
              <strong style={{ color: L.text }}>Escrita</strong> — pode criar ou actualizar registos (use com critério).
            </li>
            <li>
              <strong style={{ color: L.text }}>Integração</strong> — externas dependem de credenciais válidas no
              tenant.
            </li>
          </ul>
        </GuiaCard>
      </div>
    </div>
  );
}
