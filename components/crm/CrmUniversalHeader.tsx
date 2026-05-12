"use client";

import { usePathname } from "next/navigation";
import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { defaultCrmHeaderForPath } from "@/lib/crm-header-defaults";
import { shouldHideCrmUniversalHeader } from "@/lib/crm-universal-header-visibility";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";

export function CrmUniversalHeader() {
  const pathname = usePathname() || "";
  const { slot } = useCrmHeaderSlot();
  const base = defaultCrmHeaderForPath(pathname);
  const scoped = slot != null && slot.path === pathname ? slot : null;

  if (shouldHideCrmUniversalHeader(pathname)) {
    return null;
  }

  const title = scoped?.title ?? base.title;
  const subtitle = scoped?.subtitle ?? base.subtitle;

  return (
    <CrmPageHeader
      title={title}
      subtitle={subtitle}
      actions={scoped?.actions ?? undefined}
      blendDesktopUnderlap
      className="flex-shrink-0"
    />
  );
}
