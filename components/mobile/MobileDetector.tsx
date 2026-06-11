"use client";

/** Shell mobile Obra10 desativado — Waje usa layout responsivo normal (sem nav inferior fixa). */
interface Props {
  children: React.ReactNode;
}

export default function MobileDetector({ children }: Props) {
  return <>{children}</>;
}
