/** CNPJ da conta Cora dona das credenciais (ex.: Onze Tecnologia) — não é o tenant cliente. */
export function getCoraEmissorCnpj(): string | null {
  const raw = process.env.CORA_EMISSOR_CNPJ?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 14 ? digits.slice(0, 14) : null;
}

export function getCoraEmissorNome(): string {
  return process.env.CORA_EMISSOR_NOME?.trim() || "conta Cora emissora";
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

export function mensagemErroMesmoCnpjEmissor(): string {
  const emissor = getCoraEmissorNome();
  return (
    `O CNPJ do pagador (cadastro do cliente/tenant) é igual ao CNPJ da ${emissor} ` +
    `(conta das credenciais Cora). A Cora não permite emitir boleto para a própria empresa emissora. ` +
    `No formulário de faturamento, use o CPF/CNPJ do cliente (ex.: SHEFA), não o da emissora.`
  );
}

export const ERRO_CORA_MESMO_CNPJ = mensagemErroMesmoCnpjEmissor();

export function validarCnpjClienteCora(clienteCnpj: string | null | undefined): void {
  if (cnpjMesmoEmissorCora(clienteCnpj)) {
    throw new Error(ERRO_CORA_MESMO_CNPJ);
  }
}

/** Valida documento do pagador (Cora: customer.document). CPF ignora check de emissor. */
export function validarDocumentoClienteCora(
  documento: string | null | undefined,
  tipo: "CPF" | "CNPJ" = "CNPJ",
): void {
  if (tipo === "CNPJ") {
    validarCnpjClienteCora(documento);
  }
}

export function humanizarErroCoraApi(message: string): string {
  const m = message.trim();
  if (/own identity/i.test(m)) return mensagemErroMesmoCnpjEmissor();
  if (/cannot create invoice/i.test(m) && /identity/i.test(m)) return mensagemErroMesmoCnpjEmissor();
  return m;
}

export type CoraEmissaoTenantCheck = {
  bloqueado: boolean;
  motivo: string | null;
  emissor_configurado: boolean;
  emissor_cnpj: string | null;
  emissor_nome: string | null;
  cliente_documento: string | null;
};

export function avaliarEmissaoCoraTenant(
  clienteDocumento: string | null | undefined,
  tipo: "CPF" | "CNPJ" = "CNPJ",
): CoraEmissaoTenantCheck {
  const emissor_cnpj = getCoraEmissorCnpj();
  const emissor_configurado = Boolean(emissor_cnpj);
  const cliente = normalizarCnpjCora(clienteDocumento);
  const bloqueado = tipo === "CNPJ" && cnpjMesmoEmissorCora(clienteDocumento);

  return {
    bloqueado,
    motivo: bloqueado ? mensagemErroMesmoCnpjEmissor() : null,
    emissor_configurado,
    emissor_cnpj,
    emissor_nome: emissor_configurado ? getCoraEmissorNome() : null,
    cliente_documento: cliente.length >= 11 ? cliente : null,
  };
}
