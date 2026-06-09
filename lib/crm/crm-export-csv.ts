/** Gera e descarrega CSV no browser (padrão retrofit CRM). */
export function downloadCrmCsv(filename: string, header: string[], rows: string[][]) {
  const csv = [
    header.join(","),
    ...rows.map((cells) =>
      cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
