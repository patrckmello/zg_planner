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

// Função para normalizar prioridade
const normalizePriority = (priority) => {
  if (!priority) return priority;
  const priorityMap = {
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
    high: "Alta",
    medium: "Média",
    low: "Baixa",
  };
  return priorityMap[priority.toLowerCase()] || priority;
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

  // Estados dos filtros
  const [filters, setFilters] = useState({
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

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTasks = filteredTasks.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);

  // Verificar se o usuário tem permissão de acesso
  const hasAccess = () => {
    return currentUser?.is_admin || currentUser?.is_manager;
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Buscar dados do usuário atual
        const userResponse = await api.get("/users/me");
        setCurrentUser(userResponse.data);

        // Verificar se tem acesso
        if (!userResponse.data.is_admin && !userResponse.data.is_manager) {
          toast.error(
            "Acesso negado. Apenas gestores e administradores podem acessar esta página."
          );
          navigate("/dashboard");
          return;
        }

        // Buscar equipes (rota corrigida sem /api)
        const teamsResponse = await api.get("/teams");
        setTeams(teamsResponse.data);

        // Se o usuário é gestor (não admin), filtrar apenas suas equipes
        if (!userResponse.data.is_admin && userResponse.data.is_manager) {
          const userTeams = teamsResponse.data.filter((team) =>
            team.members.some(
              (member) =>
                member.user_id === userResponse.data.id && member.is_manager
            )
          );
          setTeams(userTeams);
        }
      } catch (error) {
        console.error("Erro ao buscar dados iniciais:", error);
        toast.error("Erro ao carregar dados. Faça login novamente.");
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [navigate]);

  // Buscar membros da equipe quando uma equipe é selecionada
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (filters.selectedTeam) {
        try {
          // Usar a rota de produtividade para obter membros da equipe (rota corrigida sem /api)
          const response = await api.get(
            `/teams/${filters.selectedTeam}/productivity`
          );

          // Transformar dados de produtividade em formato de membros
          const members = response.data.productivity.map((member) => ({
            user_id: member.user_id,
            name: member.user_name,
            email: "", // Não disponível na rota de produtividade
            is_manager: false, // Não disponível na rota de produtividade
          }));

          setTeamMembers(members);
        } catch (error) {
          console.error("Erro ao buscar membros da equipe:", error);

          // Se falhar, tentar buscar da equipe selecionada diretamente
          try {
            const selectedTeam = teams.find(
              (team) => team.id === parseInt(filters.selectedTeam)
            );
            if (selectedTeam && selectedTeam.members) {
              const members = selectedTeam.members.map((member) => ({
                user_id: member.user_id,
                name: member.name || `Usuário ${member.user_id}`,
                email: member.email || "",
                is_manager: member.is_manager || false,
              }));
              setTeamMembers(members);
            } else {
              setTeamMembers([]);
            }
          } catch (fallbackError) {
            console.error(
              "Erro no fallback para buscar membros:",
              fallbackError
            );
            setTeamMembers([]);
            toast.error("Erro ao carregar membros da equipe");
          }
        }
      } else {
        setTeamMembers([]);
      }
    };

    fetchTeamMembers();
  }, [filters.selectedTeam, teams]);

  // Buscar tarefas quando os filtros mudarem
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

        // Filtros básicos
        if (filters.status) params.append("status", filters.status);
        if (filters.dueDateFrom)
          params.append("due_after", filters.dueDateFrom);
        if (filters.dueDateTo) params.append("due_before", filters.dueDateTo);
        if (filters.searchTerm) params.append("search", filters.searchTerm);

        const response = await api.get(`/tasks?${params.toString()}`);

        // Filtrar tarefas da equipe selecionada
        let teamTasks = response.data.filter((task) => {
          // Verificar se a tarefa pertence à equipe selecionada
          const taskUser = teamMembers.find(
            (member) => member.user_id === task.user_id
          );
          return taskUser !== undefined;
        });

        // Aplicar filtros adicionais no frontend
        if (filters.selectedMembers.length > 0) {
          teamTasks = teamTasks.filter((task) =>
            filters.selectedMembers.includes(task.user_id)
          );
        }

        if (filters.priority) {
          teamTasks = teamTasks.filter((task) => {
            const normalizedTaskPriority = normalizePriority(task.prioridade);
            return normalizedTaskPriority === filters.priority;
          });
        }

        if (filters.category) {
          teamTasks = teamTasks.filter(
            (task) =>
              task.categoria &&
              task.categoria
                .toLowerCase()
                .includes(filters.category.toLowerCase())
          );
        }

        if (filters.createdDateFrom) {
          teamTasks = teamTasks.filter(
            (task) =>
              new Date(task.created_at) >= new Date(filters.createdDateFrom)
          );
        }

        if (filters.createdDateTo) {
          teamTasks = teamTasks.filter(
            (task) =>
              new Date(task.created_at) <= new Date(filters.createdDateTo)
          );
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
    }
  }, [filters, teamMembers]);

  const handlePageChange = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleMemberToggle = (memberId) => {
    setFilters((prev) => ({
      ...prev,
      selectedMembers: prev.selectedMembers.includes(memberId)
        ? prev.selectedMembers.filter((id) => id !== memberId)
        : [...prev.selectedMembers, memberId],
    }));
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

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

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

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Pendente",
      in_progress: "Em Andamento",
      done: "Concluída",
      cancelled: "Cancelada",
    };
    return labels[status] || status;
  };

  const getPriorityClass = (priority) => {
    const normalizedPriority = normalizePriority(priority);
    switch (normalizedPriority) {
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

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

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
              <p>
                Esta página é acessível apenas para gestores de equipe e
                administradores.
              </p>
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
            {/* Header da página */}
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <h1 className={styles.pageTitle}>Tarefas da Equipe</h1>
                <button
                  className={styles.addTaskBtn}
                  onClick={() => navigate("/tasks/new")}
                >
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
              <div
                className={styles.filtersHeader}
                onClick={() => setFiltersVisible(!filtersVisible)}
              >
                <div className={styles.filtersTitle}>
                  <FiFilter />
                  <span>Filtros</span>
                </div>
                {filtersVisible ? <FiChevronUp /> : <FiChevronDown />}
              </div>

              {filtersVisible && (
                <div className={styles.filtersContent}>
                  <div className={styles.filtersGrid}>
                    {/* Seleção de Equipe */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiUsers />
                        Equipe *
                      </label>
                      <select
                        value={filters.selectedTeam}
                        onChange={(e) =>
                          handleFilterChange("selectedTeam", e.target.value)
                        }
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

                    {/* Busca por termo */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiSearch />
                        Buscar
                      </label>
                      <input
                        type="text"
                        placeholder="Título da tarefa..."
                        value={filters.searchTerm}
                        onChange={(e) =>
                          handleFilterChange("searchTerm", e.target.value)
                        }
                        className={styles.searchInput}
                      />
                    </div>

                    {/* Status */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiTag />
                        Status
                      </label>
                      <select
                        value={filters.status}
                        onChange={(e) =>
                          handleFilterChange("status", e.target.value)
                        }
                      >
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
                        onChange={(e) =>
                          handleFilterChange("priority", e.target.value)
                        }
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
                        onChange={(e) =>
                          handleFilterChange("category", e.target.value)
                        }
                        className={styles.searchInput}
                      />
                    </div>

                    {/* Data de Vencimento - De */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiCalendar />
                        Vencimento (De)
                      </label>
                      <input
                        type="date"
                        value={filters.dueDateFrom}
                        onChange={(e) =>
                          handleFilterChange("dueDateFrom", e.target.value)
                        }
                        className={styles.dateInput}
                      />
                    </div>

                    {/* Data de Vencimento - Até */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiCalendar />
                        Vencimento (Até)
                      </label>
                      <input
                        type="date"
                        value={filters.dueDateTo}
                        onChange={(e) =>
                          handleFilterChange("dueDateTo", e.target.value)
                        }
                        className={styles.dateInput}
                      />
                    </div>

                    {/* Data de Criação - De */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiCalendar />
                        Criação (De)
                      </label>
                      <input
                        type="date"
                        value={filters.createdDateFrom}
                        onChange={(e) =>
                          handleFilterChange("createdDateFrom", e.target.value)
                        }
                        className={styles.dateInput}
                      />
                    </div>

                    {/* Data de Criação - Até */}
                    <div className={styles.filterGroup}>
                      <label>
                        <FiCalendar />
                        Criação (Até)
                      </label>
                      <input
                        type="date"
                        value={filters.createdDateTo}
                        onChange={(e) =>
                          handleFilterChange("createdDateTo", e.target.value)
                        }
                        className={styles.dateInput}
                      />
                    </div>
                  </div>

                  {/* Seleção de Membros da Equipe */}
                  {teamMembers.length > 0 && (
                    <div className={styles.membersSection}>
                      <label className={styles.membersLabel}>
                        <FiUser />
                        Membros da Equipe
                      </label>
                      <div className={styles.membersGrid}>
                        {teamMembers.map((member) => (
                          <label
                            key={member.user_id}
                            className={styles.memberCheckbox}
                          >
                            <input
                              type="checkbox"
                              checked={filters.selectedMembers.includes(
                                member.user_id
                              )}
                              onChange={() =>
                                handleMemberToggle(member.user_id)
                              }
                            />
                            <span>{member.name}</span>
                            {member.is_manager && (
                              <span className={styles.managerBadge}>
                                Gestor
                              </span>
                            )}
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

            {/* Lista de Tarefas */}
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
                  <p>
                    Escolha uma equipe nos filtros para visualizar suas tarefas.
                  </p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className={styles.emptyState}>
                  <FiSearch size={48} />
                  <h3>Nenhuma tarefa encontrada</h3>
                  <p>
                    Não há tarefas que correspondam aos filtros selecionados.
                  </p>
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
                    const responsible = teamMembers.find(
                      (member) => member.user_id === task.user_id
                    );
                    const normalizedPriority = normalizePriority(
                      task.prioridade
                    );

                    return (
                      <div key={task.id} className={styles.tableRow}>
                        <div className={styles.tableCell}>
                          <div className={styles.taskInfo}>
                            <h4>{task.title}</h4>
                            {task.description && (
                              <p className={styles.taskDescription}>
                                {task.description.length > 100
                                  ? `${task.description.substring(0, 100)}...`
                                  : task.description}
                              </p>
                            )}
                            {task.categoria && (
                              <span className={styles.categoryTag}>
                                {task.categoria}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className={styles.tableCell}>
                          <div className={styles.responsibleInfo}>
                            <FiUser />
                            <span>{responsible?.name || "N/A"}</span>
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
                            <span
                              className={`${
                                styles.priorityBadge
                              } ${getPriorityClass(normalizedPriority)}`}
                            >
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
                              className={`${styles.pageNumberBtn} ${
                                currentPage === index + 1 ? styles.active : ""
                              }`}
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
    </div>
  );
}

export default TeamTasks;
