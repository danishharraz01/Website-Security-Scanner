/**
 * Light / dark theme.
 *
 * The theme is stored as `data-theme` on <html>. With no saved choice it follows
 * the operating system, including live changes. Clicking the toggle saves an
 * explicit choice in localStorage.
 */

export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "sitesentinel-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Runs inline in <head> before first paint so the page never flashes the wrong
 * theme. Kept dependency-free and wrapped in try/catch because localStorage can
 * throw (private mode, blocked storage).
 */
export const THEME_INIT_SCRIPT = `(function(){
  var key = ${JSON.stringify(THEME_STORAGE_KEY)};
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  function saved(){ try { var v = localStorage.getItem(key); return v === "light" || v === "dark" ? v : null; } catch (e) { return null; } }
  function apply(){ root.dataset.theme = saved() || (mq && mq.matches ? "light" : "dark"); }
  apply();
  if (mq && mq.addEventListener) mq.addEventListener("change", function(){ if (!saved()) apply(); });
  window.addEventListener("storage", function(e){ if (e.key === key) apply(); });
})();`;

export function getTheme(): Theme {
  const current = document.documentElement.dataset.theme;
  return isTheme(current) ? current : "dark";
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage unavailable: the theme still applies for this page view
  }
}
