import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import api from "../services/axiosInstance";
import styles from "./TeamReports.module.css";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Filter,
  Download,
  FileText,
  Target,
  ChevronDown,
  ChevronUp,
  Activity,
  PieChart,
  Users,
  Zap,
} from "lucide-react";

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

const normalizeCategory = (category) => {
  if (!category) return category;
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
};

// Funções de exportação simplificadas
const exportToCSV = (data, teamName) => {
  try {
    const csvContent = [
      ["Métrica", "Valor"],
      ["Equipe", teamName || "N/A"],
      ["Total de Tarefas", data.total_tasks || 0],
      ["Concluídas no Prazo", data.tasks_completed_on_time || 0],
      ["Tarefas Atrasadas", data.overdue_tasks || 0],
      ["Tempo Médio", data.average_completion_time || "N/A"],
      [
        "Taxa de Conclusão",
        data.total_tasks > 0
          ? Math.round(
              ((data.tasks_by_status?.done || 0) / data.total_tasks) * 100
            ) + "%"
          : "0%",
      ],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `relatorio_equipe_${teamName || "equipe"}_${
        new Date().toISOString().split("T")[0]
      }.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Erro ao exportar CSV:", error);
    throw error;
  }
};

const exportToPDF = (data, teamName) => {
  try {
    // Criar conteúdo HTML para impressão
    const printContent = `
      <html>
        <head>
          <title>Relatório da Equipe - ${teamName || "Equipe"}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #3498db; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f2f2f2; }
            .metric { margin: 10px 0; }
          </style>
        </head>
        <body>
          <h1>Relatório da Equipe: ${teamName || "Equipe"}</h1>
          <p>Data: ${new Date().toLocaleDateString("pt-BR")}</p>
          
          <h2>Métricas Principais</h2>
          <div class="metric"><strong>Total de Tarefas:</strong> ${
            data.total_tasks || 0
          }</div>
          <div class="metric"><strong>Concluídas no Prazo:</strong> ${
            data.tasks_completed_on_time || 0
          }</div>
          <div class="metric"><strong>Tarefas Atrasadas:</strong> ${
            data.overdue_tasks || 0
          }</div>
          <div class="metric"><strong>Tempo Médio:</strong> ${
            data.average_completion_time || "N/A"
          }</div>
          <div class="metric"><strong>Taxa de Conclusão:</strong> ${
            data.total_tasks > 0
              ? Math.round(
                  ((data.tasks_by_status?.done || 0) / data.total_tasks) * 100
                ) + "%"
              : "0%"
          }</div>
          
          <h2>Distribuição por Status</h2>
          <table>
            <tr><th>Status</th><th>Quantidade</th></tr>
            ${Object.entries(data.tasks_by_status || {})
              .map(
                ([status, count]) =>
                  `<tr><td>${
                    status === "done"
                      ? "Concluída"
                      : status === "pending"
                      ? "Pendente"
                      : status === "in_progress"
                      ? "Em Andamento"
                      : status
                  }</td><td>${count}</td></tr>`
              )
              .join("")}
          </table>
          
          <h2>Distribuição por Prioridade</h2>
          <table>
            <tr><th>Prioridade</th><th>Quantidade</th></tr>
            ${Object.entries(data.tasks_by_priority || {})
              .map(
                ([priority, count]) =>
                  `<tr><td>${priority}</td><td>${count}</td></tr>`
              )
              .join("")}
          </table>
        </body>
      </html>
    `;

    // Abrir nova janela para impressão
    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  } catch (error) {
    console.error("Erro ao exportar PDF:", error);
    throw error;
  }
};

function TeamReports() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [currentView, setCurrentView] = useState("status");
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [teamProductivity, setTeamProductivity] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    status: "",
    priority: "",
    category: "",
    user_id: "",
  });

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

        const teamsResponse = await api.get("/teams");

        // Se o usuário é gestor (não admin), filtrar apenas suas equipes
        if (!userResponse.data.is_admin && userResponse.data.is_manager) {
          const userTeams = teamsResponse.data.filter((team) =>
            team.members.some(
              (member) =>
                member.user_id === userResponse.data.id && member.is_manager
            )
          );
          setTeams(userTeams);
        } else {
          setTeams(teamsResponse.data);
        }

        // Buscar todas as tarefas para análise
        const tasksResponse = await api.get("/tasks");
        setAllTasks(tasksResponse.data);
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

  const calculateTeamMetrics = (teamTasks, teamMembers) => {
    if (!teamTasks || teamTasks.length === 0) {
      return {
        total_tasks: 0,
        tasks_by_status: {},
        tasks_by_priority: {},
        tasks_by_category: {},
        tasks_completed_on_time: 0,
        tasks_completed_late: 0,
        overdue_tasks: 0,
        upcoming_tasks: 0,
        average_completion_time: "N/A",
      };
    }

    const metrics = {
      total_tasks: teamTasks.length,
      tasks_by_status: {},
      tasks_by_priority: {},
      tasks_by_category: {},
      tasks_completed_on_time: 0,
      tasks_completed_late: 0,
      overdue_tasks: 0,
      upcoming_tasks: 0,
    };

    const now = new Date();
    let totalCompletionTime = 0;
    let completedTasksWithTime = 0;

    teamTasks.forEach((task) => {
      // Contagem por status
      metrics.tasks_by_status[task.status] =
        (metrics.tasks_by_status[task.status] || 0) + 1;

      // Contagem por prioridade (normalizada)
      if (task.prioridade) {
        const normalizedPriority = normalizePriority(task.prioridade);
        metrics.tasks_by_priority[normalizedPriority] =
          (metrics.tasks_by_priority[normalizedPriority] || 0) + 1;
      }

      // Contagem por categoria
      if (task.categoria) {
        const normalizedCategory = normalizeCategory(task.categoria);
        metrics.tasks_by_category[normalizedCategory] =
          (metrics.tasks_by_category[normalizedCategory] || 0) + 1;
      }

      // Tarefas concluídas no prazo ou atrasadas
      if (task.status === "done" && task.due_date) {
        const dueDate = new Date(task.due_date);
        const updatedAt = new Date(task.updated_at);

        if (updatedAt <= dueDate) {
          metrics.tasks_completed_on_time += 1;
        } else {
          metrics.tasks_completed_late += 1;
        }

        // Calcular tempo de conclusão
        const createdAt = new Date(task.created_at);
        const completionTime = Math.ceil(
          (updatedAt - createdAt) / (1000 * 60 * 60 * 24)
        ); // dias
        totalCompletionTime += completionTime;
        completedTasksWithTime += 1;
      }

      // Tarefas atrasadas e próximas
      if (task.due_date && task.status !== "done") {
        const dueDate = new Date(task.due_date);
        if (dueDate < now) {
          metrics.overdue_tasks += 1;
        } else {
          metrics.upcoming_tasks += 1;
        }
      }
    });

    // Calcular tempo médio de conclusão
    if (completedTasksWithTime > 0) {
      const avgDays = Math.round(totalCompletionTime / completedTasksWithTime);
      metrics.average_completion_time = `${avgDays} dias`;
    } else {
      metrics.average_completion_time = "N/A";
    }

    return metrics;
  };

  const fetchReportData = async () => {
    if (!selectedTeam) {
      setReportData(null);
      setTeamProductivity(null);
      return;
    }

    try {
      setLoading(true);

      const productivityResponse = await api.get(
        `/teams/${selectedTeam}/productivity`
      );
      setTeamProductivity(productivityResponse.data);

      // Obter IDs dos membros da equipe
      const teamMemberIds = productivityResponse.data.productivity.map(
        (member) => member.user_id
      );

      // Filtrar tarefas da equipe
      let teamTasks = allTasks.filter((task) =>
        teamMemberIds.includes(task.user_id)
      );

      // Aplicar filtros adicionais
      if (filters.user_id) {
        teamTasks = teamTasks.filter(
          (task) => task.user_id === parseInt(filters.user_id)
        );
      }

      if (filters.status) {
        teamTasks = teamTasks.filter((task) => task.status === filters.status);
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

      if (filters.start_date) {
        teamTasks = teamTasks.filter(
          (task) => new Date(task.created_at) >= new Date(filters.start_date)
        );
      }

      if (filters.end_date) {
        teamTasks = teamTasks.filter(
          (task) => new Date(task.created_at) <= new Date(filters.end_date)
        );
      }

      // Calcular métricas da equipe
      const calculatedMetrics = calculateTeamMetrics(
        teamTasks,
        productivityResponse.data.productivity
      );
      calculatedMetrics.detailed_tasks = teamTasks;

      setReportData(calculatedMetrics);
    } catch (error) {
      console.error("Erro ao buscar dados do relatório:", error);
      toast.error("Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [selectedTeam, filters, allTasks]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      start_date: "",
      end_date: "",
      status: "",
      priority: "",
      category: "",
      user_id: "",
    });
    setSelectedTeam("");
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

  const handleExportPDF = async () => {
    if (!reportData || !teamProductivity) {
      toast.error("Nenhum dado disponível para exportar");
      return;
    }

    try {
      exportToPDF(reportData, teamProductivity.team_name);
      toast.success("Relatório PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar relatório PDF");
    }
  };

  const handleExportCSV = () => {
    if (!reportData || !teamProductivity) {
      toast.error("Nenhum dado disponível para exportar");
      return;
    }

    try {
      exportToCSV(reportData, teamProductivity.team_name);
      toast.success("Dados CSV exportados com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      toast.error("Erro ao exportar dados CSV");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "#f59e0b",
      in_progress: "#3b82f6",
      done: "#10b981",
      cancelled: "#ef4444",
    };
    return colors[status] || "#6b7280";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      Alta: "#ef4444",
      Média: "#f59e0b",
      Baixa: "#10b981",
    };
    return colors[priority] || "#6b7280";
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

  const renderChart = () => {
    if (!reportData) return null;

    let data = {};
    let title = "";
    let getColor = () => "#3498db";

    switch (currentView) {
      case "status":
        data = reportData.tasks_by_status || {};
        title = "Distribuição por Status";
        getColor = getStatusColor;
        break;
      case "priority":
        data = reportData.tasks_by_priority || {};
        title = "Distribuição por Prioridade";
        getColor = getPriorityColor;
        break;
      case "category":
        data = reportData.tasks_by_category || {};
        title = "Distribuição por Categoria";
        break;
      default:
        return null;
    }

    const maxValue = Math.max(...Object.values(data), 1);

    return (
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div className={styles.chartTitle}>
            <PieChart size={20} />
            {title}
          </div>
          <div className={styles.chartToggle}>
            <button
              className={`${styles.toggleBtn} ${
                currentView === "status" ? styles.active : ""
              }`}
              onClick={() => setCurrentView("status")}
            >
              Status
            </button>
            <button
              className={`${styles.toggleBtn} ${
                currentView === "priority" ? styles.active : ""
              }`}
              onClick={() => setCurrentView("priority")}
            >
              Prioridade
            </button>
            <button
              className={`${styles.toggleBtn} ${
                currentView === "category" ? styles.active : ""
              }`}
              onClick={() => setCurrentView("category")}
            >
              Categoria
            </button>
          </div>
        </div>

        <div className={styles.chartContent}>
          {Object.keys(data).length === 0 ? (
            <div className={styles.emptyChart}>
              <p>Nenhum dado disponível para exibir</p>
            </div>
          ) : (
            Object.entries(data).map(([key, value]) => (
              <div key={key} className={styles.chartItem}>
                <div className={styles.chartItemLabel}>
                  <div
                    className={styles.chartItemColor}
                    style={{ backgroundColor: getColor(key) }}
                  ></div>
                  <span>
                    {currentView === "status" ? getStatusLabel(key) : key}
                  </span>
                </div>
                <div className={styles.chartItemBar}>
                  <div
                    className={styles.chartItemFill}
                    style={{
                      width: `${(value / maxValue) * 100}%`,
                      backgroundColor: getColor(key),
                    }}
                  />
                </div>
                <div className={styles.chartItemValue}>{value}</div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderTeamProductivity = () => {
    if (!teamProductivity || teamProductivity.productivity.length === 0)
      return null;

    const maxCompleted = Math.max(
      ...teamProductivity.productivity.map((p) => p.completed_tasks),
      1
    );

    return (
      <div className={styles.productivityCard}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Users size={20} />
            Produtividade da Equipe: {teamProductivity.team_name}
          </h3>
        </div>
        <div className={styles.productivityGrid}>
          {teamProductivity.productivity.map((member) => (
            <div key={member.user_id} className={styles.productivityItem}>
              <div className={styles.productivityLabel}>
                <span className={styles.userName}>{member.user_name}</span>
                <span className={styles.userRate}>
                  {parseFloat(member.completion_rate).toFixed(1)}%
                </span>
              </div>
              <div className={styles.productivityBar}>
                <div
                  className={styles.productivityFill}
                  style={{
                    width: `${(member.completed_tasks / maxCompleted) * 100}%`,
                    backgroundColor: "#3498db",
                  }}
                ></div>
              </div>
              <div className={styles.productivityValue}>
                {member.completed_tasks} / {member.total_tasks}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading && !currentUser) {
    return (
      <div className={styles.reportsPage}>
        <Header onMenuToggle={toggleSidebar} />
        <div className={styles.pageBody}>
          <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />
          <main className={styles.contentArea}>
            <div className={styles.reportsWrapper}>
              <div className={styles.spinnerContainer}>
                <div className={styles.spinner}></div>
                <p>Carregando relatório...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!hasAccess()) {
    return (
      <div className={styles.reportsPage}>
        <Header onMenuToggle={toggleSidebar} />
        <div className={styles.pageBody}>
          <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />
          <main className={styles.contentArea}>
            <div className={styles.reportsWrapper}>
              <div className={styles.accessDenied}>
                <Users size={64} />
                <h2>Acesso Restrito</h2>
                <p>
                  Esta página é acessível apenas para gestores de equipe e
                  administradores.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reportsPage}>
      <Header onMenuToggle={toggleSidebar} />
      <div className={styles.pageBody}>
        <Sidebar isOpen={sidebarOpen} onLogout={handleLogout} />
        <main className={styles.contentArea}>
          <div className={styles.reportsWrapper}>
            {/* Header da Página */}
            <div className={styles.pageHeader}>
              <div className={styles.headerContent}>
                <h1 className={styles.pageTitle}>Relatórios da Equipe</h1>
              </div>
              <div className={styles.breadcrumb}>
                <span>Equipes</span>
                <span className={styles.separator}>›</span>
                <span className={styles.current}>Relatórios da Equipe</span>
              </div>
            </div>

            {/* Botões de exportação */}
            <div className={styles.exportSection}>
              <button
                onClick={handleExportPDF}
                className={`${styles.exportBtn} ${styles.exportPdf}`}
                disabled={!reportData}
              >
                <FileText size={18} />
                Exportar PDF
              </button>
              <button
                onClick={handleExportCSV}
                className={`${styles.exportBtn} ${styles.exportCsv}`}
                disabled={!reportData}
              >
                <Download size={18} />
                Exportar CSV
              </button>
            </div>

            {/* Card de filtros */}
            <div className={styles.filtersCard}>
              <div
                className={styles.filtersHeader}
                onClick={() => setFiltersVisible(!filtersVisible)}
              >
                <div className={styles.filtersTitle}>
                  <Filter size={20} />
                  <span>Filtros</span>
                </div>
                {filtersVisible ? (
                  <ChevronUp size={20} />
                ) : (
                  <ChevronDown size={20} />
                )}
              </div>

              {filtersVisible && (
                <div className={styles.filtersContent}>
                  <div className={styles.filtersGrid}>
                    <div className={styles.filterGroup}>
                      <label>Equipe *</label>
                      <select
                        value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}
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
                    <div className={styles.filterGroup}>
                      <label>Membro da Equipe</label>
                      <select
                        value={filters.user_id}
                        onChange={(e) =>
                          handleFilterChange("user_id", e.target.value)
                        }
                        disabled={!selectedTeam}
                      >
                        <option value="">Todos os Membros</option>
                        {selectedTeam &&
                          teamProductivity?.productivity.map((member) => (
                            <option key={member.user_id} value={member.user_id}>
                              {member.user_name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className={styles.filterGroup}>
                      <label>Data Inicial</label>
                      <input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) =>
                          handleFilterChange("start_date", e.target.value)
                        }
                        className={styles.dateInput}
                      />
                    </div>
                    <div className={styles.filterGroup}>
                      <label>Data Final</label>
                      <input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) =>
                          handleFilterChange("end_date", e.target.value)
                        }
                        className={styles.dateInput}
                      />
                    </div>
                    <div className={styles.filterGroup}>
                      <label>Status</label>
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
                    <div className={styles.filterGroup}>
                      <label>Prioridade</label>
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
                    <div className={styles.filterGroup}>
                      <label>Categoria</label>
                      <input
                        type="text"
                        placeholder="Digite a categoria"
                        value={filters.category}
                        onChange={(e) =>
                          handleFilterChange("category", e.target.value)
                        }
                        className={styles.searchInput}
                      />
                    </div>
                  </div>
                  <div className={styles.filtersActions}>
                    <button onClick={clearFilters} className={styles.clearBtn}>
                      Limpar Filtros
                    </button>
                  </div>
                </div>
              )}
            </div>

            {reportData ? (
              <>
                {/* Cards de métricas principais da equipe */}
                <div className={styles.metricsGrid}>
                  <div className={styles.metricCard}>
                    <div
                      className={styles.metricIcon}
                      style={{ backgroundColor: "#3b82f6" }}
                    >
                      <Target size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.total_tasks}</h3>
                      <p>Total de Tarefas</p>
                    </div>
                    <div className={styles.metricTrend}>
                      <Activity size={16} />
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div
                      className={styles.metricIcon}
                      style={{ backgroundColor: "#10b981" }}
                    >
                      <CheckCircle size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.tasks_completed_on_time}</h3>
                      <p>Concluídas no Prazo</p>
                    </div>
                    <div className={styles.metricProgress}>
                      <TrendingUp size={16} />
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div
                      className={styles.metricIcon}
                      style={{ backgroundColor: "#ef4444" }}
                    >
                      <AlertTriangle size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.overdue_tasks}</h3>
                      <p>Tarefas Atrasadas</p>
                    </div>
                    <div className={styles.metricAlert}>
                      {reportData.overdue_tasks > 0 && <Zap size={16} />}
                    </div>
                  </div>

                  <div className={styles.metricCard}>
                    <div
                      className={styles.metricIcon}
                      style={{ backgroundColor: "#f59e0b" }}
                    >
                      <Clock size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <h3>{reportData.average_completion_time}</h3>
                      <p>Tempo Médio</p>
                    </div>
                    <div className={styles.metricInfo}>
                      <Calendar size={16} />
                    </div>
                  </div>
                </div>

                {/* Gráfico principal (distribuição de tarefas) */}
                {renderChart()}

                {/* Produtividade por Membro da Equipe */}
                {renderTeamProductivity()}

                {/* Card de resumo de performance */}
                <div className={styles.performanceCard}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>
                      <BarChart3 size={20} />
                      Resumo de Performance da Equipe
                    </h3>
                  </div>
                  <div className={styles.performanceGrid}>
                    <div className={styles.performanceItem}>
                      <div className={styles.performanceLabel}>
                        Taxa de Conclusão da Equipe
                      </div>
                      <div className={styles.performanceValue}>
                        {reportData.total_tasks > 0
                          ? Math.round(
                              ((reportData.tasks_by_status.done || 0) /
                                reportData.total_tasks) *
                                100
                            )
                          : 0}
                        %
                      </div>
                    </div>
                    <div className={styles.performanceItem}>
                      <div className={styles.performanceLabel}>
                        Tarefas Concluídas Atrasadas
                      </div>
                      <div className={styles.performanceValue}>
                        {reportData.tasks_completed_late || 0}
                      </div>
                    </div>
                    <div className={styles.performanceItem}>
                      <div className={styles.performanceLabel}>
                        Próximas Tarefas
                      </div>
                      <div className={styles.performanceValue}>
                        {reportData.upcoming_tasks || 0}
                      </div>
                    </div>
                    <div className={styles.performanceItem}>
                      <div className={styles.performanceLabel}>
                        Produtividade Média
                      </div>
                      <div className={styles.performanceValue}>
                        {reportData.total_tasks > 0 &&
                        reportData.average_completion_time !== "N/A"
                          ? "Alta"
                          : "Baixa"}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                <BarChart3 size={64} />
                <h3>Selecione uma Equipe</h3>
                <p>Escolha uma equipe nos filtros para gerar o relatório.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default TeamReports;
