import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data on 401
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      // Redirect to login only if not on public verify page
      if (!window.location.pathname.startsWith('/verify')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
