import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import TaskTabs from '../components/TaskTabs';
import ViewModeSelector from '../components/ViewModeSelector';
import KanbanBoard from '../components/KanbanBoard';
import styles from './TasksPage.module.css';
import api from '../services/axiosInstance';
import { FiPlus, FiClipboard } from 'react-icons/fi';

function TasksPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('minhas');
  const [viewMode, setViewMode] = useState('status');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [currentUser, setCurrentUser] = useState(null);

  // Filtrar tarefas baseado na aba ativa
  const getFilteredTasks = (allTasks, tab, user) => {
    if (!user) return allTasks;
    
    switch (tab) {
      case 'minhas':
        // Tarefas onde o usuário é responsável E que ele mesmo criou (não foram atribuídas por outros)
        return allTasks.filter(task => 
          task.user_id === user.id && 
          (task.assigned_by_user_id === null || task.assigned_by_user_id === user.id)
        );
      case 'equipe':
        // Tarefas que têm team_id (tarefas de equipe) OU tarefas que o usuário atribuiu para outros
        // EXCLUIR tarefas onde o usuário é apenas colaborador
        return allTasks.filter(task => 
          (task.team_id !== null || 
          (task.assigned_by_user_id === user.id && task.user_id !== user.id)) &&
          !(task.collaborators && task.collaborators.includes(user.id) && task.user_id !== user.id && task.assigned_by_user_id !== user.id)
        );
      case 'colaborativas':
        // Tarefas onde o usuário está na lista de colaboradores
        return allTasks.filter(task => 
          task.collaborators && task.collaborators.includes(user.id)
        );
      default:
        return allTasks;
    }
  };

  const filteredTasks = getFilteredTasks(tasks, activeTab, currentUser);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Buscar dados do usuário atual
        const userResponse = await api.get('/users/me');
        setCurrentUser(userResponse.data);
        
        // Buscar tarefas
        const tasksResponse = await api.get('/tasks');
        console.log('Tarefas recebidas:', tasksResponse.data);
        setTasks(tasksResponse.data);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
        toast.error('Erro ao buscar dados. Faça login novamente.', {
          position: "top-right",
          autoClose: 5000,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Salvar preferências no localStorage
  useEffect(() => {
    localStorage.setItem('tasksActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('tasksViewMode', viewMode);
  }, [viewMode]);

  // Carregar preferências do localStorage
  useEffect(() => {
    const savedTab = localStorage.getItem('tasksActiveTab');
    const savedViewMode = localStorage.getItem('tasksViewMode');

    if (savedTab) setActiveTab(savedTab);
    if (savedViewMode) setViewMode(savedViewMode);
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
    } finally {
      localStorage.removeItem('auth');
      navigate('/login');
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleTaskUpdate = (taskId, updateData) => {
    // Se a tarefa foi excluída, removê-la da lista
    if (updateData.deleted) {
      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    } else {
      // Caso contrário, atualizar a tarefa
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, ...updateData } : task
        )
      );
    }
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
  };

  const handleViewModeChange = (newViewMode) => {
    setViewMode(newViewMode);
  };

  if (loading) {
    return (
      <div className={styles.spinnerContainer}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div className={styles.tasksPage}>
      <Header onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />
        
        <main className={styles.contentArea}>
          <div className={styles.tasksWrapper}>
            {/* Header da página */}
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <h1 className={styles.pageTitle}>Minhas Tarefas</h1>
                <button 
                  className={styles.addTaskBtn} 
                  onClick={() => navigate('/tasks/new')}
                >
                  <FiPlus />
                  Nova Tarefa
                </button>
              </div>
              
              <div className={styles.breadcrumb}>
                <span>Dashboard</span>
                <span className={styles.separator}>›</span>
                <span className={styles.current}>Tarefas</span>
              </div>
            </div>

            {/* Sistema de abas */}
            <TaskTabs 
              activeTab={activeTab} 
              onTabChange={handleTabChange} 
            />

            {/* Seletor de modo de visualização */}
            <ViewModeSelector 
              viewMode={viewMode} 
              onViewModeChange={handleViewModeChange} 
            />

            {/* Kanban Board */}
            <div className={styles.kanbanContainer}>
              {filteredTasks.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}><FiClipboard /></div>
                  <h3 className={styles.emptyTitle}>Nenhuma tarefa encontrada</h3>                 <p className={styles.emptyDescription}>
                    {activeTab === 'minhas' && 'Você ainda não criou nenhuma tarefa.'}
                    {activeTab === 'equipe' && 'Não há tarefas atribuídas à sua equipe.'}
                    {activeTab === 'colaborativas' && 'Você não está colaborando em nenhuma tarefa.'}
                  </p>
                  <button 
                    className={styles.emptyAction}
                    onClick={() => navigate('/tasks/new')}
                  >
                    <FiPlus />
                    Criar primeira tarefa
                  </button>
                </div>
              ) : (
                <KanbanBoard
                  tasks={filteredTasks}
                  onTaskUpdate={handleTaskUpdate}
                  viewMode={viewMode}
                  activeTab={activeTab}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default TasksPage;

