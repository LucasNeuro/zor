/** Resposta da API pública ViaCEP (https://viacep.com.br). */

export type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export function normalizarCep(cep: string): string {
  return cep.replace(/\D/g, "").slice(0, 8);
}

/** Máscara 00000-000 enquanto o utilizador digita. */
export function formatarCepMascara(cep: string): string {
  const d = normalizarCep(cep);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function cepValidoParaBusca(cep: string): boolean {
  return normalizarCep(cep).length === 8;
}

export type EnderecoViaCep = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  complemento: string;
};

export async function buscarEnderecoPorCep(
  cep: string
): Promise<{ ok: true; endereco: EnderecoViaCep } | { ok: false; erro: string }> {
  const digits = normalizarCep(cep);
  if (digits.length !== 8) {
    return { ok: false, erro: "Informe um CEP com 8 dígitos." };
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, erro: "Não foi possível consultar o CEP. Tente novamente." };
    }
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro) {
      return { ok: false, erro: "CEP não encontrado." };
    }
    return {
      ok: true,
      endereco: {
        cep: formatarCepMascara(digits),
        logradouro: (data.logradouro || "").trim(),
        bairro: (data.bairro || "").trim(),
        cidade: (data.localidade || "").trim(),
        estado: (data.uf || "").trim().toUpperCase().slice(0, 2),
        complemento: (data.complemento || "").trim(),
      },
    };
  } catch {
    return { ok: false, erro: "Erro de rede ao buscar CEP." };
  }
}
