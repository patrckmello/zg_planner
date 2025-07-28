import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import api from '../services/axiosInstance';
import styles from './Sidebar.module.css';
import {
  Home,
  ClipboardList,
  BarChart2,
  Users,
  Folder,
  PieChart,
  User,
  Briefcase,
  Settings,
} from 'lucide-react';

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
          <li>
            <Link to="/dashboard">
              <Home size={20} className={styles.icon} />
              <span>Dashboard</span>
            </Link>
          </li>

          <li className={styles.sectionLabel}>Minhas Atividades</li>
          <li>
            <Link to="/minhas-tarefas">
              <ClipboardList size={20} className={styles.icon} />
              <span>Minhas Tarefas</span>
            </Link>
          </li>
          <li>
            <Link to="/meus-relatorios">
              <BarChart2 size={20} className={styles.icon} />
              <span>Relatórios Pessoais</span>
            </Link>
          </li>

          {user?.equipes?.length > 0 && user.is_manager && (
            <>
              <li className={styles.sectionLabel}>Equipes</li>
              <li>
                <Link to="/tarefas-equipe">
                  <Folder size={20} className={styles.icon} />
                  <span>Tarefas da Equipe</span>
                </Link>
              </li>
              <li>
                <Link to="/relatorios-equipe">
                  <PieChart size={20} className={styles.icon} />
                  <span>Relatórios da Equipe</span>
                </Link>
              </li>
            </>
          )}

          {user?.is_admin && (
            <>
              <li className={styles.sectionLabel}>Administração</li>
              <li>
                <Link to="/admin/users/">
                  <User size={20} className={styles.icon} />
                  <span>Usuários</span>
                </Link>
              </li>
              <li>
                <Link to="/admin/cargos">
                  <Briefcase size={20} className={styles.icon} />
                  <span>Cargos</span>
                </Link>
              </li>
              <li>
                <Link to="/admin/equipes">
                  <Users size={20} className={styles.icon} />
                  <span>Equipes</span>
                </Link>
              </li>
              <li>
                <Link to="/admin/config">
                  <Settings size={20} className={styles.icon} />
                  <span>Configurações</span>
                </Link>
              </li>
            </>
          )}

          <li className={styles.sectionLabel}>Conta</li>
          <li>
            <Link to="/meu-perfil">
              <User size={20} className={styles.icon} />
              <span>Meu Perfil</span>
            </Link>
          </li>
        </ul>
      </nav>

      <div className={styles.sidebarFooter}>
        <span>{String.fromCodePoint(0x00A9)} Desenvolvido por TI Zavagna Gralha</span>
      </div>
    </aside>
  );
}

export default Sidebar;
