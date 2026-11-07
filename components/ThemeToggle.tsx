"use client";

import { getTheme, setTheme } from "@/lib/theme";

/**
 * Both icons are always rendered and CSS shows the right one for the current
 * `data-theme`, so server and client markup match and there is no flicker.
 */
export function ThemeToggle({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => setTheme(getTheme() === "dark" ? "light" : "dark")}
    >
      {/* Sun: shown in dark mode (click for light) */}
      <svg className="icon-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {/* Moon: shown in light mode (click for dark) */}
      <svg className="icon-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
