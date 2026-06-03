export function getApiBaseUrl() {
  let envBaseUrl = String((import.meta as any).env?.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (envBaseUrl.endsWith('/api')) {
    envBaseUrl = envBaseUrl.slice(0, -4);
  }

  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').toLowerCase();
    const isLocalhostHost = host === 'localhost' || host === '127.0.0.1';

    if (isLocalhostHost && envBaseUrl) {
      const envHost = (() => {
        try {
          return new URL(envBaseUrl).hostname.toLowerCase();
        } catch {
          return '';
        }
      })();

      if (envHost && envHost !== 'localhost' && envHost !== '127.0.0.1') {
        console.warn('VITE_API_URL points to a remote host while frontend is running on localhost. Using local backend http://localhost:4000 for development.');
        envBaseUrl = '';
      }
    }

    if (!envBaseUrl && isLocalhostHost) {
      return 'http://localhost:4000';
    }
  }

  if (envBaseUrl) return envBaseUrl;
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