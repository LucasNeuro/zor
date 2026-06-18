"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canAccessCrmPath, type CrmAccessContext } from "@/lib/crm/access-permissions";

type Props = CrmAccessContext & {
  children: React.ReactNode;
};

export function CrmAccessGuard({ baseRole, permissoes, wajeOwner = false, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const ctx = { baseRole, permissoes, wajeOwner };

  useEffect(() => {
    if (!baseRole && !permissoes && !wajeOwner) return;
    if (canAccessCrmPath(pathname, ctx)) return;
    router.replace("/crm");
  }, [pathname, baseRole, permissoes, wajeOwner, router]);

  if (!canAccessCrmPath(pathname, ctx)) {
    return (
      <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-[#6b8a76]">
        Acesso restrito ao módulo. Contacte o administrador da conta.
      </div>
    );
  }

  return <>{children}</>;
}
