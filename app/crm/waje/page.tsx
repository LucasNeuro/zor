import { Suspense } from "react";
import { WajeOwnerConsolePage } from "@/components/crm/waje/WajeOwnerConsolePage";

export default function WajeOwnerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center bg-[#f8fcf6]">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#92ff00] border-t-transparent" />
        </div>
      }
    >
      <WajeOwnerConsolePage />
    </Suspense>
  );
}
