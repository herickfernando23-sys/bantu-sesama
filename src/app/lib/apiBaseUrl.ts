export function getApiBaseUrl() {
  const envBaseUrl = String((import.meta as any).env?.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (envBaseUrl) return envBaseUrl;

  if (typeof window !== 'undefined' && window.location?.hostname) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
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