import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5555/api', // Ajusta se for diferente
});

// Adiciona automaticamente o token no header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;