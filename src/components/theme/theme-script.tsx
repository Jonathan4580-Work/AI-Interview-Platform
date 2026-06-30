const themeScript = `
(() => {
  try {
    const stored = window.localStorage.getItem("aptly-theme");
    const theme = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    const resolved = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.dataset.theme = resolved;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
