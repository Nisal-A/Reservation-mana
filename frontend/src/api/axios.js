import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../config/env';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hotel_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401/403 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    if (status === 401) {
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
      if (!isAuthEndpoint) {
        localStorage.removeItem('hotel_token');
        localStorage.removeItem('hotel_user');
        window.location.href = '/login';
      }
    } else if (status === 403) {
      const msg = error.response?.data?.message || 'Access denied. Insufficient permissions.';
      toast.error(msg);
    }

    return Promise.reject(error);
  }
);

export default api;
