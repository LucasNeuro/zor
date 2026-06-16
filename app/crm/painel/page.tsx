import { Suspense } from "react";
import { CrmPainelPage } from "@/components/crm/CrmPainelPage";

export default function PainelRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center bg-[#f8fcf6] text-sm text-[#5d7a67]">
          Carregando painel…
        </div>
      }
    >
      <CrmPainelPage />
    </Suspense>
  );
}
