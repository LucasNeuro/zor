import { resumirConversaViaLlm } from "@/lib/ia/memoria-llm";

export type MensagemHarness = { role: "user" | "assistant"; content: string };

/** Mensagens recentes mantidas integralmente após compaction. Env: HARNESS_COMPACTION_RECENTES */
export function harnessCompactionRecentes(): number {
  const raw = process.env.HARNESS_COMPACTION_RECENTES?.trim();
  const n = raw ? parseInt(raw, 10) : 12;
  return Math.min(24, Math.max(4, Number.isFinite(n) ? n : 12));
}

/** A partir de quantas mensagens compactar. Env: HARNESS_COMPACTION_APARTIR */
export function harnessCompactionApartirDe(): number {
  const raw = process.env.HARNESS_COMPACTION_APARTIR?.trim();
  const n = raw ? parseInt(raw, 10) : 20;
  return Math.min(80, Math.max(10, Number.isFinite(n) ? n : 20));
}

export type CompactionResult = {
  mensagens: MensagemHarness[];
  resumoAnterior?: string;
  compactado: boolean;
};

/**
 * Compacta histórico longo: resumo LLM das mensagens antigas + recentes intactas.
 * RFC Fase 5 — mitiga context rot.
 */
export async function compactarHistoricoHarness(
  mensagens: MensagemHarness[]
): Promise<CompactionResult> {
  const limiar = harnessCompactionApartirDe();
  const recentesN = harnessCompactionRecentes();

  if (mensagens.length < limiar) {
    return { mensagens, compactado: false };
  }

  const recentes = mensagens.slice(-recentesN);
  const antigas = mensagens.slice(0, Math.max(0, mensagens.length - recentesN));

  if (antigas.length < 6) {
    return { mensagens, compactado: false };
  }

  const resumo = await resumirConversaViaLlm(antigas);
  if (!resumo?.trim()) {
    return { mensagens: recentes, compactado: true };
  }

  return {
    mensagens: recentes,
    resumoAnterior: resumo.trim(),
    compactado: true,
  };
}

export function formatarBlocoResumoCompactado(resumo: string): string {
  return `═══ RESUMO DE CONVERSAS ANTERIORES (compaction harness) ═══
Use para continuidade; detalhe recente está nas mensagens seguintes.

${resumo.trim()}`;
}
