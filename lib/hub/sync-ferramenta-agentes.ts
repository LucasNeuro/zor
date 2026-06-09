import { mergeUsoFerramentasComPadraoPreservandoCustom } from "@/lib/hub/agente-ferramentas-registry";

export type AgenteFerramentaSyncRow = {
  agente_slug: string;
  motor_ferramentas_habilitado?: boolean;
  uso_ferramentas_ia?: unknown;
};

/** Activa/desactiva uma chave de ferramenta nos agentes seleccionados (PATCH por agente). */
export async function syncFerramentaEmAgentes(
  headers: HeadersInit,
  ferramentaKey: string,
  slugsActivos: string[],
  agentes: AgenteFerramentaSyncRow[],
  opts?: { ligarMotor?: boolean }
): Promise<void> {
  const activos = new Set(slugsActivos);
  const errors: string[] = [];

  for (const a of agentes) {
    const slug = a.agente_slug?.trim();
    if (!slug) continue;
    const deve = activos.has(slug);
    const uso = mergeUsoFerramentasComPadraoPreservandoCustom(a.uso_ferramentas_ia);
    const actual = uso[ferramentaKey] === true;
    const motor = a.motor_ferramentas_habilitado === true;
    const precisaMotor = deve && opts?.ligarMotor && !motor;
    if (actual === deve && !precisaMotor) continue;

    const body: Record<string, unknown> = {
      uso_ferramentas_ia: { ...uso, [ferramentaKey]: deve },
    };
    if (precisaMotor) body.motor_ferramentas_habilitado = true;

    const res = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j: unknown = await res.json().catch(() => null);
      const msg =
        j && typeof j === "object" && "error" in j && typeof (j as { error?: string }).error === "string"
          ? (j as { error: string }).error
          : res.statusText;
      errors.push(`${slug}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}
