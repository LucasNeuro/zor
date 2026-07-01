/**
 * Rollout gradual do harness v0.1.
 * Por defeito activo — definir HARNESS_V1_ENABLED=false para o caminho legado inline.
 */
export function harnessV1Enabled(): boolean {
  const v = process.env.HARNESS_V1_ENABLED?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "off") return false;
  return true;
}
