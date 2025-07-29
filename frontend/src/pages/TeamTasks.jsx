import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import styles from './TeamTasks.module.css';
import api from '../services/axiosInstance';
import { useNavigate } from 'react-router-dom';
import { FiFilter, FiArrowDownCircle, FiUsers, FiCheckCircle, FiClock, FiAlertCircle } from 'react-icons/fi';
import Checkbox from "../components/Checkbox/Checkbox";

function TeamTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('due_date');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [showMemberFilter, setShowMemberFilter] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  // Estatísticas das tarefas
  const [taskStats, setTaskStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    overdue: 0
  });

  // Buscar equipes do usuário
  useEffect(() => {
    const fetchUserTeams = async () => {
      try {
        const response = await api.get('/users/me');
        const userTeams = response.data.equipes || [];
        setTeams(userTeams);
        
        // Buscar membros de todas as equipes
        const allMembers = [];
        for (const team of userTeams) {
          try {
            const teamResponse = await api.get(`/teams/${team.id}/members`);
            const membersWithTeam = teamResponse.data.map(member => ({
              ...member,
              teamId: team.id,
              teamName: team.name
            }));
            allMembers.push(...membersWithTeam);
          } catch (error) {
            console.error(`Erro ao buscar membros da equipe ${team.name}:`, error);
          }
        }
        
        // Remover duplicatas (usuário pode estar em múltiplas equipes)
        const uniqueMembers = allMembers.filter((member, index, self) => 
          index === self.findIndex(m => m.id === member.id)
        );
        
        setTeamMembers(uniqueMembers);
        setSelectedMembers(uniqueMembers.map(m => m.id)); // Selecionar todos por padrão
      } catch (error) {
        console.error('Erro ao buscar equipes:', error);
      }
    };

    fetchUserTeams();
  }, []);

  // Buscar tarefas da equipe
  useEffect(() => {
    const fetchTeamTasks = async () => {
      if (teams.length === 0) return;
      
      try {
        setLoading(true);
        const allTasks = [];
        
        for (const team of teams) {
          try {
            const response = await api.get(`/teams/${team.id}/tasks`);
            const tasksWithTeam = response.data.map(task => ({
              ...task,
              teamId: team.id,
              teamName: team.name
            }));
            allTasks.push(...tasksWithTeam);
          } catch (error) {
            console.error(`Erro ao buscar tarefas da equipe ${team.name}:`, error);
          }
        }
        
        setTasks(allTasks);
        calculateStats(allTasks);
      } catch (error) {
        console.error('Erro ao buscar tarefas das equipes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamTasks();
  }, [teams]);

  // Calcular estatísticas
  const calculateStats = (taskList) => {
    const now = new Date();
    const stats = {
      total: taskList.length,
      pending: taskList.filter(t => t.status === 'pending').length,
      completed: taskList.filter(t => t.status === 'done').length,
      overdue: taskList.filter(t => 
        t.status !== 'done' && 
        t.due_date && 
        new Date(t.due_date) < now
      ).length
    };
    setTaskStats(stats);
  };

  // Filtrar tarefas
  const filteredTasks = tasks.filter(task => {
    // Filtro por status
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    
    // Filtro por membros selecionados
    if (selectedMembers.length > 0 && !selectedMembers.includes(task.assigned_to)) return false;
    
    return true;
  });

  // Ordenar tarefas
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    if (sortBy === 'due_date') return new Date(a.due_date || 0) - new Date(b.due_date || 0);
    if (sortBy === 'assignee') {
      const memberA = teamMembers.find(m => m.id === a.assigned_to)?.username || '';
      const memberB = teamMembers.find(m => m.id === b.assigned_to)?.username || '';
      return memberA.localeCompare(memberB);
    }
    return 0;
  });

  // Manipular seleção de membros
  const handleMemberToggle = (memberId) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAllMembers = () => {
    setSelectedMembers(teamMembers.map(m => m.id));
  };

  const handleDeselectAllMembers = () => {
    setSelectedMembers([]);
  };

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

  // Atualizar status da tarefa
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
      
      // Recalcular estatísticas
      const updatedTasks = tasks.map(t =>
        t.id === taskId ? { ...t, status: response.data.status } : t
      );
      calculateStats(updatedTasks);
    } catch (err) {
      console.error('Erro ao atualizar status da tarefa', err);
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
    <div className={styles.teamTasksPage}>
      <Header onLogout={handleLogout} onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} />
        
        <main className={styles.contentArea}>
          <div className={styles.tasksWrapper}>
            {/* Cabeçalho */}
            <div className={styles.tasksHeader}>
              <h2>Tarefas da Equipe</h2>
              <div className={styles.headerStats}>
                <div className={styles.statCard}>
                  <FiUsers className={styles.statIcon} />
                  <div>
                    <span className={styles.statNumber}>{taskStats.total}</span>
                    <span className={styles.statLabel}>Total</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <FiClock className={styles.statIcon} />
                  <div>
                    <span className={styles.statNumber}>{taskStats.pending}</span>
                    <span className={styles.statLabel}>Pendentes</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <FiCheckCircle className={styles.statIcon} />
                  <div>
                    <span className={styles.statNumber}>{taskStats.completed}</span>
                    <span className={styles.statLabel}>Concluídas</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <FiAlertCircle className={styles.statIcon} />
                  <div>
                    <span className={styles.statNumber}>{taskStats.overdue}</span>
                    <span className={styles.statLabel}>Atrasadas</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Controles de filtro */}
            <div className={styles.controls}>
              <div className={styles.controlGroup}>
                <label className={styles.controlLabel}>
                  <FiFilter className={styles.icon} />
                  Status:
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
                    <option value="assignee">Responsável</option>
                  </select>
                </label>
              </div>

              {/* Filtro de membros */}
              <div className={styles.memberFilterContainer}>
                <button 
                  className={styles.memberFilterBtn}
                  onClick={() => setShowMemberFilter(!showMemberFilter)}
                >
                  <FiUsers className={styles.icon} />
                  Filtrar Membros ({selectedMembers.length}/{teamMembers.length})
                </button>
                
                {showMemberFilter && (
                  <div className={styles.memberFilterDropdown}>
                    <div className={styles.memberFilterHeader}>
                      <button 
                        className={styles.selectAllBtn}
                        onClick={handleSelectAllMembers}
                      >
                        Selecionar Todos
                      </button>
                      <button 
                        className={styles.deselectAllBtn}
                        onClick={handleDeselectAllMembers}
                      >
                        Desmarcar Todos
                      </button>
                    </div>
                    
                    <div className={styles.membersList}>
                      {teamMembers.map(member => (
                        <label key={member.id} className={styles.memberItem}>
                          <Checkbox
                            checked={selectedMembers.includes(member.id)}
                            onCheckedChange={() => handleMemberToggle(member.id)}
                          />
                          <span className={styles.memberName}>{member.username}</span>
                          <span className={styles.memberTeam}>({member.teamName})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lista de tarefas */}
            <div className={styles.tasksList}>
              {sortedTasks.length === 0 ? (
                <div className={styles.emptyTasks}>
                  {filterStatus === 'done' && "Nenhuma tarefa concluída encontrada."}
                  {filterStatus === 'pending' && "Nenhuma tarefa pendente encontrada."}
                  {filterStatus === 'all' && selectedMembers.length === 0 && "Selecione pelo menos um membro para visualizar as tarefas."}
                  {filterStatus === 'all' && selectedMembers.length > 0 && "Nenhuma tarefa encontrada para os membros selecionados."}
                </div>
              ) : (
                sortedTasks.map(task => {
                  const isLate = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
                  const assignedMember = teamMembers.find(m => m.id === task.assigned_to);

                  return (
                    <div
                      key={task.id}
                      className={`${styles.taskItem} ${task.status === 'done' ? styles.completed : ''} ${isLate ? styles.taskLate : ''}`}
                    >
                      <Checkbox
                        checked={task.status === 'done'}
                        onCheckedChange={(checked) => toggleTaskStatus(task.id, checked ? 'done' : 'pending')}
                      />
                      
                      <div className={styles.taskContent}>
                        <div className={styles.taskTitle}>{task.title}</div>
                        <div className={styles.taskMeta}>
                          <span className={styles.taskAssignee}>
                            Responsável: {assignedMember?.username || 'Não atribuído'}
                          </span>
                          <span className={styles.taskTeam}>
                            Equipe: {task.teamName}
                          </span>
                          {task.due_date && (
                            <span className={styles.taskDueDate}>
                              Vencimento: {new Date(task.due_date).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className={styles.taskStatus}>
                        <span className={`${styles.statusBadge} ${styles[task.status]}`}>
                          {task.status === 'done' ? 'Concluída' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default TeamTasks;

