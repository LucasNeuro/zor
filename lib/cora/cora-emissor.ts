/** CNPJ da conta Cora emissora (Waje) — evita chamar API com cliente = emissor. */
export function getCoraEmissorCnpj(): string | null {
  const raw = process.env.CORA_EMISSOR_CNPJ?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 14 ? digits.slice(0, 14) : null;
}

export function normalizarCnpjCora(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "").slice(0, 14);
}

export function cnpjMesmoEmissorCora(clienteCnpj: string | null | undefined): boolean {
  const emissor = getCoraEmissorCnpj();
  if (!emissor) return false;
  const cliente = normalizarCnpjCora(clienteCnpj);
  return cliente.length >= 14 && cliente === emissor;
}

export const ERRO_CORA_MESMO_CNPJ =
  "O CNPJ do tenant é o mesmo da conta Cora emissora (Waje). A Cora não permite emitir boleto para a própria empresa. Use o CNPJ do cliente ou outra conta Cora para testes.";

export function validarCnpjClienteCora(clienteCnpj: string | null | undefined): void {
  if (cnpjMesmoEmissorCora(clienteCnpj)) {
    throw new Error(ERRO_CORA_MESMO_CNPJ);
  }
}

export function humanizarErroCoraApi(message: string): string {
  const m = message.trim();
  if (/own identity/i.test(m)) return ERRO_CORA_MESMO_CNPJ;
  if (/cannot create invoice/i.test(m) && /identity/i.test(m)) return ERRO_CORA_MESMO_CNPJ;
  return m;
}

export type CoraEmissaoTenantCheck = {
  bloqueado: boolean;
  motivo: string | null;
  emissor_configurado: boolean;
};

export function avaliarEmissaoCoraTenant(clienteCnpj: string | null | undefined): CoraEmissaoTenantCheck {
  const emissor_configurado = Boolean(getCoraEmissorCnpj());
  if (cnpjMesmoEmissorCora(clienteCnpj)) {
    return { bloqueado: true, motivo: ERRO_CORA_MESMO_CNPJ, emissor_configurado };
  }
  return { bloqueado: false, motivo: null, emissor_configurado };
}
