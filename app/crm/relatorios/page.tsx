import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ tab?: string; relatorio?: string }>;
};

export default async function RelatoriosRedirect({ searchParams }: Props) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("tab", sp.tab?.trim() || "visao-geral");
  if (sp.relatorio?.trim()) params.set("relatorio", sp.relatorio.trim());
  redirect(`/crm/painel?${params.toString()}`);
}
