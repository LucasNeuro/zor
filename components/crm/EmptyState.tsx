type Props = { message?: string };

export function EmptyState({ message = "Nenhum registro encontrado." }: Props) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <p style={{ color: "#5d7a67", fontSize: 14 }}>{message}</p>
    </div>
  );
}
