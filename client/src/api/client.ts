import axios from 'axios';

// Uses VITE_API_BASE_URL from Vercel environment. Falls back to /api for local dev.
const _rawBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
const API_BASE_URL = _rawBase
  ? _rawBase.replace(/\/api\/?$/, '') + '/api'
  : '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Token Storage ────────────────────────────────────────────────────────────
// Cross-origin deployments (Vercel → Render) can't use cookies.
// We store the JWT access token and attach it as Authorization header.

const TOKEN_KEY = 'ix_access_token';

export function setAccessToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // fallback: in-memory
    (window as any).__ixToken = token;
  }
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return (window as any).__ixToken || null;
  }
}

export function clearAccessToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    delete (window as any).__ixToken;
  }
}

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attach stored access token to every request as Authorization header
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite loop on auth endpoints
    if (
      originalRequest &&
      !originalRequest._retry &&
      error.response?.status === 401 &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/me')
    ) {
      originalRequest._retry = true;
      try {
        const refreshUrl = API_BASE_URL.endsWith('/')
          ? `${API_BASE_URL}auth/refresh`
          : `${API_BASE_URL}/auth/refresh`;
        const refreshRes = await axios.post(refreshUrl, {}, { withCredentials: true });
        // If backend returns a new accessToken in the body, store it
        if (refreshRes.data?.accessToken) {
          setAccessToken(refreshRes.data.accessToken);
        }
        return api(originalRequest);
      } catch (refreshError) {
        clearAccessToken();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);
