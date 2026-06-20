"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  canAccessCrmPath,
  defaultCrmLandingPath,
  type CrmAccessContext,
} from "@/lib/crm/access-permissions";

type Props = CrmAccessContext & {
  children: React.ReactNode;
};

export function CrmAccessGuard({
  baseRole,
  permissoes,
  wajeOwner = false,
  tenantId = null,
  children,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const ctx = { baseRole, permissoes, wajeOwner, tenantId };

  useEffect(() => {
    if (!baseRole && !permissoes && !wajeOwner && !tenantId) return;
    if (canAccessCrmPath(pathname, ctx)) return;
    const destino = defaultCrmLandingPath(ctx);
    const destinoPath = destino.split("?")[0] ?? destino;
    const currentPath = pathname.split("?")[0] ?? pathname;
    if (destinoPath !== currentPath && !pathname.startsWith(`${destinoPath}/`)) {
      router.replace(destino);
    }
  }, [pathname, baseRole, permissoes, wajeOwner, tenantId, router]);

  if (!canAccessCrmPath(pathname, ctx)) {
    return (
      <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-[#6b8a76]">
        Acesso restrito ao módulo. Contacte o administrador da conta.
      </div>
    );
  }

  return <>{children}</>;
}
