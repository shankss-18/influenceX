import axios from 'axios';

// Always use relative /api path — Vercel proxy rewrite forwards to Render backend
const API_BASE_URL = '/api';

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
