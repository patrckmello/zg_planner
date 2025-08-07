import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import TaskTabs from '../components/TaskTabs';
import ViewModeSelector from '../components/ViewModeSelector';
import KanbanBoard from '../components/KanbanBoard';
import styles from './TasksPage.module.css';
import api from '../services/axiosInstance';
import { FiPlus } from 'react-icons/fi';

function TasksPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('minhas');
  const [viewMode, setViewMode] = useState('status');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // Filtrar tarefas baseado na aba ativa
  const getFilteredTasks = (allTasks, tab) => {
    // Esta lógica precisa ser ajustada baseada na estrutura real dos dados
    switch (tab) {
      case 'minhas':
        // Tarefas criadas pelo usuário atual
        return allTasks.filter(task => task.created_by_current_user);
      case 'equipe':
        // Tarefas atribuídas ao usuário ou da sua equipe
        return allTasks.filter(task => task.assigned_to_current_user || task.team_task);
      case 'colaborativas':
        // Tarefas onde o usuário é colaborador
        return allTasks.filter(task => task.is_collaborator);
      default:
        return allTasks;
    }
  };

  const filteredTasks = getFilteredTasks(tasks, activeTab);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await api.get('/tasks');
        console.log('Tarefas recebidas:', response.data);
        setTasks(response.data);
      } catch (error) {
        console.error('Erro ao buscar tarefas:', error);
        alert('Erro ao buscar tarefas. Faça login novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();

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
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, ...updateData } : task
      )
    );
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
                  <div className={styles.emptyIcon}>📋</div>
                  <h3 className={styles.emptyTitle}>Nenhuma tarefa encontrada</h3>
                  <p className={styles.emptyDescription}>
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

