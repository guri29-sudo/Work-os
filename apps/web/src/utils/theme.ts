/**
 * Theme manager for WorkOS Communication System.
 * Supports data-theme="dark", localStorage persistence, and prefers-color-scheme fallback.
 */

export function initTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('workos_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved === 'dark' || saved === 'light' ? saved : (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
  return theme;
}

export function applyTheme(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('workos_theme', theme);
}

export function toggleTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  const current = document.documentElement.getAttribute('data-theme') ||
    (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

