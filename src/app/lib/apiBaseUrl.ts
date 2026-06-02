export function getApiBaseUrl() {
  let envBaseUrl = String((import.meta as any).env?.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (envBaseUrl.endsWith('/api')) {
    envBaseUrl = envBaseUrl.slice(0, -4);
  }
  if (envBaseUrl) return envBaseUrl;

  // Local dev fallback: when frontend is opened on localhost without VITE_API_URL,
  // call backend directly on port 4000 so API requests still work even without Vite proxy.
  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:4000';
    }
  }

  return '';
}

export function apiUrl(path: string) {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!baseUrl) {
    // Fall back to same-origin (useful when frontend and backend share origin or when VITE_API_URL
    // is intentionally left unset during local dev). Do NOT throw to avoid crashing the UI.
    console.warn('VITE_API_URL belum diset — menggunakan same-origin untuk `apiUrl` (prefix=', normalizedPath, ')');
    return normalizedPath;
  }

  return `${baseUrl}${normalizedPath}`;
}