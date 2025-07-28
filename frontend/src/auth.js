// frontend/src/auth.js
import api from './services/axiosInstance';

/**
 * Verifica se o usuário está autenticado e retorna os dados do usuário
 * @returns {Object|null} Dados do usuário ou null se não autenticado
 */
export async function isAuthenticated() {
  const token = localStorage.getItem('access_token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    return null;
  }

  try {
  
    // Verifica se o token ainda é válido fazendo uma requisição para o backend
    try {
      const response = await api.get('/users/me');
      // Atualiza os dados do usuário no localStorage com dados frescos do servidor
      const updatedUser = response.data;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (error) {
      // Se a requisição falhar (token inválido/expirado), limpa o localStorage
      console.warn('Token inválido ou expirado:', error);
      clearAuth();
      return null;
    }
  } catch (error) {
    console.error('Erro ao parsear dados do usuário:', error);
    clearAuth();
    return null;
  }
}

/**
 * Verifica se o usuário é administrador
 * @returns {boolean} True se o usuário for admin, false caso contrário
 */
export async function isAdmin() {
  const user = await isAuthenticated();
  return user && user.is_admin === true;
}

/**
 * Verifica se o usuário tem permissão para acessar rotas administrativas
 * @returns {boolean} True se o usuário pode acessar rotas admin
 */
export async function canAccessAdminRoutes() {
  return await isAdmin();
}

/**
 * Obtém os dados do usuário autenticado
 * @returns {Object|null} Dados do usuário ou null
 */
export async function getCurrentUser() {
  return await isAuthenticated();
}

/**
 * Limpa todos os dados de autenticação do localStorage
 */
export function clearAuth() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  localStorage.removeItem('refresh_token'); // caso você use refresh tokens
}

/**
 * Salva os dados de autenticação no localStorage
 * @param {string} token - Token de acesso
 * @param {Object} user - Dados do usuário
 * @param {string} refreshToken - Token de refresh (opcional)
 */
export function setAuth(token, user, refreshToken = null) {
  localStorage.setItem('access_token', token);
  localStorage.setItem('user', JSON.stringify(user));
  if (refreshToken) {
    localStorage.setItem('refresh_token', refreshToken);
  }
}

/**
 * Verifica se o usuário tem uma função específica
 * @param {string} role - Nome da função a verificar
 * @returns {boolean} True se o usuário tem a função
 */
export async function hasRole(role) {
  const user = await isAuthenticated();
  return user && user.role === role;
}

/**
 * Verifica se o usuário pertence a uma equipe específica
 * @param {number} teamId - ID da equipe
 * @returns {boolean} True se o usuário pertence à equipe
 */
export async function belongsToTeam(teamId) {
  const user = await isAuthenticated();
  return user && user.teams && user.teams.some(team => team.id === teamId);
}

/**
 * Verifica se o usuário é gerente de alguma equipe
 * @returns {boolean} True se o usuário é gerente
 */
export async function isManager() {
  const user = await isAuthenticated();
  return user && user.is_manager === true;
}

/**
 * Força uma nova verificação de autenticação
 * Útil após operações que podem alterar permissões
 */
export async function refreshAuth() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  try {
    const response = await api.get('/users/me');
    const user = response.data;
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } catch (error) {
    console.warn('Erro ao atualizar dados de autenticação:', error);
    clearAuth();
    return null;
  }
}

