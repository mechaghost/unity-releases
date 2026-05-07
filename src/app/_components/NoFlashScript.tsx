// Inline script that sets <html data-theme="..."> before paint to avoid a
// brief light-mode flash when the user prefers dark.

const SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('unity-releases:theme');
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export function NoFlashScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
