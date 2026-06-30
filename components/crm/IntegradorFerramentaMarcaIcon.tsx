import { IntegracaoMarcaIcon } from "@/components/crm/IntegracaoMarcaIcon";
import { integradorMarcaIconVariant } from "@/lib/hub/integrador-catalogo-ui";

export function IntegradorFerramentaMarcaIcon({
  ferramentaKey,
  integradorId,
  integradorNome,
  size = 22,
  ligado = false,
  mutedColor = "#5d7a67",
}: {
  ferramentaKey: string;
  integradorId?: string | null;
  integradorNome?: string;
  size?: number;
  ligado?: boolean;
  mutedColor?: string;
}) {
  const variant = integradorMarcaIconVariant(ferramentaKey, integradorId);
  if (variant) {
    return <IntegracaoMarcaIcon variant={variant} size={size} />;
  }

  const label = (integradorNome ?? ferramentaKey).trim();
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 6,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        fontWeight: 800,
        color: ligado ? "#86efac" : mutedColor,
        background: ligado ? "rgba(146, 255, 0, 0.12)" : "rgba(11, 31, 16, 0.08)",
      }}
    >
      {initials || "?"}
    </span>
  );
}
