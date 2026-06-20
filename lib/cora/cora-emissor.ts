/** CNPJ da conta Cora dona das credenciais (ex.: Onze Tecnologia) — não é o tenant cliente. */
export function getCoraEmissorCnpj(): string | null {
  const raw = process.env.CORA_EMISSOR_CNPJ?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 14 ? digits.slice(0, 14) : null;
}

/** Exige CORA_EMISSOR_CNPJ antes de emitir — validação de pagador vs emissor. */
export function exigirCoraEmissorCnpj(): string {
  const cnpj = getCoraEmissorCnpj();
  if (!cnpj) {
    throw new Error(
      "CORA_EMISSOR_CNPJ não está definido no servidor. " +
        "No Render, configure o CNPJ da conta Cora emissora (ex.: Onze 62.449.971/0001-70). " +
        "Sem isso a plataforma não consegue validar pagador vs emissor.",
    );
  }
  return cnpj;
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

function formatarCnpjDigits(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 14) return d;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function mensagemErroMesmoCnpjEmissor(clienteDocumento?: string | null): string {
  const emissor = getCoraEmissorNome();
  const emissorCnpj = getCoraEmissorCnpj();
  const cliente = normalizarCnpjCora(clienteDocumento);
  const detalhe =
    emissorCnpj && cliente.length >= 14
      ? ` Pagador no cadastro: ${formatarCnpjDigits(cliente)} · Conta emissora (credenciais): ${formatarCnpjDigits(emissorCnpj)}.`
      : "";
  return (
    `O CNPJ do pagador (cadastro do cliente/tenant) é igual ao CNPJ da ${emissor} ` +
    `(conta das credenciais Cora). A Cora não permite emitir boleto para a própria empresa emissora.` +
    detalhe +
    ` No formulário de faturamento, use o CPF/CNPJ do cliente (ex.: SHEFA 65.912.793/0001-60), não o da emissora (ex.: Onze 62.449.971/0001-70).`
  );
}

export const ERRO_CORA_MESMO_CNPJ = mensagemErroMesmoCnpjEmissor();

/** @deprecated Validação removida — emissão sempre via conta ONNZE; erros vêm da API Cora. */
export function validarCnpjClienteCora(_clienteCnpj: string | null | undefined): void {}

/** @deprecated Validação removida — cadastro e faturamento não bloqueiam CNPJ do emissor. */
export function validarDocumentoClienteCora(
  _documento: string | null | undefined,
  _tipo: "CPF" | "CNPJ" = "CNPJ",
): void {}

export function humanizarErroCoraApi(message: string, clienteDocumento?: string | null): string {
  const m = message.trim();
  const cliente = normalizarCnpjCora(clienteDocumento);
  const emissor = getCoraEmissorCnpj();

  if (/own identity/i.test(m) || (/cannot create invoice/i.test(m) && /identity/i.test(m))) {
    if (emissor && cliente.length >= 14 && cliente !== emissor) {
      return (
        `A Cora recusou a emissão (own identity). Documento enviado como pagador: ${formatarCnpjDigits(cliente)}. ` +
        `CORA_EMISSOR_CNPJ no servidor: ${formatarCnpjDigits(emissor)} (${getCoraEmissorNome()}). ` +
        `Como são diferentes, o certificado/client_id Cora provavelmente pertence a outra conta (não à Onze). ` +
        `Confirme no Render que CORA_CLIENT_ID, CORA_CERT_PEM e CORA_PRIVATE_KEY_PEM são da conta Cora da Onze (62.449.971/0001-70).`
      );
    }
    return mensagemErroMesmoCnpjEmissor(clienteDocumento);
  }
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
  const mesmoEmissor = tipo === "CNPJ" && cnpjMesmoEmissorCora(clienteDocumento);

  return {
    bloqueado: false,
    motivo: mesmoEmissor ? mensagemErroMesmoCnpjEmissor(clienteDocumento) : null,
    emissor_configurado,
    emissor_cnpj,
    emissor_nome: emissor_configurado ? getCoraEmissorNome() : null,
    cliente_documento: cliente.length >= 11 ? cliente : null,
  };
}
