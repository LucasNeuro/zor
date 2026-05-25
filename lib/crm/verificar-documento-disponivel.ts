import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { TipoPessoaCadastro } from "@/lib/crm/pessoa-cadastro";

/** Primeira chamada pode compilar a rota no Next (~15s); não cortar aos 12s. */
const TIMEOUT_MS = 35_000;

export type VerificarDocumentoResult =
  | { disponivel: true }
  | { disponivel: false; cancelled: true }
  | { disponivel: false; error: string; timeout?: boolean };

/** Verifica duplicidade no servidor (não trata abort de debounce como erro). */
export async function verificarDocumentoDisponivel(
  documento: string,
  tipoPessoa: TipoPessoaCadastro,
  signal?: AbortSignal
): Promise<VerificarDocumentoResult> {
  if (signal?.aborted) {
    return { disponivel: false, cancelled: true };
  }

  let timedOut = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const params = new URLSearchParams({ documento, tipo_pessoa: tipoPessoa });
    const res = await fetch(`/api/crm/pessoas/verificar-documento?${params}`, {
      headers: internalApiHeaders(),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      disponivel?: boolean;
      error?: string;
    };

    if (!res.ok) {
      return { disponivel: false, error: data.error || "Não foi possível validar o documento." };
    }
    if (!data.disponivel) {
      return { disponivel: false, error: data.error || "Documento já cadastrado." };
    }
    return { disponivel: true };
  } catch {
    if (signal?.aborted && !timedOut) {
      return { disponivel: false, cancelled: true };
    }
    if (timedOut) {
      return {
        disponivel: false,
        timeout: true,
        error:
          "A verificação demorou (servidor a iniciar). Aguarde um instante e saia do campo ou tente salvar de novo.",
      };
    }
    return { disponivel: false, error: "Não foi possível validar o documento. Verifique a rede." };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

export function erroVerificacaoDocumento(result: VerificarDocumentoResult): string | null {
  if (result.disponivel) return null;
  if ("cancelled" in result) return null;
  return result.error;
}
