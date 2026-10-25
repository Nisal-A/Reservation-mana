export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api';

const getOrigin = (url) => {
  try {
    return new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3001').origin;
  } catch {
    return url.replace(/\/api\/?$/, '');
  }
};

export const API_ORIGIN = getOrigin(API_URL);

export function assetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}${cleanPath}`;
}
