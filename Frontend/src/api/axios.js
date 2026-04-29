import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Read from Zustand store first, fallback to localStorage directly
    // This handles the hydration race condition
    let token = null;

    try {
      // Try Zustand store
      const { useAuthStore } = require('../store/auth.store');
      token = useAuthStore.getState().accessToken;
    } catch { /* ignore */ }

    // Fallback: read directly from persisted localStorage
    if (!token) {
      try {
        const persisted = localStorage.getItem('auth-storage');
        if (persisted) {
          const parsed = JSON.parse(persisted);
          token = parsed?.state?.accessToken || null;
        }
      } catch { /* ignore */ }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Include current (expired) token in header so backend can extract userId
        const { useAuthStore } = require('../store/auth.store');
        const expiredToken = useAuthStore.getState().accessToken;

        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: expiredToken
              ? { Authorization: `Bearer ${expiredToken}` }
              : {},
          }
        );

        const newToken = response.data.data.accessToken;

        const { useAuthStore: store } = require('../store/auth.store');
        store.getState().setAccessToken(newToken);

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        const { useAuthStore } = require('../store/auth.store');
        useAuthStore.getState().logout();

        window.location.href = '/login';

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;