export default function OfficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preload" href="/sprites/office-bg.png" as="image" />
      <link rel="preload" href="/sprites/office-mobile-bg.png" as="image" />
      {children}
    </>
  );
}
