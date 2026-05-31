export function getApiBaseUrl() {
  const envBaseUrl = String((import.meta as any).env?.VITE_API_URL || '').trim().replace(/\/$/, '');
  if (envBaseUrl) return envBaseUrl;

  if (typeof window !== 'undefined' && window.location?.hostname) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:4000';
    }

    return window.location.origin.replace(/\/$/, '');
  }

  return '';
}

export function apiUrl(path: string) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return path.startsWith('/') ? path : `/${path}`;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}