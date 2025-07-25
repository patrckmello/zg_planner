import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5555/api', // ou o endpoint real
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token'); // ou onde você guarda o token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
