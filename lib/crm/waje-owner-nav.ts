import { Shield } from "lucide-react";
import type { CrmNavGroup } from "@/lib/crm-nav-groups";

/** Secção extra no sidebar — só para users.owner = true (equipe Waje). */
export const WAJE_OWNER_NAV_GROUP: CrmNavGroup = {
  id: "waje-platform",
  label: "Plataforma",
  sectionIcon: Shield,
  items: [
    {
      href: "/crm/waje",
      label: "Acesso Owner",
      icon: Shield,
      wajeOwnerOnly: true,
    },
  ],
};

export function appendWajeOwnerNav(
  groups: CrmNavGroup[],
  wajeOwner: boolean,
): CrmNavGroup[] {
  if (!wajeOwner) return groups;
  if (groups.some((g) => g.id === WAJE_OWNER_NAV_GROUP.id)) return groups;
  return [...groups, WAJE_OWNER_NAV_GROUP];
}

export function isWajeOwnerPath(pathname: string): boolean {
  return pathname === "/crm/waje" || pathname.startsWith("/crm/waje/");
}
