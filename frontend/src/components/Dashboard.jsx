import React, { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import styles from './Dashboard.module.css';

function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Manteremos a sidebar aberta por padrão em telas maiores
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  useEffect(() => {
    setTimeout(() => {
      setTasks([
        { id: 1, title: 'Finalizar API de autenticação', completed: false },
        { id: 2, title: 'Estilizar componentes do Dashboard', completed: false },
        { id: 3, title: 'Preparar para o próximo sprint', completed: false },
      ]);
      setLoading(false);
    }, 1000);

    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    window.location.href = '/login';
  };
  
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (loading) return <div className={styles.loading}>Carregando...</div>;

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
              <button className={styles.addTaskBtn}>+ Nova Tarefa</button>
            </div>
            
            <div className={styles.tasksList}>
              {tasks.length === 0 ? (
                <div className={styles.emptyTasks}>Nenhuma tarefa encontrada.</div>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className={`${styles.taskItem} ${task.completed ? styles.completed : ''}`}>
                    <input 
                      type="checkbox" 
                      checked={task.completed} 
                      onChange={() => {/* Implementar toggle */}} 
                    />
                    <span className={styles.taskTitle}>{task.title}</span>
                    <div className={styles.taskActions}>
                      <button className={styles.editBtn}>Editar</button>
                      <button className={styles.deleteBtn}>Excluir</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
