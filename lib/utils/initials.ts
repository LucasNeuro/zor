export function getInitials(label: string): string {
  const skip = new Set(["de", "do", "da", "dos", "das", "e", "IA", "ao"]);
  const words = label.split(" ").filter((w) => w.length > 1 && !skip.has(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}
