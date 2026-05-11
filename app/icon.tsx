import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Ícone PWA / favicon gerado (evita 404 de /icon-192x192.png ausente). */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #005c3d 0%, #003b26 100%)",
          color: "#e0b86a",
          fontSize: 200,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.05em",
        }}
      >
        O+
      </div>
    ),
    { ...size },
  );
}
