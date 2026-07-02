/** Mascote Waje (Notionists — igual aos avatares dos agentes). Ver `gerarWajeMascotUrl`. */
const WAJE_MARK_SRC = "/favicons/waje-mark.svg";

type WajeLogoMarkProps = {
  className?: string;
  size?: number;
};

/** Selo / avatar da marca Waje — circular, borda fina, como `AgenteAvatar`. */
export function WajeLogoMark({ className = "h-10 w-10", size }: WajeLogoMarkProps) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        flexShrink: 0,
        borderRadius: "50%",
        overflow: "hidden",
        border: "1.5px solid rgba(11, 31, 16, 0.42)",
        boxShadow: "0 6px 20px rgba(15, 56, 39, 0.12)",
        background: "#f8fcf6",
        ...(size ? { width: size, height: size } : {}),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={WAJE_MARK_SRC}
        alt=""
        aria-hidden
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        draggable={false}
      />
    </div>
  );
}
