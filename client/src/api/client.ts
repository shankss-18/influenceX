import axios from 'axios';

// Uses VITE_API_BASE_URL from Vercel environment. Falls back to /api for local dev.
// Works whether the value ends with /api or not.
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

// Intercept responses to handle 401s cleanly
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
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      try {
        const refreshUrl = API_BASE_URL.endsWith('/')
          ? `${API_BASE_URL}auth/refresh`
          : `${API_BASE_URL}/auth/refresh`;
        await axios.post(refreshUrl, {}, { withCredentials: true });
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token failed, reject cleanly
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);
