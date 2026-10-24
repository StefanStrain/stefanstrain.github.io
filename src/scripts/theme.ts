// The initial theme is set by the inline script in Base.astro before first paint; this only handles the toggle
function setTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // private windows can block storage, the toggle still works for this visit
  }
  // Same-origin iframes (Plotly charts, notebooks) listen for this to restyle themselves
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

document.addEventListener('astro:page-load', () => {
  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  });
});
