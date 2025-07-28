import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5555/api', // troca pra prod se precisar
});

// Intercepta todas as requisições e injeta o token
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Intercepta todas as respostas com erro (401, 403, etc)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      const { status } = error.response;

      // Se o token expirou ou é inválido
      if (status === 401 || status === 403) {
        console.warn('Token expirado ou acesso negado');
        localStorage.removeItem('access_token');
        window.location.href = '/dashboard'; // ou usar `navigate()` se tiver acesso ao hook
      }
    }
    return Promise.reject(error);
  }
);

export default api;
