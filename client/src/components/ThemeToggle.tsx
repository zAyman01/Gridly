import { useTheme } from "../theme";

/** A lamp switch: filled disc for light, cut disc for dark. */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="8" cy="8" r="3.4" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1" />
            </g>
          </>
        ) : (
          <path
            d="M13.2 9.8A5.8 5.8 0 116.2 2.8a4.6 4.6 0 007 7z"
            fill="currentColor"
          />
        )}
      </svg>
    </button>
  );
}
