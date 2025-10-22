import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import styles from "./TeamTasks.module.css";
import api from "../services/axiosInstance";
import {
  FiPlus,
  FiSearch,
  FiFilter,
  FiCalendar,
  FiUser,
  FiTag,
  FiClock,
  FiChevronDown,
  FiChevronUp,
  FiUsers,
  FiAlertCircle,
  FiCheckCircle,
  FiX,
} from "react-icons/fi";

// 👇 MODAL
import TaskModal from "../components/TaskModal";

/* ===================== Helpers ===================== */

// IDs podem vir como número/string/objeto
const normalizeId = (v) => (v == null ? null : String(v?.id ?? v?.user_id ?? v));

const collectAssignees = (task) => {
  const a = Array.isArray(task?.assigned_users) ? task.assigned_users.map(normalizeId) : [];
  const c = Array.isArray(task?.collaborators) ? task.collaborators.map(normalizeId) : [];
  const owner = normalizeId(task?.user_id);
  return Array.from(new Set([owner, ...a, ...c].filter(Boolean)));
};

// nome amigável independente da rota (teams/productivity/etc.)
const displayNameFromMember = (m) =>
  m?.name ??
  m?.username ??
  m?.user_name ??
  m?.user?.username ??
  m?.user?.name ??
  null;

// Normalizar prioridade
const normalizePriority = (priority) => {
  if (!priority) return priority;
  const map = {
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
    high: "Alta",
    medium: "Média",
    low: "Baixa",
  };
  return map[String(priority).toLowerCase()] || priority;
};

function TeamTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [currentUser, setCurrentUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Filtros
  const [filters, setFilters] = useState({
    selectedTeam: "",
    selectedMembers: [], // guarde como strings
    status: "",
    priority: "",
    category: "",
    dueDateFrom: "",
    dueDateTo: "",
    createdDateFrom: "",
    createdDateTo: "",
    searchTerm: "",
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTasks = filteredTasks.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);

  const hasAccess = () => currentUser?.is_admin || currentUser?.is_manager;

  /* ===================== Bootstrap ===================== */
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const userResponse = await api.get("/users/me");
        setCurrentUser(userResponse.data);

        if (!userResponse.data.is_admin && !userResponse.data.is_manager) {
          toast.error("Acesso negado. Apenas gestores e administradores podem acessar esta página.");
          navigate("/dashboard");
          return;
        }

        const teamsResponse = await api.get("/teams");
        let list = teamsResponse.data;

        // Se for gestor não-admin, mostre só times onde ele é gestor
        if (!userResponse.data.is_admin && userResponse.data.is_manager) {
          list = list.filter((team) =>
            team.members?.some((m) => m.user_id === userResponse.data.id && m.is_manager)
          );
        }
        setTeams(list);
      } catch (err) {
        console.error("Erro ao buscar dados iniciais:", err);
        toast.error("Erro ao carregar dados. Faça login novamente.");
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    const handleResize = () => {
      if (window.innerWidth <= 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [navigate]);

  /* ===================== Membros da equipe ===================== */
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!filters.selectedTeam) {
        setTeamMembers([]);
        return;
      }

      try {
        // tenta via produtividade (tem IDs + nomes)
        const { data } = await api.get(`/teams/${filters.selectedTeam}/productivity`);
        const members = (data.productivity || []).map((m) => ({
          user_id: String(m.user_id),
          name: m.user_name || m.username || `Usuário #${m.user_id}`,
          email: "",
          is_manager: false,
        }));
        setTeamMembers(members);
      } catch (error) {
        console.warn("Produtividade indisponível, fallback para /teams", error);
        try {
          const team = teams.find((t) => String(t.id) === String(filters.selectedTeam));
          if (team?.members?.length) {
            const members = team.members.map((member) => ({
              user_id: String(member.user_id),
              name: displayNameFromMember(member) || `Usuário #${member.user_id}`,
              email: member.email || "",
              is_manager: !!member.is_manager,
            }));
            setTeamMembers(members);
          } else {
            setTeamMembers([]);
          }
        } catch (e2) {
          console.error("Erro no fallback de membros:", e2);
          setTeamMembers([]);
          toast.error("Erro ao carregar membros da equipe");
        }
      }
    };

    fetchTeamMembers();
  }, [filters.selectedTeam, teams]);

  /* ===================== Tarefas ===================== */
  useEffect(() => {
    const fetchTasks = async () => {
      if (!filters.selectedTeam) {
        setTasks([]);
        setFilteredTasks([]);
        return;
      }

      try {
        setLoading(true);
        const params = new URLSearchParams();
        // (opcional) backend já exclui arquivadas por padrão; ajuste se quiser:
        // params.append("include_archived", "true");

        if (filters.status) params.append("status", filters.status);
        if (filters.dueDateFrom) params.append("due_after", filters.dueDateFrom);
        if (filters.dueDateTo) params.append("due_before", filters.dueDateTo);
        if (filters.searchTerm) params.append("search", filters.searchTerm);

        const response = await api.get(`/tasks?${params.toString()}`);

        // pertence à equipe se owner/assigned/collab ∈ membros
        const teamIds = new Set(teamMembers.map((m) => String(m.user_id)));
        let teamTasks = response.data.filter((task) => {
          const assignees = collectAssignees(task);
          return assignees.some((uid) => teamIds.has(String(uid)));
        });

        // filtro por membros selecionados (considera todos os responsáveis)
        if (filters.selectedMembers.length > 0) {
          const selectedSet = new Set(filters.selectedMembers.map(String));
          teamTasks = teamTasks.filter((task) => {
            const responsibleIds = collectAssignees(task);
            return responsibleIds.some((uid) => selectedSet.has(String(uid)));
          });
        }

        if (filters.priority) {
          teamTasks = teamTasks.filter(
            (task) => normalizePriority(task.prioridade) === filters.priority
          );
        }

        if (filters.category) {
          teamTasks = teamTasks.filter(
            (task) =>
              task.categoria &&
              String(task.categoria).toLowerCase().includes(filters.category.toLowerCase())
          );
        }

        if (filters.createdDateFrom) {
          const d = new Date(filters.createdDateFrom);
          teamTasks = teamTasks.filter((task) => new Date(task.created_at) >= d);
        }

        if (filters.createdDateTo) {
          const d = new Date(filters.createdDateTo);
          teamTasks = teamTasks.filter((task) => new Date(task.created_at) <= d);
        }

        setTasks(response.data);
        setFilteredTasks(teamTasks);
      } catch (error) {
        console.error("Erro ao buscar tarefas:", error);
        toast.error("Erro ao carregar tarefas");
      } finally {
        setLoading(false);
      }
    };

    if (teamMembers.length > 0) {
      fetchTasks();
    } else {
      setTasks([]);
      setFilteredTasks([]);
    }
  }, [filters, teamMembers]);

  /* ===================== Modal Handlers ===================== */
  const openTaskModal = (task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const closeTaskModal = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  const handleTaskUpdateFromModal = (taskId, updateData) => {
    setTasks((prev) => {
      if (updateData?.deleted) return prev.filter((t) => t.id !== taskId);
      return prev.map((t) => (t.id === taskId ? { ...t, ...updateData } : t));
    });

    setFilteredTasks((prev) => {
      if (updateData?.deleted) return prev.filter((t) => t.id !== taskId);
      return prev.map((t) => (t.id === taskId ? { ...t, ...updateData } : t));
    });
  };

  /* ===================== UI helpers ===================== */
  const handlePageChange = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) setCurrentPage(pageNumber);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setCurrentPage(1);
  };

  const handleMemberToggle = (memberId) => {
    const id = String(memberId);
    setFilters((prev) => {
      const exists = prev.selectedMembers.includes(id);
      return {
        ...prev,
        selectedMembers: exists
          ? prev.selectedMembers.filter((x) => x !== id)
          : [...prev.selectedMembers, id],
      };
    });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      selectedTeam: "",
      selectedMembers: [],
      status: "",
      priority: "",
      category: "",
      dueDateFrom: "",
      dueDateTo: "",
      createdDateFrom: "",
      createdDateTo: "",
      searchTerm: "",
    });
    setCurrentPage(1);
  };

  const handleLogout = async () => {
    try {
      await api.post("/logout");
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    } finally {
      localStorage.removeItem("auth");
      navigate("/login");
    }
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const getStatusIcon = (status) => {
    switch (status) {
      case "done":
        return <FiCheckCircle className={styles.statusIconDone} />;
      case "in_progress":
        return <FiClock className={styles.statusIconProgress} />;
      case "cancelled":
        return <FiX className={styles.statusIconCancelled} />;
      default:
        return <FiAlertCircle className={styles.statusIconPending} />;
    }
  };

  const getStatusLabel = (status) =>
    ({
      pending: "Pendente",
      in_progress: "Em Andamento",
      done: "Concluída",
      cancelled: "Cancelada",
    }[status] || status);

  const getPriorityClass = (priority) => {
    const norm = normalizePriority(priority);
    switch (norm) {
      case "Alta":
        return styles.priorityHigh;
      case "Média":
        return styles.priorityMedium;
      case "Baixa":
        return styles.priorityLow;
      default:
        return "";
    }
  };

  const formatDate = (dateString) => (!dateString ? "-" : new Date(dateString).toLocaleDateString("pt-BR"));

  /* ===================== Render ===================== */
  if (loading && !currentUser) {
    return (
      <div className={styles.spinnerContainer}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  if (!hasAccess()) {
    return (
      <div className={styles.teamTasksPage}>
        <Header onMenuToggle={toggleSidebar} />
        <div className={styles.pageBody}>
          <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />
          <main className={styles.contentArea}>
            <div className={styles.accessDenied}>
              <FiUsers size={64} />
              <h2>Acesso Restrito</h2>
              <p>Esta página é acessível apenas para gestores de equipe e administradores.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.teamTasksPage}>
      <Header onMenuToggle={toggleSidebar} />

      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />

        <main className={styles.contentArea}>
          <div className={styles.tasksWrapper}>
            {/* Header */}
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <h1 className={styles.pageTitle}>Tarefas da Equipe</h1>
                <button className={styles.addTaskBtn} onClick={() => navigate("/tasks/new")}>
                  <FiPlus />
                  Nova Tarefa
                </button>
              </div>

              <div className={styles.breadcrumb}>
                <span>Equipes</span>
                <span className={styles.separator}>›</span>
                <span className={styles.current}>Tarefas da Equipe</span>
              </div>
            </div>

            {/* Filtros */}
            <div className={styles.filtersCard}>
              <div className={styles.filtersHeader} onClick={() => setFiltersVisible(!filtersVisible)}>
                <div className={styles.filtersTitle}>
                  <FiFilter />
                  <span>Filtros</span>
                </div>
                {filtersVisible ? <FiChevronUp /> : <FiChevronDown />}
              </div>

              {filtersVisible && (
                <div className={styles.filtersContent}>
                  <div className={styles.filtersGrid}>
                    {/* Equipe */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiUsers />
                        Equipe *
                      </label>
                      <select
                        value={filters.selectedTeam}
                        onChange={(e) => handleFilterChange("selectedTeam", e.target.value)}
                        required
                      >
                        <option value="">Selecione uma equipe</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Busca */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiSearch />
                        Buscar
                      </label>
                      <input
                        type="text"
                        placeholder="Título da tarefa..."
                        value={filters.searchTerm}
                        onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
                        className={styles.searchInput}
                      />
                    </div>

                    {/* Status */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiTag />
                        Status
                      </label>
                      <select value={filters.status} onChange={(e) => handleFilterChange("status", e.target.value)}>
                        <option value="">Todos</option>
                        <option value="pending">Pendente</option>
                        <option value="in_progress">Em Andamento</option>
                        <option value="done">Concluída</option>
                        <option value="cancelled">Cancelada</option>
                      </select>
                    </div>

                    {/* Prioridade */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiAlertCircle />
                        Prioridade
                      </label>
                      <select
                        value={filters.priority}
                        onChange={(e) => handleFilterChange("priority", e.target.value)}
                      >
                        <option value="">Todas</option>
                        <option value="Alta">Alta</option>
                        <option value="Média">Média</option>
                        <option value="Baixa">Baixa</option>
                      </select>
                    </div>

                    {/* Categoria */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiTag />
                        Categoria
                      </label>
                      <input
                        type="text"
                        placeholder="Digite a categoria..."
                        value={filters.category}
                        onChange={(e) => handleFilterChange("category", e.target.value)}
                        className={styles.searchInput}
                      />
                    </div>

                    {/* Datas */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiCalendar />
                        Vencimento (De)
                      </label>
                      <input
                        type="date"
                        value={filters.dueDateFrom}
                        onChange={(e) => handleFilterChange("dueDateFrom", e.target.value)}
                        className={styles.dateInput}
                      />
                    </div>

                    <div className={styles.filterGroup}>
                      <label>
                        <FiCalendar />
                        Vencimento (Até)
                      </label>
                      <input
                        type="date"
                        value={filters.dueDateTo}
                        onChange={(e) => handleFilterChange("dueDateTo", e.target.value)}
                        className={styles.dateInput}
                      />
                    </div>

                    <div className={styles.filterGroup}>
                      <label>
                        <FiCalendar />
                        Criação (De)
                      </label>
                      <input
                        type="date"
                        value={filters.createdDateFrom}
                        onChange={(e) => handleFilterChange("createdDateFrom", e.target.value)}
                        className={styles.dateInput}
                      />
                    </div>

                    <div className={styles.filterGroup}>
                      <label>
                        <FiCalendar />
                        Criação (Até)
                      </label>
                      <input
                        type="date"
                        value={filters.createdDateTo}
                        onChange={(e) => handleFilterChange("createdDateTo", e.target.value)}
                        className={styles.dateInput}
                      />
                    </div>
                  </div>

                  {/* Membros */}
                  {teamMembers.length > 0 && (
                    <div className={styles.membersSection}>
                      <label className={styles.membersLabel}>
                        <FiUser />
                        Membros da Equipe
                      </label>
                      <div className={styles.membersGrid}>
                        {teamMembers.map((member) => (
                          <label key={member.user_id} className={styles.memberCheckbox}>
                            <input
                              type="checkbox"
                              checked={filters.selectedMembers.includes(String(member.user_id))}
                              onChange={() => handleMemberToggle(member.user_id)}
                            />
                            <span>{member.name}</span>
                            {member.is_manager && <span className={styles.managerBadge}>Gestor</span>}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={styles.filtersActions}>
                    <button onClick={clearFilters} className={styles.clearBtn}>
                      Limpar Filtros
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Lista */}
            <div className={styles.tasksContainer}>
              {loading ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner}></div>
                  <p>Carregando tarefas...</p>
                </div>
              ) : !filters.selectedTeam ? (
                <div className={styles.emptyState}>
                  <FiUsers size={48} />
                  <h3>Selecione uma Equipe</h3>
                  <p>Escolha uma equipe nos filtros para visualizar suas tarefas.</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className={styles.emptyState}>
                  <FiSearch size={48} />
                  <h3>Nenhuma tarefa encontrada</h3>
                  <p>Não há tarefas que correspondam aos filtros selecionados.</p>
                </div>
              ) : (
                <div className={styles.tasksTable}>
                  <div className={styles.tableHeader}>
                    <div className={styles.tableHeaderCell}>Tarefa</div>
                    <div className={styles.tableHeaderCell}>Responsável</div>
                    <div className={styles.tableHeaderCell}>Status</div>
                    <div className={styles.tableHeaderCell}>Prioridade</div>
                    <div className={styles.tableHeaderCell}>Vencimento</div>
                    <div className={styles.tableHeaderCell}>Criação</div>
                  </div>

                  {currentTasks.map((task) => {
                    const assignees = collectAssignees(task);
                    const assigneesNames = assignees
                      .map((uid) => teamMembers.find((m) => String(m.user_id) === String(uid))?.name)
                      .filter(Boolean);

                    const responsibleName =
                      assigneesNames.length === 0
                        ? "N/A"
                        : assigneesNames.length === 1
                        ? assigneesNames[0]
                        : `${assigneesNames[0]} +${assigneesNames.length - 1}`;

                    const normalizedPriority = normalizePriority(task.prioridade);

                    return (
                      <div
                        key={task.id}
                        className={styles.tableRow}
                        onClick={() => openTaskModal(task)}
                        style={{ cursor: "pointer" }}
                        title="Abrir detalhes da tarefa"
                      >
                        <div className={styles.tableCell}>
                          <div className={styles.taskInfo}>
                            <h4 className={styles.taskTitleClickable}>{task.title}</h4>
                            {task.description && (
                              <p className={styles.taskDescription}>
                                {task.description.length > 100
                                  ? `${task.description.substring(0, 100)}...`
                                  : task.description}
                              </p>
                            )}
                            {task.categoria && <span className={styles.categoryTag}>{task.categoria}</span>}
                          </div>
                        </div>

                        <div className={styles.tableCell}>
                          <div className={styles.responsibleInfo}>
                            <FiUser />
                            <span>{responsibleName}</span>
                          </div>
                        </div>

                        <div className={styles.tableCell}>
                          <div className={styles.statusBadge}>
                            {getStatusIcon(task.status)}
                            <span>{getStatusLabel(task.status)}</span>
                          </div>
                        </div>

                        <div className={styles.tableCell}>
                          {normalizedPriority && (
                            <span className={`${styles.priorityBadge} ${getPriorityClass(normalizedPriority)}`}>
                              {normalizedPriority}
                            </span>
                          )}
                        </div>

                        <div className={styles.tableCell}>
                          <div className={styles.dateInfo}>
                            <FiCalendar />
                            <span>{formatDate(task.due_date)}</span>
                          </div>
                        </div>

                        <div className={styles.tableCell}>
                          <div className={styles.dateInfo}>
                            <FiCalendar />
                            <span>{formatDate(task.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {totalPages > 1 && (
                    <div className={styles.pagination}>
                      <div className={styles.paginationInfo}>
                        Página {currentPage} de {totalPages}
                      </div>
                      <div className={styles.paginationControls}>
                        <button
                          className={styles.paginationBtn}
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          ◀
                        </button>

                        <div className={styles.pageNumbers}>
                          {[...Array(totalPages)].map((_, index) => (
                            <button
                              key={`page-${index}`}
                              onClick={() => handlePageChange(index + 1)}
                              className={`${styles.pageNumberBtn} ${currentPage === index + 1 ? styles.active : ""}`}
                            >
                              {index + 1}
                            </button>
                          ))}
                        </div>

                        <button
                          className={styles.paginationBtn}
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* MODAL DE TAREFA */}
      <TaskModal
        task={selectedTask}
        isOpen={isTaskModalOpen}
        onClose={closeTaskModal}
        onTaskUpdate={handleTaskUpdateFromModal}
      />
    </div>
  );
}

export default TeamTasks;
