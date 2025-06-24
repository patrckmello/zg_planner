import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Sidebar.module.css';

function Sidebar({ isOpen }) {
  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
      <div className={styles.userSection}>
        <div className={styles.userAvatar}>
          {/* Placeholder para avatar/iniciais */}
          <span>U</span>
        </div>
        <div className={styles.userDetails}>
          <span className={styles.userName}>Usuário</span>
          <span className={styles.userEmail}>usuario@exemplo.com</span>
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
          <li>
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
          </li>
        </ul>
      </nav>
      
      <div className={styles.sidebarFooter}>
        <span>Planner v1.0</span>
      </div>
    </aside>
  );
}

export default Sidebar;
