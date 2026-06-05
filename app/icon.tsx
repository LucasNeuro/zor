import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Favicon / PWA — ícone hub Waje. */
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
          background: "#0b1f10",
          borderRadius: 96,
        }}
      >
        <svg width="340" height="340" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="4.5" fill="#92ff00" />
          <circle cx="32" cy="12" r="3" fill="#92ff00" />
          <circle cx="50" cy="22" r="3" fill="#92ff00" />
          <circle cx="50" cy="42" r="3" fill="#92ff00" />
          <circle cx="32" cy="52" r="3" fill="#92ff00" />
          <circle cx="14" cy="42" r="3" fill="#92ff00" />
          <circle cx="14" cy="22" r="3" fill="#92ff00" />
          <path
            d="M32 16v11M46 24l-9 5M46 40l-9-5M32 48V37M18 40l9-5M18 24l9 5"
            stroke="#92ff00"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
