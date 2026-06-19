"use client";

import { useEffect } from "react";

export default function CrmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[crm/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold text-[#1e3a23]">Não foi possível carregar esta página</p>
      <p className="max-w-md text-sm leading-relaxed text-[#5d7a67]">
        Ocorreu um erro ao abrir o CRM. Tente recarregar ou volte ao painel.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-[#92ff00] px-5 py-2.5 text-sm font-semibold text-[#091107]"
        >
          Tentar novamente
        </button>
        <a
          href="/crm/painel?tab=visao-geral&view=paineis"
          className="rounded-xl border border-[#d5e2d2] bg-white px-5 py-2.5 text-sm font-semibold text-[#1e3a23] no-underline"
        >
          Ir ao painel
        </a>
        <a
          href="/login"
          className="rounded-xl px-3 py-2.5 text-sm font-medium text-[#3f9848] no-underline"
        >
          Sair e entrar de novo
        </a>
      </div>
    </div>
  );
}
