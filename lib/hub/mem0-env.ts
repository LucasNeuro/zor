/** Mem0 é credencial de plataforma (Render / .env) — não por tenant na UI. */
export function mem0PlataformaConfigurada(): boolean {
  return Boolean(process.env.MEM0_API_KEY?.trim());
}

export function resolverMem0ApiKeyEnv(): string | null {
  const key = process.env.MEM0_API_KEY?.trim();
  return key || null;
}
