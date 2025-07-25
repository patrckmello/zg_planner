import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import api from '../services/axiosInstance';
import styles from './Sidebar.module.css';

function Sidebar({ isOpen }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/users/me');
        setUser(response.data);
      } catch (error) {
        console.error('Erro ao buscar usuário:', error);
      }
    };

    fetchUser();
  }, []);

  if (!user) {
    return (
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div>Carregando usuário...</div>
      </aside>
    );
  }

  const userInitial = user.username ? user.username.charAt(0).toUpperCase() : 'U';

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
      <div className={styles.userSection}>
        <div className={styles.userAvatar}>
          <span>{userInitial}</span>
        </div>
        <div className={styles.userDetails}>
          <span className={styles.userName}>{user.username}</span>
          <span className={styles.userEmail}>{user.email}</span>
        </div>
      </div>

      <nav className={styles.navigation}>
        <ul>
          <li className={styles.active}>
            <Link to="/">
              <span className={styles.icon}>📋</span>
              <span>Minhas Tarefas</span>
            </Link>
          </li>
          {/* <li>
            <Link to="/equipe">
              <span className={styles.icon}>👥</span>
              <span>Equipe</span>
            </Link>
          </li>
          <li>
            <Link to="/calendario">
              <span className={styles.icon}>📅</span>
              <span>Calendário</span>
            </Link>
          </li>
          <li>
            <Link to="/configuracoes">
              <span className={styles.icon}>⚙️</span>
              <span>Configurações</span>
            </Link>
          </li> */}
        </ul>
      </nav>

      <div className={styles.sidebarFooter}>
        <span>{String.fromCodePoint(0x00A9)} Desenvolvido por TI Zavagna Gralha</span>
      </div>
    </aside>
  );
}

export default Sidebar;
