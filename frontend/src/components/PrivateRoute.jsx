// frontend/src/components/PrivateRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAuthenticated, canAccessAdminRoutes } from '../auth';

/**
 * Componente de rota protegida com suporte a diferentes níveis de permissão
 * @param {boolean} adminOnly - Se true, exige que o usuário seja administrador
 * @param {boolean} managerOnly - Se true, exige que o usuário seja gerente
 * @param {Array} requiredRoles - Array de roles necessárias para acessar a rota
 * @param {number} requiredTeamId - ID da equipe necessária para acessar a rota
 */
function PrivateRoute({ 
  adminOnly = false, 
  managerOnly = false, 
  requiredRoles = [], 
  requiredTeamId = null 
}) {
  const [authState, setAuthState] = useState({
    checked: false,
    user: null,
    loading: true
  });
  const location = useLocation();

  useEffect(() => {
    async function checkAuth() {
      try {
        setAuthState(prev => ({ ...prev, loading: true }));
        
        const user = await isAuthenticated();
        
        setAuthState({
          checked: true,
          user: user,
          loading: false
        });
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        setAuthState({
          checked: true,
          user: null,
          loading: false
        });
      }
    }
    
    checkAuth();
  }, [location.pathname]); // Re-verifica quando a rota muda

  // Componente de loading elegante que ocupa toda a tela
  if (authState.loading || !authState.checked) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f2f4f8',
        zIndex: 9999
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px'
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '6px solid #e0e0e0',
            borderTop: '6px solid #4e79a7',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}></div>
          <p style={{ 
            color: '#666', 
            fontSize: '16px',
            margin: 0,
            fontWeight: '500'
          }}>
            Verificando permissões...
          </p>
        </div>
        <style>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  // Usuário não autenticado: redireciona para login
  if (!authState.user) {
    return <Navigate 
      to="/login" 
      state={{ from: location }} 
      replace 
    />;
  }

  const { user } = authState;

  // Verifica permissões de administrador
  if (adminOnly && !user.is_admin) {
    console.warn(`Acesso negado à rota administrativa: ${location.pathname}`);
    return <Navigate 
      to="/dashboard" 
      state={{ 
        error: 'Acesso negado. Permissões de administrador necessárias.',
        from: location 
      }} 
      replace 
    />;
  }

  // Verifica permissões de gerente
  if (managerOnly && !user.is_manager && !user.is_admin) {
    console.warn(`Acesso negado à rota de gerente: ${location.pathname}`);
    return <Navigate 
      to="/dashboard" 
      state={{ 
        error: 'Acesso negado. Permissões de gerente necessárias.',
        from: location 
      }} 
      replace 
    />;
  }

  // Verifica roles específicas
  if (requiredRoles.length > 0 && !user.is_admin) {
    const hasRequiredRole = requiredRoles.some(role => 
      user.roles?.includes(role) || user.role === role
    );
    
    if (!hasRequiredRole) {
      console.warn(`Acesso negado - role necessária: ${requiredRoles.join(' ou ')}`);
      return <Navigate 
        to="/dashboard" 
        state={{ 
          error: `Acesso negado. Função necessária: ${requiredRoles.join(' ou ')}.`,
          from: location 
        }} 
        replace 
      />;
    }
  }

  // Verifica pertencimento à equipe específica
  if (requiredTeamId && !user.is_admin) {
    const belongsToTeam = user.teams?.some(team => team.id === requiredTeamId);
    
    if (!belongsToTeam) {
      console.warn(`Acesso negado - equipe necessária: ${requiredTeamId}`);
      return <Navigate 
        to="/dashboard" 
        state={{ 
          error: 'Acesso negado. Você não pertence à equipe necessária.',
          from: location 
        }} 
        replace 
      />;
    }
  }

  // Log de acesso bem-sucedido para rotas administrativas
  if (adminOnly) {
    console.log(`Acesso administrativo autorizado para: ${location.pathname}`);
  }

  // Todas as verificações passaram, renderiza o componente filho
  return <Outlet />;
}

/**
 * Hook personalizado para verificar permissões em componentes
 * @returns {Object} Objeto com informações de permissões
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState({
    isAdmin: false,
    isManager: false,
    user: null,
    loading: true
  });

  useEffect(() => {
    async function checkPermissions() {
      try {
        const user = await isAuthenticated();
        const isAdminUser = await canAccessAdminRoutes();
        
        setPermissions({
          isAdmin: isAdminUser,
          isManager: user?.is_manager || false,
          user: user,
          loading: false
        });
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        setPermissions({
          isAdmin: false,
          isManager: false,
          user: null,
          loading: false
        });
      }
    }
    
    checkPermissions();
  }, []);

  return permissions;
}

/**
 * Componente para renderização condicional baseada em permissões
 * @param {Object} props - Propriedades do componente
 * @param {boolean} props.adminOnly - Renderiza apenas para admins
 * @param {boolean} props.managerOnly - Renderiza apenas para gerentes
 * @param {React.ReactNode} props.children - Componentes filhos
 * @param {React.ReactNode} props.fallback - Componente alternativo
 */
export function PermissionGuard({ 
  adminOnly = false, 
  managerOnly = false, 
  children, 
  fallback = null 
}) {
  const { isAdmin, isManager, loading } = usePermissions();

  if (loading) {
    return fallback || <div>Carregando...</div>;
  }

  if (adminOnly && !isAdmin) {
    return fallback;
  }

  if (managerOnly && !isManager && !isAdmin) {
    return fallback;
  }

  return children;
}

export default PrivateRoute;

