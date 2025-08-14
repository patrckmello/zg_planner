import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Header from './Header';
import Sidebar from './Sidebar';
import styles from './Dashboard.module.css';
import DeleteConfirmModal from './DeleteConfirmModal';
import api from '../services/axiosInstance';
import { useNavigate } from 'react-router-dom';
import { FiFilter, FiArrowDownCircle } from 'react-icons/fi';
import Checkbox from "./Checkbox/Checkbox";


function Dashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('due_date');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  const filteredTasks = tasks.filter(task => {
    if (filterStatus === 'all') return true;
    return task.status === filterStatus;
  });

  const toggleTaskStatus = async (taskId, newStatus) => {
    try {
      const response = await api.put(`/tasks/${taskId}`, {
        status: newStatus
      });

      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === taskId ? { ...t, status: response.data.status } : t
        )
      );
    } catch (err) {
      console.error('Erro ao atualizar status da tarefa', err);
    }
  };

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    if (sortBy === 'due_date') return new Date(a.due_date || 0) - new Date(b.due_date || 0);
  });

  useEffect(() => {
  const fetchTasks = async () => {
    try {
      const response = await api.get('/tasks'); 
      console.log('Tarefas recebidas no frontend:', response.data);
      setTasks(response.data);
    } catch (error) {
      console.error('Erro ao buscar tarefas:', error);
      toast.error('Erro ao buscar tarefas. Faça login novamente.', {
        position: "top-right",
        autoClose: 5000,
      });
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

  useEffect(() => {
    const savedFilter = localStorage.getItem('filterStatus');
    const savedSort = localStorage.getItem('sortBy');

    if (savedFilter) setFilterStatus(savedFilter);
    if (savedSort) setSortBy(savedSort);
  }, []);

  // Salva filtro no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('filterStatus', filterStatus);
  }, [filterStatus]);

  // Salva ordenação no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('sortBy', sortBy);
  }, [sortBy]);

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
  
  if (loading) {
  return (
    <div className={styles.spinnerContainer}>
      <div className={styles.spinner}></div>
    </div>
  );
}

const cancelDelete = () => {
  setTaskToDelete(null);
  setShowDeleteModal(false);
};

const confirmDelete = async () => {
  if (!taskToDelete) return;

  try {
    await api.delete(`/tasks/${taskToDelete.id}`);
    setTasks(prev => prev.filter(t => t.id !== taskToDelete.id));
  } catch (error) {
    console.error('Erro ao excluir tarefa:', error);
  } finally {
    setTaskToDelete(null);
    setShowDeleteModal(false);
  }
};

  return (
    // O container de toda a página
    <div className={styles.dashboardPage}>
      <Header onMenuToggle={toggleSidebar} />

      {/* O corpo da página, que contém a sidebar e o conteúdo */}
      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />
        
        {/* A área de conteúdo principal, que será nosso fundo cinza */}
        <main className={styles.contentArea}>

          {/* Um wrapper para o conteúdo das tarefas, para que possamos posicioná-lo */}
          <div className={styles.tasksWrapper}>
            <div className={styles.tasksHeader}>
              <h2>Minhas Tarefas</h2>
              <button className={styles.addTaskBtn} onClick={() => navigate('/tasks/new')}>+ Nova Tarefa</button>
            </div>
            
            <div className={styles.controls}>
              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>
                  <FiFilter className={styles.icon} />
                  Filtrar:
                  <select 
                    className={styles.select} 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">Todas</option>
                    <option value="pending">Pendentes</option>
                    <option value="done">Concluídas</option>
                  </select>
                </label>
              </div>

              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>
                  <FiArrowDownCircle className={styles.icon} />
                  Ordenar por:
                  <select 
                    className={styles.select} 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="due_date">Data de vencimento</option>
                    <option value="title">Título</option>
                    <option value="status">Status</option>
                  </select>
                </label>
              </div>
            </div>

            <div className={styles.tasksList}>
              {sortedTasks.length === 0 ? (
                <div className={styles.emptyTasks}>
                  {filterStatus === 'done' && "Nenhuma tarefa concluída encontrada."}
                  {filterStatus === 'pending' && "Nenhuma tarefa pendente encontrada."}
                  {filterStatus === 'all' && "Nenhuma tarefa cadastrada."}
                </div>
              ) : (
                sortedTasks.map(task => {
                  const isLate = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

                  return (
                    <div
                      key={task.id}
                      className={`${styles.taskItem} ${task.status === 'done' ? styles.completed : ''} ${isLate ? styles.taskLate : ''}`}
                    >
                      <Checkbox
                        checked={task.status === 'done'}
                        onCheckedChange={(checked) => toggleTaskStatus(task.id, checked ? 'done' : 'pending')}
                      />
                      <span className={styles.taskTitle}>{task.title}</span>
                      <div className={styles.taskActions}>
                        <button
                          className={styles.editBtn}
                          onClick={() => navigate(`/tasks/${task.id}/edit`)}
                        >
                          Editar
                        </button>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => {
                            setTaskToDelete(task);
                            setShowDeleteModal(true);
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>
        <DeleteConfirmModal 
          isOpen={showDeleteModal} 
          onCancel={cancelDelete} 
          onConfirm={confirmDelete} 
          taskTitle={taskToDelete?.title || ''} 
        />
      </div>
    </div>
  );
}

export default Dashboard;

