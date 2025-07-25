import React, { useEffect, useState } from 'react';
import styles from './Header.module.css';
import api from '../services/axiosInstance';


function Header({ onLogout, onMenuToggle }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/users/me');
        console.log('User data:', response.data);  // <=== importante
        setUser(response.data);
      } catch (error) {
        console.error('Erro ao buscar usuário:', error);
      }
    };

    fetchUser();
  }, []);

  if (!user) {
    return (
      <header className={styles.header}>
        <div className={styles.logoSection}>
          <div className={styles.menuToggle} onClick={onMenuToggle}>
            <span>☰</span>
          </div>
          <h1 className={styles.logo}>ZG Planner</h1>
        </div>
        <div className={styles.userControls}>
          <div className={styles.userInfo}>
            <span className={styles.username}>Carregando...</span>
          </div>
        </div>
      </header>
    );
  }

  const username = user.username || 'Usuário';
  const role = user.role || 'Cargo não definido'; // Ajuste conforme a sua API

  return (
    <header className={styles.header}>
      <div className={styles.logoSection}>
        <div className={styles.menuToggle} onClick={onMenuToggle}>
          <span>☰</span>
        </div>
        <h1 className={styles.logo}>ZG Planner</h1>
      </div>

      <div className={styles.userControls}>
        <div className={styles.userInfo}>
          <span className={styles.username}>Olá, {username}</span>
          <span className={styles.role}>{role}</span>
        </div>
        <button className={styles.logoutBtn} onClick={onLogout}>
          Sair
        </button>
      </div>
    </header>
  );
}

export default Header;
