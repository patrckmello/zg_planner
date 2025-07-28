// frontend/src/components/PrivateRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../auth'; // função que retorna user ou null

/**
 * Componente de rota protegida
 * @param {boolean} adminOnly - se true, exige que user seja admin
 */
function PrivateRoute({ adminOnly = false }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      const authUser = await isAuthenticated(); // retorna user com is_admin ou null
      setUser(authUser);
      setAuthChecked(true);
    }
    checkAuth();
  }, []);

  if (!authChecked) return <p>Carregando...</p>;

  // Não autenticado: vai pro login
  if (!user) return <Navigate to="/login" replace />;

  // Se for rota admin e user não for admin: vai pra home (ou erro 403)
  if (adminOnly && !user.is_admin) return <Navigate to="/" replace />;

  return <Outlet />;
}

export default PrivateRoute;
