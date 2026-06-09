"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canAccessCrmPath } from "@/lib/crm/access-permissions";

type Props = {
  baseRole: string;
  permissoes: Record<string, boolean> | null;
  children: React.ReactNode;
};

export function CrmAccessGuard({ baseRole, permissoes, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!baseRole && !permissoes) return;
    if (canAccessCrmPath(pathname, { baseRole, permissoes })) return;
    router.replace("/crm");
  }, [pathname, baseRole, permissoes, router]);

  if (!canAccessCrmPath(pathname, { baseRole, permissoes })) {
    return (
      <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-[#6b8a76]">
        Acesso restrito ao módulo. Contacte o administrador da conta.
      </div>
    );
  }

  return <>{children}</>;
}
