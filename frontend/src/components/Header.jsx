import React from 'react';
import styles from './Header.module.css';

function Header({ onLogout, onMenuToggle }) {
  // Obter nome do usuário do localStorage ou context
  const username = localStorage.getItem('username') || 'Usuário';
  
  return (
    <header className={styles.header}>
      <div className={styles.logoSection}>
        <div className={styles.menuToggle} onClick={onMenuToggle}>
          {/* Ícone de menu (pode usar um SVG ou biblioteca de ícones) */}
          <span>☰</span>
        </div>
        <h1 className={styles.logo}>ZG Planner</h1>
      </div>
      
      <div className={styles.userControls}>
        <div className={styles.userInfo}>
          <span className={styles.username}>Olá, {username}</span>
          <span className={styles.role}>Advogado</span>
        </div>
        <button className={styles.logoutBtn} onClick={onLogout}>
          Sair
        </button>
      </div>
    </header>
  );
}

export default Header;
