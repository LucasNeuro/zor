"use client";

import { CrmFinanceDashboard } from "@/components/crm/CrmFinanceDashboard";
import { useFinanceDashboard } from "@/hooks/useFinanceDashboard";

export default function FinanceiroDashboardPage() {
  const dash = useFinanceDashboard();
  return <CrmFinanceDashboard dash={dash} />;
}
