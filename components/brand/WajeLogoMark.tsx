type WajeLogoMarkProps = {
  className?: string;
  size?: number;
};

/** Ícone hub (favicon e selo da marca). */
export function WajeLogoMark({ className = "h-9 w-9", size }: WajeLogoMarkProps) {
  const dim = size ? { width: size, height: size } : undefined;
  return (
    <svg viewBox="0 0 64 64" className={size ? undefined : className} style={dim} fill="none" aria-hidden>
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
  );
}
