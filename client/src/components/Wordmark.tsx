import { Link } from "react-router";

/**
 * The mark is the product: three stations on one line, the last one
 * cleared. Same shape appears on the board's column rail.
 */
export function RailMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      className="wordmark-mark"
      width={size}
      height={(size * 14) / 26}
      viewBox="0 0 26 14"
      fill="none"
      aria-hidden="true"
    >
      <path d="M0 7h26" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
      <rect x="0" y="4" width="6" height="6" rx="1" fill="currentColor" />
      <rect x="9.5" y="4" width="6" height="6" rx="1" fill="currentColor" />
      <circle cx="22.5" cy="7" r="3.5" fill="var(--color-signal)" />
    </svg>
  );
}

export default function Wordmark({ to = "/", size = 26 }: { to?: string; size?: number }) {
  return (
    <Link to={to} className="wordmark">
      <RailMark size={size} />
      Gridly
    </Link>
  );
}
