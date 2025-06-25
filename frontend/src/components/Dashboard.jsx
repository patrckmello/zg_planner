import React, { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import styles from './Dashboard.module.css';
import TaskForm from './TaskForm';
import EditTaskForm from './EditTaskForm';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  // Manteremos a sidebar aberta por padrão em telas maiores
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const toggleTaskStatus = async (taskId, currentStatus) => {
    try {
      const response = await axios.put(`http://localhost:5000/api/tasks/${taskId}`, {
        status: currentStatus === 'done' ? 'pending' : 'done'
      }, { withCredentials: true });

      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === taskId ? { ...t, status: response.data.status } : t
        )
      );
    } catch (err) {
      console.error('Erro ao atualizar status da tarefa', err);
    }
  };
  
  const handleUpdateTask = async (formData) => {
    try {
      const response = await axios.put(
        `http://localhost:5000/api/tasks/${editingTask.id}`,
        formData,
        { withCredentials: true }
      );

      setTasks(prev =>
        prev.map(t => t.id === editingTask.id ? response.data : t)
      );

      setEditingTask(null);
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta tarefa?')) return;

    try {
      await axios.delete(`http://localhost:5000/api/tasks/${taskId}`, {
        withCredentials: true,
      });

      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error);
    }
  };

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/tasks', {
          withCredentials: true,
        });
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

  const handleLogout = async () => {
    try {
      await axios.post('http://localhost:5000/api/logout', {}, { withCredentials: true });
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

  const handleAddTask = async (newTask) => {
    try {
      const response = await axios.post('http://localhost:5000/api/tasks', newTask, {
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,
      });

      setTasks((prev) => [...prev, response.data]);
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar tarefa.');
    }
  };
  
  if (loading) {
  return (
    <div className={styles.spinnerContainer}>
      <div className={styles.spinner}></div>
    </div>
  );
}

  return (
    // O container de toda a página
    <div className={styles.dashboardPage}>
      <Header onLogout={handleLogout} onMenuToggle={toggleSidebar} />

      {/* O corpo da página, que contém a sidebar e o conteúdo */}
      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} />
        
        {/* A área de conteúdo principal, que será nosso fundo cinza */}
        <main className={styles.contentArea}>

          {/* Um wrapper para o conteúdo das tarefas, para que possamos posicioná-lo */}
          <div className={styles.tasksWrapper}>
            <div className={styles.tasksHeader}>
              <h2>Minhas Tarefas</h2>
              <button className={styles.addTaskBtn} onClick={() => setShowTaskForm(true)}>+ Nova Tarefa</button>
            </div>
            
            <div className={styles.tasksList}>
              {tasks.length === 0 ? (
                <div className={styles.emptyTasks}>Nenhuma tarefa encontrada.</div>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className={`${styles.taskItem} ${task.completed ? styles.completed : ''}`}>
                    <input 
                      type="checkbox" 
                      checked={task.status === 'done'} 
                      onChange={() => toggleTaskStatus(task.id, task.status)} 
                    />
                    <span className={styles.taskTitle}>{task.title}</span>
                    <div className={styles.taskActions}>
                      <button
                        className={styles.editBtn}
                        onClick={() => setEditingTask(task)}
                      >
                        Editar
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
        {showTaskForm && (
          <TaskForm
            onClose={() => {
              setShowTaskForm(false);
              setEditingTask(null);
            }}
            onSubmit={editingTask ? handleUpdateTask : handleAddTask}
            initialData={editingTask}
          />
        )}
        {editingTask && (
          <EditTaskForm
            initialData={editingTask}
            onClose={() => setEditingTask(null)}
            onSubmit={handleUpdateTask}
          />
        )}
      </div>
    </div>
  );
}

export default Dashboard;
