/** Signal-lamp palette used for member and board identity colors. */
const LAMPS = [
  "var(--color-flow)",
  "var(--color-steel)",
  "var(--color-violet)",
  "var(--color-clear)",
  "var(--color-stop)",
];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

export function getAvatarColor(id: string): string {
  return LAMPS[hash(id) % LAMPS.length]!;
}

export function getBoardAccent(id: string): string {
  return LAMPS[hash(id) % LAMPS.length]!;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
